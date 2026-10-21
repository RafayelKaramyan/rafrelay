import { eventTypes, samplePayload } from './model';
import type { Book, Delivery, Destination } from './model';

export function seedBook(generation: string, now = Date.now()): Book {
  const destinations: Destination[] = [
    {
      id: 'dest_ledger',
      name: 'Ledger Relay',
      url: 'https://ledger.northline.example/events',
      description: 'Result confirmations & account reconciliation',
      enabled: true,
      policy: 'unavailable',
      latencyMs: 360,
      maxAttempts: 3,
      subscriptions: [...eventTypes],
      revision: 0,
    },
    {
      id: 'dest_match',
      name: 'Match Centre',
      url: 'https://match.northline.example/webhooks',
      description: 'Live fixture updates for the match experience',
      enabled: true,
      policy: 'healthy',
      latencyMs: 180,
      maxAttempts: 3,
      subscriptions: [...eventTypes],
      revision: 0,
    },
    {
      id: 'dest_pulse',
      name: 'Pulse Analytics',
      url: 'https://pulse.northline.example/ingest',
      description: 'Event analytics & reporting pipeline',
      enabled: true,
      policy: 'intermittent',
      latencyMs: 280,
      maxAttempts: 3,
      subscriptions: [...eventTypes],
      revision: 0,
    },
    {
      id: 'dest_archive',
      name: 'Archive Bridge',
      url: 'https://archive.northline.example/receive',
      description: 'Long-term event archive',
      enabled: false,
      policy: 'healthy',
      latencyMs: 160,
      maxAttempts: 2,
      subscriptions: [...eventTypes],
      revision: 0,
    },
  ];
  const end = Math.floor(now / 60000) * 60000;
  const deliveries: Delivery[] = [];
  let cumulative = 0;
  const positions = Array.from({ length: 1800 }, (_, i) => {
    const position = cumulative;
    cumulative += 1.1 + 0.65 * Math.sin(i / 95) + 0.3 * Math.cos(i / 37);
    return position;
  });
  for (let i = 0; i < 1800; i++) {
    const target = destinations[i % 4]!;
    const type = eventTypes[i % 3]!;
    const at = end - Math.floor((positions[i]! / cumulative) * 3598000);
    const failed = (target.id === 'dest_ledger' && i < 200) || i % 29 === 0;
    const eventId = `evt_${String(1800 - i).padStart(6, '0')}`;
    const broken = failed && i % 37 === 0;
    const payload = JSON.parse(samplePayload(type, eventId, at)) as Record<string, unknown>;
    if (broken) delete payload.data;
    deliveries.push({
      id: `dlv_${String(1800 - i).padStart(6, '0')}`,
      eventId,
      type,
      destinationId: target.id,
      createdAt: at,
      body: JSON.stringify(payload, null, 2),
      status: failed ? 'failed' : 'delivered',
      revision: 0,
      attempts: [
        {
          id: `att_seed_${i}`,
          at: at + 200,
          code: failed ? (broken ? 422 : 503) : 202,
          latencyMs: failed ? 340 + (i % 17) * 15 : 70 + (i % 29) * 8,
          message: failed
            ? broken
              ? 'Contract validation failed: data is missing.'
              : 'Destination returned 503 Service Unavailable.'
            : 'Event accepted and acknowledged.',
        },
      ],
    });
  }
  // The first recoverable failure is intentionally easy to investigate.
  const first = deliveries.find((d) => d.status === 'failed' && d.attempts[0]?.code === 503)!;
  const broken = deliveries.find((d) => d.status === 'failed' && d.attempts[0]?.code === 422)!;
  const other = deliveries.filter((d) => d.id !== first.id && d.id !== broken.id);
  return {
    schemaVersion: 1,
    generation,
    revision: 0,
    createdAt: now,
    destinations,
    deliveries: [first, broken, ...other],
    runs: [],
    activity: [],
    motionPaused: false,
  };
}
