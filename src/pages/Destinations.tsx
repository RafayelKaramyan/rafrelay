import { useState } from 'react';
import { Cable, ChevronRight, Clock3, Plus, Settings2, ShieldCheck, Zap } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Book, Destination, EventType, Policy } from '../core/model';
import { eventTypes, policies, uuid } from '../core/model';
import { runtime } from '../core/runtime';
import { Badge, ErrorNote, LoadingButton, Modal, PageHeader } from '../ui/primitives';
import { errorMessage, number, policyNames } from '../ui/format';
const descriptions: Record<Policy, string> = {
  healthy: 'Accepts every valid event with HTTP 202.',
  intermittent: 'Returns 502 once, then accepts the next attempt.',
  unavailable: 'Returns HTTP 503 on every attempt until changed.',
  rate_limited: 'Returns 429 twice, then accepts the third attempt.',
};
function DestinationEditor({
  book,
  target,
  onClose,
}: {
  book: Book;
  target: Destination | null;
  onClose: () => void;
}) {
  const [initial] = useState(
    () =>
      target ?? {
        id: `dest_${uuid()}`,
        name: '',
        url: 'https://',
        description: '',
        enabled: true,
        policy: 'healthy' as Policy,
        latencyMs: 240,
        maxAttempts: 3,
        subscriptions: [...eventTypes],
        revision: 0,
      },
  );
  const [value, setValue] = useState(initial),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [generation] = useState(book.generation);
  const update = <K extends keyof Destination>(key: K, next: Destination[K]) =>
    setValue((old) => ({ ...old, [key]: next }));
  return (
    <Modal
      title={target ? 'Configure destination' : 'Create destination'}
      subtitle={
        target
          ? `${target.name} · reviewed revision ${initial.revision}`
          : 'A fictional endpoint in your local integration sandbox.'
      }
      onClose={onClose}
      busy={busy}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!value.subscriptions.length) {
            setError('Subscribe to at least one event type.');
            return;
          }
          if (!value.url.startsWith('https://')) {
            setError('Use an HTTPS address.');
            return;
          }
          if (new URL(value.url).username || new URL(value.url).password) {
            setError('Do not include credentials in an endpoint label.');
            return;
          }
          setBusy(true);
          setError('');
          void runtime
            .saveTarget(value, target ? initial.revision : null, generation, reason)
            .then(onClose)
            .catch((e: unknown) => setError(errorMessage(e)))
            .finally(() => setBusy(false));
        }}
      >
        <div className="modal-body">
          <div className="form-grid">
            <label className="field">
              Destination name
              <input
                value={value.name}
                onChange={(e) => update('name', e.target.value)}
                required
                minLength={3}
                maxLength={48}
                placeholder="e.g. Results Bridge"
              />
            </label>
            <label className="field">
              Description
              <input
                value={value.description}
                onChange={(e) => update('description', e.target.value)}
                maxLength={120}
                placeholder="What receives these events?"
              />
            </label>
            <label className="field field-wide">
              Endpoint URL
              <input
                type="url"
                required
                value={value.url}
                onChange={(e) => update('url', e.target.value)}
                maxLength={240}
              />
              <small>
                Used as a destination label. The simulator never makes a request to this URL.
              </small>
            </label>
          </div>
          <fieldset className="form-fieldset">
            <legend>Subscribed events</legend>
            <div className="subscription-options">
              {eventTypes.map((type) => (
                <label key={type}>
                  <input
                    type="checkbox"
                    checked={value.subscriptions.includes(type)}
                    onChange={() =>
                      update(
                        'subscriptions',
                        value.subscriptions.includes(type)
                          ? value.subscriptions.filter((t) => t !== type)
                          : ([...value.subscriptions, type] as EventType[]),
                      )
                    }
                  />
                  <code>{type}</code>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="form-fieldset">
            <legend>Simulator behaviour</legend>
            <div className="form-grid">
              <label className="field">
                Response policy
                <select
                  value={value.policy}
                  onChange={(e) => update('policy', e.target.value as Policy)}
                >
                  {policies.map((p) => (
                    <option key={p} value={p}>
                      {policyNames[p]}
                    </option>
                  ))}
                </select>
                <small>{descriptions[value.policy]}</small>
              </label>
              <label className="field">
                Response latency (ms)
                <input
                  type="number"
                  min={120}
                  max={1200}
                  step={10}
                  required
                  value={value.latencyMs}
                  onChange={(e) => update('latencyMs', Number(e.target.value))}
                />
                <small>120–1,200 ms of worker simulation time.</small>
              </label>
              <label className="field">
                Maximum attempts per run
                <select
                  value={value.maxAttempts}
                  onChange={(e) => update('maxAttempts', Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'attempt' : 'attempts'}
                    </option>
                  ))}
                </select>
                <small>429, 5xx and missing responses retry with backoff.</small>
              </label>
              <label className="toggle-field">
                <span>
                  <strong>Accept new deliveries</strong>
                  <small>Paused destinations are excluded from new replay plans.</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={value.enabled}
                  onChange={(e) => update('enabled', e.target.checked)}
                  aria-label="Accept new deliveries"
                />
              </label>
            </div>
          </fieldset>
          <label className="field">
            Reason for change
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={4}
              maxLength={240}
              rows={2}
              placeholder="Explain the configuration change"
            />
            <small>
              Recorded in workspace activity. Concurrent edits are checked before saving.
            </small>
          </label>
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <LoadingButton className="button primary" busy={busy}>
            <ShieldCheck size={15} />
            {target ? 'Save configuration' : 'Create destination'}
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}
export function Destinations({ book }: { book: Book }) {
  const [params, setParams] = useSearchParams();
  const edit = params.get('edit'),
    target = book.destinations.find((d) => d.id === edit) ?? null;
  const healthy = book.destinations.filter((d) => d.enabled && d.policy === 'healthy').length;
  const setEdit = (id: string) => setParams({ edit: id });
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / CONNECTIONS"
        title="Destinations"
        description="Control how partners receive events. Every configuration change has a reason."
        actions={
          <button
            className="button primary"
            disabled={book.destinations.length >= 24}
            onClick={() => setEdit('new')}
          >
            <Plus size={17} />
            Add destination
          </button>
        }
      />
      <div className="destination-summary">
        <span>
          <Cable size={16} />
          <strong>{book.destinations.length}</strong>destinations
        </span>
        <span>
          <i className="health-dot good" />
          <strong>{healthy}</strong>healthy policies
        </span>
        <span>
          <i className="health-dot off" />
          <strong>{book.destinations.filter((d) => !d.enabled).length}</strong>paused
        </span>
        <span className="destination-summary-right">
          <ShieldCheck size={14} />
          HTTPS labels · simulated dispatch
        </span>
      </div>
      <div className="destination-grid">
        {book.destinations.map((d, index) => {
          const deliveries = book.deliveries.filter((item) => item.destinationId === d.id),
            delivered = deliveries.filter((item) => item.status === 'delivered').length,
            failed = deliveries.filter((item) => item.status === 'failed').length;
          return (
            <section
              key={d.id}
              className={`panel destination-card ${!d.enabled ? 'destination-paused' : ''}`}
              aria-labelledby={`name-${d.id}`}
            >
              <div className="destination-card-top">
                <span className={`destination-avatar dest-${index % 4}`}>
                  <Cable size={23} />
                </span>
                <Badge status={d.enabled ? d.policy : 'paused'}>
                  {d.enabled ? policyNames[d.policy] : 'Paused'}
                </Badge>
                <button
                  className="icon-button"
                  aria-label={`Configure ${d.name}`}
                  onClick={() => setEdit(d.id)}
                >
                  <Settings2 size={17} />
                </button>
              </div>
              <h2 id={`name-${d.id}`}>{d.name}</h2>
              <p className="destination-description">
                {d.description || 'Custom event destination'}
              </p>
              <div className="endpoint-url">
                <span>POST</span>
                <code>{d.url.replace('https://', '')}</code>
                <ShieldCheck size={13} />
              </div>
              <div className="destination-stats">
                <div>
                  <span>Recorded events</span>
                  <strong>{number(deliveries.length)}</strong>
                </div>
                <div>
                  <span>Acknowledged</span>
                  <strong>
                    {deliveries.length
                      ? ((delivered / deliveries.length) * 100).toFixed(1)
                      : '0'}
                    <small>%</small>
                  </strong>
                </div>
                <div>
                  <span>Failures</span>
                  <strong className={failed ? 'text-coral' : ''}>{number(failed)}</strong>
                </div>
              </div>
              <div className="destination-progress" aria-hidden="true">
                <span
                  style={{
                    width: `${deliveries.length ? (delivered / deliveries.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="destination-policy">
                <span>
                  <Zap size={13} />
                  {d.subscriptions.length} subscriptions
                </span>
                <span>
                  <Clock3 size={13} />
                  {d.latencyMs} ms
                </span>
                <span>{d.maxAttempts} attempts max</span>
              </div>
              <div className="destination-card-footer">
                <button className="text-link" onClick={() => setEdit(d.id)}>
                  Configure
                  <ChevronRight size={13} />
                </button>
                <Link to={`/deliveries?destination=${d.id}`}>
                  View events
                  <ChevronRight size={13} />
                </Link>
                <span className="mono">rev {d.revision}</span>
              </div>
            </section>
          );
        })}
      </div>
      <div className="info-panel">
        <div>
          <ShieldCheck size={21} />
        </div>
        <div>
          <h3>Configuration with a paper trail</h3>
          <p>
            Updates use a revision check to protect changes made in another tab. Response
            policies affect future claims; recorded attempts remain in history. Fictional
            partner endpoints are never contacted.
          </p>
        </div>
      </div>
      {edit && (target || edit === 'new') && (
        <DestinationEditor
          key={`${edit}-${book.generation}`}
          book={book}
          target={target}
          onClose={() => setParams({}, { replace: true })}
        />
      )}
    </>
  );
}
