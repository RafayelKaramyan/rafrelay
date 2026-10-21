import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Braces,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book, EventType } from '../core/model';
import { eventTypes, samplePayload, uuid, validatePayload } from '../core/model';
import { downloadJson, runtime } from '../core/runtime';
import { Badge, ErrorNote, LoadingButton, PageHeader } from '../ui/primitives';
import { errorMessage } from '../ui/format';
const newPayload = (type: EventType) =>
  samplePayload(type, `evt_test_${uuid().replaceAll('-', '').slice(0, 16)}`);
export function Playground({ book }: { book: Book }) {
  const [raw, setRaw] = useState(() => newPayload('fixture.updated')),
    [type, setType] = useState<EventType>('fixture.updated'),
    [destination, setDestination] = useState('dest_match'),
    [reviewed, setReviewed] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [runId, setRunId] = useState('');
  const validation = useMemo(() => validatePayload(raw), [raw]);
  const isReviewed = reviewed === raw,
    valid = isReviewed && validation.ok;
  const target = book.destinations.find((d) => d.id === destination);
  const run = book.runs.find((r) => r.id === runId);
  const loadExample = (nextType: EventType) => {
    setType(nextType);
    setRaw(newPayload(nextType));
    setReviewed('');
    setError('');
  };
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / DEVELOPER TOOLS"
        title="Contract playground"
        description="Shape an event, validate its contract, then follow a simulated delivery end to end."
        actions={
          <button
            className="button secondary"
            onClick={() => {
              const checked = validatePayload(raw);
              if (checked.ok) downloadJson('rafrelay-event.json', checked.event);
              else {
                setReviewed(raw);
                setError('Fix the contract before exporting a JSON event.');
              }
            }}
          >
            <ArrowDownToLine size={15} />
            Export event
          </button>
        }
      />
      <div className="playground-layout">
        <section className="panel editor-panel" aria-labelledby="editor-heading">
          <div className="editor-top">
            <div>
              <Code2 size={18} />
              <h2 id="editor-heading">Event payload</h2>
              <span className="subtle-chip">JSON</span>
            </div>
            <button className="text-link" onClick={() => loadExample(type)}>
              <RefreshCw size={13} />
              Fresh example
            </button>
          </div>
          <div className="example-toolbar">
            <span>Load example</span>
            <select
              aria-label="Example event type"
              value={type}
              onChange={(e) => loadExample(e.target.value as EventType)}
            >
              {eventTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <span className="schema-label">
              <Braces size={13} />
              event.v1
            </span>
          </div>
          <div className="json-editor">
            <div className="line-numbers" aria-hidden="true">
              {raw.split('\n').map((_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            <textarea
              aria-label="Event JSON payload"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setError('');
              }}
              maxLength={48000}
              spellCheck={false}
              wrap="off"
            />
          </div>
          <div className="editor-footer">
            <span>{raw.length.toLocaleString()} / 48,000 characters</span>
            <button
              className="button secondary"
              onClick={() => {
                setReviewed(raw);
                setError('');
              }}
            >
              <Play size={14} />
              Validate contract
            </button>
          </div>
        </section>
        <div className="playground-side">
          <section className="panel contract-panel" aria-labelledby="validation-heading">
            <div className="panel-heading">
              <div>
                <h2 id="validation-heading">Contract validation</h2>
                <p>Strict schema · explicit error paths</p>
              </div>
              <ShieldCheck size={19} className="muted-icon" />
            </div>
            {!isReviewed ? (
              <div className="validation-waiting">
                <Braces size={27} />
                <strong>Ready when you are</strong>
                <p>Validate the current JSON before adding it to the delivery queue.</p>
              </div>
            ) : (
              <div
                className={valid ? 'contract-result is-valid' : 'contract-result is-invalid'}
              >
                <div>
                  {valid ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
                  <strong>{valid ? 'Contract is valid' : 'Contract needs attention'}</strong>
                </div>
                {validation.ok ? (
                  <ul>
                    <li>
                      <Check size={14} />
                      JSON syntax is valid
                    </li>
                    <li>
                      <Check size={14} />
                      Required fields & types match
                    </li>
                    <li>
                      <Check size={14} />
                      No unknown properties
                    </li>
                  </ul>
                ) : (
                  <ul>
                    {validation.issues.map((issue) => (
                      <li key={issue}>
                        <ChevronRight size={13} />
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
          <section className="panel dispatch-panel" aria-labelledby="dispatch-heading">
            <div className="panel-heading">
              <div>
                <h2 id="dispatch-heading">Test a destination</h2>
                <p>Queue a real run in the local simulator</p>
              </div>
              <Send size={18} className="muted-icon" />
            </div>
            <div className="dispatch-body">
              <label className="field">
                Destination
                <select value={destination} onChange={(e) => setDestination(e.target.value)}>
                  {book.destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {!d.enabled ? ' · paused' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {target && (
                <div className="dispatch-target">
                  <Badge status={target.enabled ? target.policy : 'paused'} />
                  <span>
                    {target.latencyMs} ms · max {target.maxAttempts} attempts
                  </span>
                </div>
              )}
              <LoadingButton
                className="button primary dispatch-button"
                busy={busy}
                disabled={!valid || !target?.enabled}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  void runtime
                    .testEvent(raw, destination)
                    .then(setRunId)
                    .catch((e: unknown) => setError(errorMessage(e)))
                    .finally(() => setBusy(false));
                }}
              >
                <Send size={15} />
                Queue test event
                <ArrowRight size={15} />
              </LoadingButton>
              {error && <ErrorNote>{error}</ErrorNote>}
              {run && (
                <div className="test-run-result">
                  <div>
                    <strong>Test event queued</strong>
                    <Badge status={run.status} />
                  </div>
                  <p>
                    {run.items[0]?.result || 'Waiting for the worker to dispatch this event.'}
                  </p>
                  <Link to={`/runs?run=${run.id}`}>
                    Follow delivery run
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
              <p className="local-disclosure">
                No outbound requests, credentials or real partner data. A unique event ID is
                required for each destination.
              </p>
            </div>
          </section>
        </div>
      </div>
      <section className="contract-guide" aria-label="Event contract fields">
        <div>
          <span>01</span>
          <strong>Identify</strong>
          <p>
            Unique <code>event_id</code> and a supported <code>type</code>.
          </p>
        </div>
        <div>
          <span>02</span>
          <strong>Describe</strong>
          <p>ISO timestamp, schema version and fixture data.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Verify</strong>
          <p>Validate, queue, inspect and export the outcome.</p>
        </div>
      </section>
    </>
  );
}
