import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileClock,
  Layers3,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Book, Run } from '../core/model';
import { isTerminal, shortTime } from '../core/model';
import { runtime } from '../core/runtime';
import {
  Badge,
  Empty,
  ErrorNote,
  ExportButton,
  LoadingButton,
  Modal,
  PageHeader,
} from '../ui/primitives';
import { date, errorMessage } from '../ui/format';
function CancelRun({ run, onClose }: { run: Run; onClose: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title="Cancel remaining deliveries?"
      subtitle={`${run.label} · completed items are preserved.`}
      onClose={onClose}
      busy={busy}
    >
      <div className="modal-body">
        <p>
          Unfinished items will be marked cancelled. Outstanding responses cannot apply after
          cancellation. Failed records can be reviewed in a new replay plan.
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
      <div className="modal-footer">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Keep run
        </button>
        <LoadingButton
          className="button danger"
          busy={busy}
          onClick={() => {
            setBusy(true);
            void runtime
              .control(run.id, 'cancel')
              .then(onClose)
              .catch((e: unknown) => setError(errorMessage(e)))
              .finally(() => setBusy(false));
          }}
        >
          Cancel remaining
        </LoadingButton>
      </div>
    </Modal>
  );
}
export function Runs({ book }: { book: Book }) {
  const [params, setParams] = useSearchParams(),
    [cancel, setCancel] = useState<Run | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const run = book.runs.find((r) => r.id === params.get('run')) ?? book.runs[0],
    active = book.runs.filter((r) => r.status === 'running' || r.status === 'paused').length;
  const counts = run
    ? {
        done: run.items.filter(isTerminal).length,
        delivered: run.items.filter((i) => i.status === 'delivered').length,
        failed: run.items.filter((i) => i.status === 'failed').length,
      }
    : null;
  const control = (action: 'pause' | 'resume') => {
    if (!run) return;
    setBusy(true);
    setError('');
    void runtime
      .control(run.id, action)
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / RECOVERY"
        title="Replay runs"
        description="Controlled recovery with durable progress, bounded retries and a clear record."
        actions={
          run ? (
            <ExportButton book={book} run={run} />
          ) : (
            <Link to="/deliveries?status=failed" className="button primary">
              <RotateCcw size={15} />
              Review failed events
            </Link>
          )
        }
      />
      <div className="runs-summary">
        <span>
          <Layers3 size={16} />
          <strong>{book.runs.length}</strong>runs in history
        </span>
        <span className="status-dot" />
        <span>{active} active</span>
        <span className="subtle">Up to 8 active · latest 40 retained</span>
      </div>
      {!run ? (
        <section className="panel">
          <Empty
            title="Recovery starts with a reviewed plan"
            description="Select failed events from the delivery queue, inspect what is eligible, then queue a run. Its real progress will appear here."
            action={
              <Link className="button primary" to="/deliveries?status=failed">
                Investigate failed deliveries
                <ArrowRight size={15} />
              </Link>
            }
          />
          <div className="empty-run-features">
            <span>
              <ShieldCheck size={19} />
              Identity checks
            </span>
            <span>
              <Pause size={19} />
              Pause & resume
            </span>
            <span>
              <FileClock size={19} />
              Exportable evidence
            </span>
          </div>
        </section>
      ) : (
        <div className="runs-layout">
          <aside className="panel run-list" aria-label="Replay history">
            {book.runs.map((r) => {
              const done = r.items.filter(isTerminal).length;
              return (
                <button
                  key={r.id}
                  className={r.id === run.id ? 'run-list-item is-active' : 'run-list-item'}
                  onClick={() => setParams({ run: r.id }, { replace: true })}
                >
                  <div>
                    <span className="run-list-symbol">
                      <RotateCcw size={16} />
                    </span>
                    <strong>{r.label}</strong>
                    <span>{shortTime(r.createdAt).slice(0, 5)}</span>
                  </div>
                  <div>
                    <Badge status={r.status} />
                    <span>
                      {done}/{r.items.length} processed
                    </span>
                  </div>
                  <div className="mini-progress">
                    <span style={{ width: `${(done / r.items.length) * 100}%` }} />
                  </div>
                </button>
              );
            })}
          </aside>
          <section className="panel run-detail" aria-labelledby="run-heading">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">
                  {run.source === 'replay' ? 'REPLAY RUN' : 'CONTRACT PLAYGROUND'}
                </div>
                <h2 id="run-heading">{run.label}</h2>
                <p>
                  {date(run.createdAt)} · max {run.rate} events/s
                </p>
              </div>
              <Badge status={run.status} />
            </div>
            <div className="run-reason">
              <span>REASON</span>
              <p>{run.reason}</p>
            </div>
            <div className="run-progress-section">
              <div className="run-progress-label">
                <strong>
                  {counts!.done}
                  <span> / {run.items.length} processed</span>
                </strong>
                <span>{Math.round((counts!.done / run.items.length) * 100)}%</span>
              </div>
              <div className="run-progress-bar">
                <span style={{ width: `${(counts!.done / run.items.length) * 100}%` }} />
              </div>
              <div className="run-outcomes">
                <span>
                  <i className="health-dot good" />
                  {counts!.delivered} delivered
                </span>
                <span>
                  <i className="health-dot error" />
                  {counts!.failed} failed
                </span>
                <span>
                  <i className="health-dot off" />
                  {run.items.length - counts!.done} remaining
                </span>
              </div>
            </div>
            {(run.status === 'running' || run.status === 'paused') && (
              <div className="run-controls">
                <LoadingButton
                  className="button secondary"
                  busy={busy}
                  onClick={() => control(run.status === 'paused' ? 'resume' : 'pause')}
                >
                  {run.status === 'paused' ? <Play size={15} /> : <Pause size={15} />}
                  {run.status === 'paused' ? 'Resume run' : 'Pause run'}
                </LoadingButton>
                <button className="button ghost" onClick={() => setCancel(run)}>
                  <Square size={13} />
                  Cancel remaining
                </button>
                <span>
                  {run.status === 'paused'
                    ? 'The in-flight attempt may finish.'
                    : 'Keep a workspace tab open to dispatch pending attempts.'}
                </span>
              </div>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}
            {run.status === 'completed' && (
              <div className="run-complete">
                <CheckCircle2 size={18} />
                <strong>Run completed</strong>
                <span>Every item has a recorded outcome.</span>
              </div>
            )}
            <div className="run-items">
              <div className="run-items-heading">
                <h3>Delivery outcomes</h3>
                <span>{run.items.length} items</span>
              </div>
              {run.items.map((item) => {
                const delivery = book.deliveries.find((d) => d.id === item.deliveryId)!;
                return (
                  <div key={item.deliveryId} className="run-item">
                    <div>
                      <Link to={`/deliveries?inspect=${delivery.id}`} className="mono">
                        {delivery.eventId}
                        <ArrowRight size={12} />
                      </Link>
                      <span>
                        {book.destinations.find((d) => d.id === delivery.destinationId)?.name} ·{' '}
                        {delivery.type}
                      </span>
                    </div>
                    <Badge status={item.status} />
                    <span className="mono">
                      {item.tries} {item.tries === 1 ? 'try' : 'tries'}
                    </span>
                    <p>
                      {item.result ||
                        (item.status === 'working'
                          ? 'Waiting for simulated acknowledgement'
                          : 'Waiting for dispatch')}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="run-technical">
              <ShieldCheck size={14} />
              <span>
                Atomic browser claims · expiring leases · stale acknowledgements ignored
              </span>
            </div>
          </section>
        </div>
      )}
      <p className="local-disclosure run-disclosure">
        Runs are stored in IndexedDB on this browser. Closing all tabs pauses dispatch;
        reopening recovers pending work. This is an independent simulator, not a production
        delivery service.
      </p>
      {cancel && <CancelRun run={cancel} onClose={() => setCancel(null)} />}
    </>
  );
}
