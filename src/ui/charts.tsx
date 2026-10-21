import { useId, useMemo } from 'react';
import type { Book } from '../core/model';
import { shortTime } from '../core/model';
import { number } from './format';

export function DeliveryChart({ book }: { book: Book }) {
  const gradient = useId().replace(/:/g, '');
  const data = useMemo(() => {
    const end = Math.floor(book.createdAt / 60000) * 60000 + 1,
      start = end - 3600000;
    return Array.from({ length: 30 }, (_, i) => {
      const from = start + i * 120000,
        to = from + 120000;
      const items = book.deliveries.filter((d) => d.createdAt >= from && d.createdAt < to);
      return {
        at: from,
        total: items.length,
        failed: items.filter((d) => d.status === 'failed').length,
      };
    });
  }, [book]);
  const width = 780,
    height = 150,
    max = Math.ceil(Math.max(60, ...data.map((d) => d.total)) / 20) * 20;
  const point = (i: number, value: number) =>
    `${((i / (data.length - 1)) * width).toFixed(1)},${(height - (value / max) * (height - 15)).toFixed(1)}`;
  const line = data.map((d, i) => point(i, d.total)).join(' ');
  return (
    <div className="delivery-chart">
      <div className="chart-summary">
        <div>
          <strong>{number(data.reduce((sum, bucket) => sum + bucket.total, 0))}</strong>
          <span>recorded events</span>
        </div>
        <div className="chart-legend">
          <span>
            <i className="legend-delivered" />
            Received
          </span>
          <span>
            <i className="legend-failed" />
            Failed
          </span>
        </div>
      </div>
      <svg
        viewBox="-38 -8 826 174"
        role="img"
        aria-label="Recorded event volume in two-minute buckets over the seeded hour. Failures are highlighted as bars."
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7776ee" stopOpacity=".22" />
            <stop offset="100%" stopColor="#7776ee" stopOpacity=".01" />
          </linearGradient>
        </defs>
        {[0, max * 0.25, max * 0.5, max * 0.75].map((n) => (
          <g key={n}>
            <line
              x1="0"
              x2={width}
              y1={height - (n / max) * (height - 15)}
              y2={height - (n / max) * (height - 15)}
              stroke="#e9eaf2"
              strokeDasharray="3 5"
            />
            <text
              x="-11"
              textAnchor="end"
              y={height - (n / max) * (height - 15) + 4}
              fill="#626d85"
              fontSize="10"
            >
              {n}
            </text>
          </g>
        ))}
        <polygon points={`0,${height} ${line} ${width},${height}`} fill={`url(#${gradient})`} />
        <polyline
          points={line}
          fill="none"
          stroke="#6868dd"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {data.map((d, i) => (
          <rect
            key={i}
            x={(i / (data.length - 1)) * width - 3}
            y={height - (d.failed / max) * (height - 15)}
            width="6"
            height={(d.failed / max) * (height - 15)}
            rx="2"
            fill="#df8e89"
          />
        ))}
        {[0, 7, 14, 21, 29].map((i) => (
          <text
            key={i}
            x={(i / (data.length - 1)) * width}
            y="169"
            textAnchor={i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}
            fill="#626d85"
            fontSize="10"
          >
            {shortTime(data[i]!.at).slice(0, 5)}
          </text>
        ))}
      </svg>
      <p className="chart-caption">
        Recorded hour at workspace creation · counts update when deliveries change
      </p>
    </div>
  );
}
export function Sparkline({ values, color = '#7370dc' }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0);
  return (
    <svg viewBox="0 0 100 32" className="sparkline" aria-hidden="true">
      <polyline
        points={values
          .map(
            (v, i) =>
              `${(i / (values.length - 1)) * 100},${29 - ((v - min) / (max - min)) * 25}`,
          )
          .join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
