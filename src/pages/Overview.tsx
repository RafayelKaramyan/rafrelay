import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Layers3,
  ShieldCheck,
  TerminalSquare,
  TriangleAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMetrics, isTerminal, shortTime } from '../core/model';
import type { Book } from '../core/model';
import { Badge, Empty, ExportButton } from '../ui/primitives';
import { number, policyNames } from '../ui/format';
import { DeliveryChart } from '../ui/charts';
import { RoutingMap } from '../ui/RoutingMap';

export function Overview({ book }: { book: Book }) {
  const m = getMetrics(book);
  const ledger = book.destinations.find((d) => d.id === 'dest_ledger');
  const ledgerFailures = book.deliveries.filter(
    (d) => d.destinationId === 'dest_ledger' && d.status === 'failed',
  );
  const active = book.runs.filter((r) => r.status === 'running' || r.status === 'paused');
  return (
    <>
      <div className="page-heading observatory-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            YOUR DELIVERY OBSERVATORY
          </div>
          <h1 tabIndex={-1}>
            Every event.<span>Accounted for.</span>
          </h1>
        </div>
        <div className="observatory-intro">
          <p>
            See the whole journey.
            <br /> Find the failure. Make the recovery.
          </p>
          <div className="heading-actions">
            <Link className="button primary" to="/playground">
              <TerminalSquare size={16} />
              Send a test event
              <ArrowUpRight size={15} />
            </Link>
            <ExportButton book={book} />
          </div>
        </div>
      </div>
      <div className="metric-ribbon" aria-label="Recorded delivery metrics">
        <div className="ribbon-metric">
          <span>Delivery success</span>
          <strong>
            {m.success.toFixed(1)}
            <small>%</small>
          </strong>
          <span className="ribbon-detail">
            {number(m.delivered)} acknowledged / {number(m.total)}
          </span>
        </div>
        <Link className="ribbon-metric ribbon-attention" to="/deliveries?status=failed">
          <span>
            Needs attention
            <ArrowUpRight size={15} />
          </span>
          <strong>
            {number(m.failed)}
            <i className="metric-pin" />
          </strong>
          <span className="ribbon-detail">Investigate failed deliveries</span>
        </Link>
        <div className="ribbon-metric">
          <span>
            Response latency · p95
            <Clock3 size={14} />
          </span>
          <strong>
            {m.p95}
            <small>ms</small>
          </strong>
          <span className="ribbon-detail">Across {number(m.attempts)} simulated attempts</span>
        </div>
        <Link className="ribbon-metric" to="/runs">
          <span>
            Active replay runs
            <ArrowUpRight size={15} />
          </span>
          <strong>
            {m.active.toString().padStart(2, '0')}
            <Layers3 size={24} />
          </strong>
          <span className="ribbon-detail">{book.runs.length} total in history</span>
        </Link>
      </div>
      <RoutingMap book={book} />
      {active.length > 0 && (
        <section className="active-strip" aria-label="Active replay runs">
          <span className="live-orb" />
          <strong>{active[0]!.label}</strong>
          <span>
            {active[0]!.items.filter(isTerminal).length} / {active[0]!.items.length} processed
          </span>
          <Badge status={active[0]!.status} />
          <Link to={`/runs?run=${active[0]!.id}`}>
            Follow this run
            <ArrowRight size={14} />
          </Link>
        </section>
      )}
      <div className="observatory-bottom">
        <section className="incident-report" aria-labelledby="attention-heading">
          <div className="report-heading">
            <span className="section-index">02 / RECOVERY DESK</span>
            <span className="report-count">{m.failed} open</span>
          </div>
          {ledgerFailures.length > 0 ? (
            <>
              <div className="incident-title">
                <TriangleAlert size={24} />
                <h2 id="attention-heading">
                  A connection worth
                  <br />a closer look.
                </h2>
              </div>
              <div className="incident-status">
                <strong>{ledgerFailures.length} deliveries need recovery</strong>
                <Badge status={ledger?.policy ?? 'failed'}>
                  {ledger?.enabled ? policyNames[ledger.policy] : 'Destination paused'}
                </Badge>
              </div>
              <p>
                Ledger Relay has recorded failures. Review its response policy, inspect the
                payloads, then replay the eligible events with a reason.
              </p>
              <Link
                to="/deliveries?status=failed&destination=dest_ledger"
                className="incident-action"
              >
                <span>
                  Investigate Ledger Relay<small>HTTP 503 / 422 · saved attempt history</small>
                </span>
                <ArrowUpRight size={23} />
              </Link>
            </>
          ) : (
            <>
              <h2 id="attention-heading" className="sr-only">
                Ledger recovery
              </h2>
              <Empty
                title="Ledger queue recovered"
                description="Replay outcomes are reflected in the workspace. Other failures can still be investigated."
                action={
                  <Link to="/deliveries?status=failed" className="text-link">
                    View remaining failures
                    <ArrowRight size={14} />
                  </Link>
                }
              />
            </>
          )}
          <ol className="workflow-strip">
            <li>
              <span>01</span>Inspect
              <ArrowRight size={13} aria-hidden="true" />
            </li>
            <li>
              <span>02</span>Configure
              <ArrowRight size={13} aria-hidden="true" />
            </li>
            <li>
              <span>03</span>Replay
            </li>
          </ol>
        </section>
        <section className="traffic-report" aria-labelledby="traffic-heading">
          <div className="report-heading">
            <span className="section-index">03 / RECORDED HOUR</span>
            <Link to="/deliveries" aria-label="Explore recorded deliveries">
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <h2 id="traffic-heading">The shape of your traffic.</h2>
          <p className="report-description">Event volume across the recorded hour.</p>
          <DeliveryChart book={book} />
        </section>
      </div>
      <section className="activity-report" aria-labelledby="activity-heading">
        <div className="activity-heading">
          <span className="section-index">04 / WORKSPACE JOURNAL</span>
          <h2 id="activity-heading">A record of your decisions.</h2>
          <p>Configuration changes and replay requests, saved with their reasons.</p>
        </div>
        {book.activity.length ? (
          <div className="activity-list">
            {book.activity.slice(0, 4).map((a) => (
              <div key={a.id}>
                <span className={`activity-point activity-${a.kind}`} />
                <time>{shortTime(a.at).slice(0, 5)}</time>
                <div>
                  <strong>{a.title}</strong>
                  <p>{a.detail}</p>
                </div>
                <ArrowUpRight size={14} aria-hidden="true" />
              </div>
            ))}
          </div>
        ) : (
          <div className="activity-start">
            <Activity size={24} />
            <div>
              <strong>Your next decision starts the story.</strong>
              <p>Review a destination or queue a replay. Its reason will appear here.</p>
              <Link to="/deliveries?status=failed" className="text-link">
                Open delivery queue
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </section>
      <div className="scope-footer">
        <span>
          <ShieldCheck size={14} />
          Independent portfolio product · fictional partners · local delivery simulator
        </span>
        <span>Built for the whole journey.</span>
      </div>
    </>
  );
}
