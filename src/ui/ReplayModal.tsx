import { useState } from 'react';
import { ArrowRight, CheckCircle2, Layers3, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Book } from '../core/model';
import { planReplay } from '../core/model';
import { runtime } from '../core/runtime';
import { ErrorNote, LoadingButton, Modal } from './primitives';
import { errorMessage } from './format';
export function ReplayModal({
  book,
  ids,
  onClose,
}: {
  book: Book;
  ids: string[];
  onClose: () => void;
}) {
  const [plan, setPlan] = useState(() => planReplay(book, ids)),
    [reason, setReason] = useState(''),
    [rate, setRate] = useState(2),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const unavailable = plan.eligible.filter((id) => {
    const item = book.deliveries.find((d) => d.id === id);
    return (
      book.destinations.find((d) => d.id === item?.destinationId)?.policy === 'unavailable'
    );
  }).length;
  return (
    <Modal
      title="Review replay plan"
      subtitle="Eligibility is checked again atomically when this plan is saved."
      onClose={onClose}
      busy={busy}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          setBusy(true);
          void runtime
            .createReplay(plan, reason, rate)
            .then((id) => {
              onClose();
              void navigate(`/runs?run=${id}`);
            })
            .catch((e: unknown) => setError(errorMessage(e)))
            .finally(() => setBusy(false));
        }}
      >
        <div className="modal-body">
          <div className="plan-flow">
            <div>
              <Layers3 size={20} />
              <strong>{plan.ids.length}</strong>
              <span>selected</span>
            </div>
            <ArrowRight size={18} />
            <div className="plan-good">
              <CheckCircle2 size={20} />
              <strong>{plan.eligible.length}</strong>
              <span>eligible</span>
            </div>
            <ArrowRight size={18} />
            <div className="plan-blocked">
              <ShieldCheck size={20} />
              <strong>{plan.blocked.length}</strong>
              <span>blocked safely</span>
            </div>
          </div>
          {plan.blocked.length > 0 && (
            <div className="blocked-list">
              <h3>Excluded from this run</h3>
              {plan.blocked.slice(0, 8).map((item) => (
                <div key={item.deliveryId}>
                  <code>
                    {book.deliveries.find((d) => d.id === item.deliveryId)?.eventId ??
                      item.deliveryId}
                  </code>
                  <span>{item.reason}</span>
                </div>
              ))}
              {plan.blocked.length > 8 && (
                <p>And {plan.blocked.length - 8} more excluded records.</p>
              )}
            </div>
          )}
          {unavailable > 0 && (
            <div className="warning-note">
              <TriangleAlert size={17} />
              <p>
                {unavailable} eligible {unavailable === 1 ? 'event has' : 'events have'} an
                unavailable response policy. They can be replayed, but the simulator will return
                503 until the destination is updated.
              </p>
            </div>
          )}
          <div className="form-grid">
            <label className="field field-wide">
              Reason for replay
              <textarea
                required
                minLength={4}
                maxLength={240}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Destination recovered after configuration review"
              />
              <small>Saved with the run and included in exported evidence.</small>
            </label>
            <label className="field">
              Maximum dispatch rate
              <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'event' : 'events'} / second
                  </option>
                ))}
              </select>
              <small>One attempt per run in flight. Retries may lower throughput.</small>
            </label>
            <div className="field">
              <span>Delivery safety</span>
              <p className="form-static">
                <ShieldCheck size={16} />
                Event identity · active-run reservation · contract validation
              </p>
            </div>
          </div>
          {error && (
            <>
              <ErrorNote>{error}</ErrorNote>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setPlan(planReplay(book, ids));
                  setError('');
                }}
              >
                Refresh eligibility
              </button>
            </>
          )}
          <p className="local-disclosure">
            Local simulation only. No external HTTP requests are sent. The browser must be open
            for pending attempts to continue.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <LoadingButton
            className="button primary"
            busy={busy}
            disabled={!plan.eligible.length}
          >
            Queue {plan.eligible.length}{' '}
            {plan.eligible.length === 1 ? 'delivery' : 'deliveries'}
            <ArrowRight size={15} />
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}
