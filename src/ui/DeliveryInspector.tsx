import { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book, Delivery } from '../core/model';
import { elapsed, validatePayload } from '../core/model';
import { runtime } from '../core/runtime';
import { Badge, ExportButton, Modal } from './primitives';
import { date } from './format';
export function DeliveryInspector({
  book,
  delivery,
  onClose,
  onReplay,
}: {
  book: Book;
  delivery: Delivery;
  onClose: () => void;
  onReplay: () => void;
}) {
  const [section, setSection] = useState('Payload');
  const destination = book.destinations.find((d) => d.id === delivery.destinationId)!;
  const validation = validatePayload(delivery.body),
    last = delivery.attempts.at(-1);
  return (
    <Modal title="Delivery inspector" subtitle={delivery.eventId} onClose={onClose} wide>
      <div className="inspector-banner">
        <Badge status={delivery.status} />
        <span className="mono">{delivery.type}</span>
        <span>{date(delivery.createdAt)}</span>
      </div>
      <div className="modal-body inspector-body">
        <div className="inspect-route">
          <div>
            <span className="inspect-label">SOURCE</span>
            <strong>Northline event stream</strong>
            <small>Schema v1 · local sandbox</small>
          </div>
          <ArrowUpRight size={21} />
          <div>
            <span className="inspect-label">DESTINATION</span>
            <strong>{destination.name}</strong>
            <Link to={`/destinations?edit=${destination.id}`} onClick={onClose}>
              Review configuration <ExternalLink size={12} />
            </Link>
          </div>
          <span
            className={`http-code ${last && last.code && last.code >= 400 ? 'http-error' : ''}`}
          >
            {last?.code ?? '—'}
          </span>
        </div>
        <div className="segmented inspector-tabs" aria-label="Inspector sections">
          {['Payload', 'Attempts', 'Context'].map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={section === tab}
              onClick={() => setSection(tab)}
            >
              {tab}
              {tab === 'Attempts' && <span>{delivery.attempts.length}</span>}
            </button>
          ))}
        </div>
        {section === 'Payload' && (
          <>
            <div
              className={`validation-summary ${validation.ok ? 'validation-good' : 'validation-error'}`}
            >
              {validation.ok ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
              <strong>{validation.ok ? 'Contract valid' : 'Contract validation failed'}</strong>
              <span>event.v1</span>
            </div>
            {!validation.ok && (
              <ul className="validation-issues">
                {validation.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
            <div className="code-heading">
              <span>application/json</span>
              <button
                className="icon-button"
                aria-label="Copy event payload"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(delivery.body)
                    .then(() => runtime.notify('Event payload copied.'))
                    .catch(() =>
                      runtime.notify(
                        'Clipboard unavailable. Select the payload to copy it.',
                        true,
                      ),
                    );
                }}
              >
                <Copy size={15} />
              </button>
            </div>
            <pre className="code-block payload-view" tabIndex={0}>
              {delivery.body}
            </pre>
          </>
        )}
        {section === 'Attempts' && (
          <div className="attempt-list">
            {[...delivery.attempts].reverse().map((attempt, i) => (
              <div key={attempt.id} className="attempt-entry">
                <span
                  className={`attempt-number ${attempt.code && attempt.code < 300 ? 'attempt-good' : ''}`}
                >
                  {delivery.attempts.length - i}
                </span>
                <div>
                  <div>
                    <strong>
                      {attempt.code ? `HTTP ${attempt.code}` : 'No acknowledgement'}
                    </strong>
                    <span>{elapsed(attempt.latencyMs)}</span>
                    <time>{date(attempt.at)}</time>
                  </div>
                  <p>{attempt.message}</p>
                  {attempt.runId && (
                    <Link to={`/runs?run=${attempt.runId}`} onClick={onClose}>
                      Open replay run <ArrowUpRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {!delivery.attempts.length && (
              <p className="muted">
                No attempt has completed yet. Follow its run for progress.
              </p>
            )}
            <p className="local-disclosure">
              The latest 8 attempts per delivery are retained in this bounded demo.
            </p>
          </div>
        )}
        {section === 'Context' && (
          <dl className="context-list">
            <dt>Event identity</dt>
            <dd className="mono">{delivery.eventId}</dd>
            <dt>Record ID</dt>
            <dd className="mono">{delivery.id}</dd>
            <dt>Destination</dt>
            <dd className="break-all">{destination.url}</dd>
            <dt>Deduplication key</dt>
            <dd className="mono break-all">
              {destination.id}/{delivery.eventId}
            </dd>
            <dt>Record revision</dt>
            <dd>{delivery.revision}</dd>
            <dt>Dispatch mode</dt>
            <dd>Local Web Worker simulation. No external network request.</dd>
          </dl>
        )}
      </div>
      <div className="modal-footer">
        <ExportButton book={book} delivery={delivery} />
        <button
          className="button primary"
          disabled={delivery.status !== 'failed'}
          onClick={onReplay}
        >
          <RotateCcw size={15} />
          Review replay
        </button>
      </div>
    </Modal>
  );
}
