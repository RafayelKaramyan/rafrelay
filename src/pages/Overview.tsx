import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Cable,
  CheckCircle2,
  Clock3,
  Layers3,
  Radio,
  ShieldCheck,
  TerminalSquare,
  TriangleAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMetrics, isTerminal, shortTime } from '../core/model';
import type { Book } from '../core/model';
import { Badge, Empty, ExportButton, PageHeader } from '../ui/primitives';
import { number, policyNames } from '../ui/format';
import { DeliveryChart, Sparkline } from '../ui/charts';
export function Overview({ book }: { book: Book }) {
  const m = getMetrics(book),
    ledger = book.destinations.find((d) => d.id === 'dest_ledger');
  const ledgerFailures = book.deliveries.filter(
    (d) => d.destinationId === 'dest_ledger' && d.status === 'failed',
  );
  const failures = book.deliveries.filter((d) => d.status === 'failed');
  const active = book.runs.filter((r) => r.status === 'running' || r.status === 'paused');
  const healthy = book.destinations.filter((d) => d.enabled && d.policy === 'healthy').length;
  const bucketCounts = Array.from(
    { length: 12 },
    (_, i) =>
      book.deliveries.slice(i * 150, (i + 1) * 150).filter((d) => d.status === 'delivered')
        .length,
  ).reverse();
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / OVERVIEW"
        title="Every event. Accounted for."
        description="A clear view of your integrations, from first delivery to recovery."
        actions={
          <>
            <ExportButton book={book} />
            <Link className="button primary" to="/playground">
              <TerminalSquare size={16} />
              Send a test event
            </Link>
          </>
        }
      />
      <div className="overview-intro">
        <span>
          <span className="status-dot" />
          Local workspace connected
        </span>
        <span>
          {number(book.deliveries.length)} events · {book.destinations.length} destinations
        </span>
        <span className="intro-right">
          Sandbox data <ShieldCheck size={13} />
        </span>
      </div>
      <div className="metric-grid">
        <div className="metric">
          <div className="metric-label">
            Delivery success
            <CheckCircle2 size={16} />
          </div>
          <div className="metric-bottom">
            <strong>
              {m.success.toFixed(1)}
              <small>%</small>
            </strong>
            <Sparkline values={bucketCounts} />
          </div>
          <p>
            <span className="metric-green">{number(m.delivered)} acknowledged</span>
            <span>of {number(m.total)}</span>
          </p>
        </div>
        <div className="metric">
          <div className="metric-label">
            Needs attention
            <TriangleAlert size={16} />
          </div>
          <div className="metric-bottom">
            <strong>{number(m.failed)}</strong>
            <div className="tiny-bars">
              {[18, 27, 15, 32, 21, 38, 26, 17, 29, 19].map((n, i) => (
                <i key={i} style={{ height: n, opacity: 0.35 + i * 0.05 }} />
              ))}
            </div>
          </div>
          <p>
            <span className="metric-coral">Failed deliveries</span>
            <Link to="/deliveries?status=failed">
              Investigate <ArrowUpRight size={12} />
            </Link>
          </p>
        </div>
        <div className="metric">
          <div className="metric-label">
            Response latency · p95
            <Clock3 size={16} />
          </div>
          <div className="metric-bottom">
            <strong>
              {m.p95}
              <small>ms</small>
            </strong>
            <Sparkline
              values={book.deliveries
                .slice(0, 15)
                .map((d) => d.attempts.at(-1)?.latencyMs ?? 0)}
              color="#65a798"
            />
          </div>
          <p>
            <span>Across {number(m.attempts)} attempts</span>
            <span className="subtle">Simulated</span>
          </p>
        </div>
        <div className="metric">
          <div className="metric-label">
            Active replay runs
            <Layers3 size={16} />
          </div>
          <div className="metric-bottom">
            <strong>{m.active.toString().padStart(2, '0')}</strong>
            <div className="metric-run-icon">
              <Layers3 size={30} />
            </div>
          </div>
          <p>
            <span>{book.runs.length} total in history</span>
            <Link to="/runs">
              View runs <ArrowUpRight size={12} />
            </Link>
          </p>
        </div>
      </div>
      <div className="overview-grid">
        <section className="panel traffic-panel" aria-labelledby="traffic-heading">
          <div className="panel-heading">
            <div>
              <h2 id="traffic-heading">Delivery traffic</h2>
              <p>Recorded throughput across all destinations</p>
            </div>
            <span className="subtle-chip">Recorded hour</span>
          </div>
          <DeliveryChart book={book} />
          <div className="chart-footer">
            <span>
              <Radio size={14} />
              All event types
            </span>
            <Link to="/deliveries">
              Explore deliveries <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <section className="panel integration-panel" aria-labelledby="health-heading">
          <div className="panel-heading">
            <div>
              <h2 id="health-heading">Integration health</h2>
              <p>
                {healthy} healthy · {book.destinations.length - healthy} to review
              </p>
            </div>
            <Cable size={19} className="muted-icon" />
          </div>
          <div className="health-topology" aria-hidden="true">
            <div className="topology-source">
              <span className="mini-mark">R</span>
              <span>Event stream</span>
            </div>
            <div className="topology-trunk" />
            <div className="topology-ports">
              {book.destinations.slice(0, 4).map((d) => (
                <span
                  key={d.id}
                  className={
                    !d.enabled
                      ? 'port-off'
                      : d.policy === 'healthy'
                        ? 'port-good'
                        : d.policy === 'unavailable'
                          ? 'port-error'
                          : 'port-warn'
                  }
                />
              ))}
            </div>
          </div>
          <div className="health-list">
            {book.destinations.slice(0, 4).map((d) => (
              <Link key={d.id} to={`/destinations?edit=${d.id}`}>
                <span className={`target-icon target-${d.policy}`}>
                  <Cable size={15} />
                </span>
                <span>
                  <strong>{d.name}</strong>
                  <small>{new URL(d.url).hostname}</small>
                </span>
                <span
                  className={`health-dot ${!d.enabled ? 'off' : d.policy === 'healthy' ? 'good' : d.policy === 'unavailable' ? 'error' : 'warn'}`}
                  title={d.enabled ? policyNames[d.policy] : 'Paused'}
                />
                <ArrowUpRight size={13} />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="lower-grid">
        <section className="panel attention-panel" aria-labelledby="attention-heading">
          <div className="panel-heading">
            <div>
              <h2 id="attention-heading">On your radar</h2>
              <p>A practical starting point for this workspace</p>
            </div>
            <span className="count-label">{failures.length} open</span>
          </div>
          {ledgerFailures.length > 0 ? (
            <div className="incident">
              <div className="incident-icon">
                <TriangleAlert size={20} />
              </div>
              <div>
                <div className="incident-heading">
                  <h3>{ledgerFailures.length} deliveries need recovery</h3>
                  <Badge status={ledger?.policy ?? 'failed'}>
                    {ledger?.enabled ? policyNames[ledger.policy] : 'Destination paused'}
                  </Badge>
                </div>
                <p>
                  Ledger Relay has a queue of failed events. Review its response policy, then
                  replay eligible deliveries with a recorded reason.
                </p>
                <div className="incident-meta">
                  <span className="mono">HTTP 503 / 422</span>
                  <span>Ledger Relay</span>
                  <Link to="/deliveries?status=failed&destination=dest_ledger">
                    Investigate queue <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <Empty
              title="Ledger queue recovered"
              description="Your replay outcomes are reflected in the workspace. Other failures can still be investigated."
              action={
                <Link to="/deliveries?status=failed" className="text-link">
                  View remaining failures <ArrowRight size={14} />
                </Link>
              }
            />
          )}
          <div className="workflow-strip">
            <span>
              <i>01</i>Inspect the failure
            </span>
            <ArrowRight size={13} />
            <span>
              <i>02</i>Review destination
            </span>
            <ArrowRight size={13} />
            <span>
              <i>03</i>Replay & verify
            </span>
          </div>
        </section>
        <section className="panel activity-panel" aria-labelledby="activity-heading">
          <div className="panel-heading">
            <div>
              <h2 id="activity-heading">Workspace activity</h2>
              <p>Your configuration and replay actions</p>
            </div>
            <Activity size={18} className="muted-icon" />
          </div>
          {book.activity.length ? (
            <div className="activity-list">
              {book.activity.slice(0, 4).map((a) => (
                <div key={a.id}>
                  <span className={`activity-point activity-${a.kind}`} />
                  <div>
                    <strong>{a.title}</strong>
                    <p>{a.detail}</p>
                  </div>
                  <time>{shortTime(a.at).slice(0, 5)}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="activity-start">
              <span>
                <Activity size={23} />
              </span>
              <strong>Your workspace is ready</strong>
              <p>
                Saved changes and replay runs will appear here. Start by investigating a failed
                delivery.
              </p>
              <Link to="/deliveries?status=failed">
                Open delivery queue <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
        </section>
      </div>
      {active.length > 0 && (
        <section className="active-strip" aria-label="Active replay runs">
          <span className="live-orb" />
          <strong>{active[0]!.label}</strong>
          <span>
            {active[0]!.items.filter(isTerminal).length} / {active[0]!.items.length} processed
          </span>
          <Badge status={active[0]!.status} />
          <Link to={`/runs?run=${active[0]!.id}`}>
            Follow this run <ArrowRight size={14} />
          </Link>
        </section>
      )}
      <div className="scope-footer">
        <ShieldCheck size={14} />
        <span>
          Independent portfolio product · fictional partners · local delivery simulator
        </span>
        <span>Built for the details.</span>
      </div>
    </>
  );
}
