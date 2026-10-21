import { ArrowRight, ArrowUpRight, Braces, Cable, Radio, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book } from '../core/model';
import { number, policyNames } from './format';

export function RoutingMap({ book }: { book: Book }) {
  const targets = book.destinations.slice(0, 4);
  const healthy = book.destinations.filter((d) => d.enabled && d.policy === 'healthy').length;
  const active = book.runs.filter((r) => r.status === 'running').length;
  const paths = [
    'M 532 200 H 590 Q 630 200 630 160 V 82 Q 630 50 667 50 H 756',
    'M 532 200 H 640 Q 680 200 680 170 V 150 H 756',
    'M 532 200 H 640 Q 680 200 680 230 V 250 H 756',
    'M 532 200 H 590 Q 630 200 630 240 V 318 Q 630 350 667 350 H 756',
  ];
  return (
    <section className="routing-map" aria-labelledby="routing-heading">
      <div className="routing-heading">
        <div>
          <span className="section-index">01 / ROUTING</span>
          <h2 id="routing-heading">One stream. Every connection.</h2>
        </div>
        <div className="routing-key">
          <span>
            <i className="health-dot good" />
            {healthy} healthy
          </span>
          <span>
            <i className="health-dot warn" />
            {book.destinations.length - healthy} to review
          </span>
        </div>
      </div>
      <div className="routing-stage">
        <svg
          className="routing-lines"
          viewBox="0 0 1000 400"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className="route-track" d="M 245 200 H 457" />
          <path className="route-trace route-inbound" d="M 245 200 H 457" />
          {targets.map((d, i) => (
            <g
              key={d.id}
              className={`route-branch ${!d.enabled ? 'route-off' : d.policy === 'healthy' ? 'route-healthy' : d.policy === 'unavailable' ? 'route-failed' : 'route-review'}`}
            >
              <path className="route-track" d={paths[i]} />
              <path
                className="route-trace"
                d={paths[i]}
                style={{ animationDelay: `${i * -1.2}s` }}
              />
              <circle cx="756" cy={50 + i * 100} r="3" />
            </g>
          ))}
        </svg>
        <div className="stream-node">
          <span className="node-kicker">
            <Radio size={13} />
            EVENT SOURCE
          </span>
          <strong>
            Northline
            <br />
            event stream
          </strong>
          <span className="stream-total">
            {number(book.deliveries.length)}
            <small>recorded events</small>
          </span>
          <div className="source-types">
            <span>fixture.updated</span>
            <span>market.suspended</span>
            <span>result.confirmed</span>
          </div>
        </div>
        <div className="relay-hub">
          <div className="hub-orbit" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span className="hub-symbol" aria-hidden="true">
            <Braces size={38} strokeWidth={1.35} />
          </span>
          <strong>rafrelay</strong>
          <span>Validate. Route. Recover.</span>
          <span className="hub-state">
            <i className="status-dot" />
            {active ? `${active} dispatching` : 'Ready for dispatch'}
          </span>
        </div>
        <div className="routing-targets">
          {targets.map((d, i) => {
            const deliveries = book.deliveries.filter((item) => item.destinationId === d.id);
            const delivered = deliveries.filter((item) => item.status === 'delivered').length;
            const state = !d.enabled
              ? 'off'
              : d.policy === 'healthy'
                ? 'good'
                : d.policy === 'unavailable'
                  ? 'error'
                  : 'warn';
            return (
              <Link
                key={d.id}
                to={`/destinations?edit=${d.id}`}
                className={`routing-target routing-${state}`}
                aria-label={`${d.name} configuration · ${d.enabled ? policyNames[d.policy] : 'Paused'}`}
              >
                <span className="target-port" aria-hidden="true">
                  0{i + 1}
                </span>
                <span className="routing-target-info">
                  <strong>{d.name}</strong>
                  <small>
                    {delivered} / {deliveries.length} acknowledged
                  </small>
                </span>
                <span className="routing-target-policy">
                  <i className={`health-dot ${state}`} />
                  {d.enabled ? policyNames[d.policy] : 'Paused'}
                </span>
                <ArrowUpRight size={14} className="routing-open" />
              </Link>
            );
          })}
        </div>
      </div>
      <div className="routing-footer">
        <span>
          <ShieldCheck size={13} />
          Local simulation topology · saved configuration
        </span>
        <Link to="/destinations">
          <Cable size={14} />
          {book.destinations.length} destinations
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
