import { describe, expect, it } from 'vitest';
import { seedBook } from './seed';
import {
  claimWork,
  completeWork,
  controlRun,
  decodeBook,
  deliveryKey,
  eventTypes,
  getMetrics,
  planReplay,
  queueTest,
  samplePayload,
  saveDestination,
  simulate,
  startReplay,
  validatePayload,
} from './model';
import type { Book, Context, Policy, Work } from './model';
const NOW = 1770000000000;
let serial = 0;
const ctx = (now = NOW): Context => ({ now, id: () => `id_${++serial}` });
function setup(policy: Policy = 'healthy') {
  const seed = seedBook('test-generation', NOW);
  const book: Book = {
    ...seed,
    destinations: seed.destinations.map((d) => (d.id === 'dest_ledger' ? { ...d, policy } : d)),
  };
  const delivery = book.deliveries.find(
    (d) =>
      d.destinationId === 'dest_ledger' && d.status === 'failed' && validatePayload(d.body).ok,
  )!;
  return { book, delivery };
}
function queued(policy: Policy = 'healthy', count = 1) {
  const { book } = setup(policy);
  const ids = book.deliveries
    .filter(
      (d) =>
        d.destinationId === 'dest_ledger' &&
        d.status === 'failed' &&
        validatePayload(d.body).ok,
    )
    .slice(0, count)
    .map((d) => d.id);
  return startReplay(book, planReplay(book, ids), 'Destination reviewed', 2, ctx());
}
const result = (work: Work) => ({
  token: work.token,
  runId: work.runId,
  deliveryId: work.deliveryId,
  ...simulate(work),
});
function drain(initial: Book) {
  let book = initial;
  for (let i = 0; i < 420 && book.runs.some((r) => r.status === 'running'); i++) {
    const now = NOW + i * 10000,
      claimed = claimWork(book, ctx(now));
    book = claimed.book;
    if (claimed.work) book = completeWork(book, result(claimed.work), ctx(now + 1300));
  }
  return book;
}
describe('event contracts', () => {
  it.each(eventTypes)('accepts a strict %s event', (type) =>
    expect(validatePayload(samplePayload(type, 'evt_valid_001', NOW)).ok).toBe(true),
  );
  it('reports syntax errors and field paths', () => {
    expect(validatePayload('{bad')).toMatchObject({ ok: false });
    const payload = JSON.parse(samplePayload('fixture.updated')) as {
      data: { sequence: number };
    };
    payload.data.sequence = -1;
    const parsed = validatePayload(JSON.stringify(payload));
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join(' ')).toContain('data.sequence');
  });
  it('rejects unknown properties and oversized input', () => {
    const payload = { ...JSON.parse(samplePayload('fixture.updated')), secret: 'unexpected' };
    expect(validatePayload(JSON.stringify(payload)).ok).toBe(false);
    expect(validatePayload('x'.repeat(48001)).issues[0]).toContain('48,000');
  });
  it('preserves invalid seeded events for investigation', () => {
    const b = seedBook('seed', NOW);
    expect(() => decodeBook(b)).not.toThrow();
    expect(b.deliveries.some((d) => !validatePayload(d.body).ok && d.status === 'failed')).toBe(
      true,
    );
    expect(getMetrics(b).total).toBe(1800);
  });
  it('rejects duplicate identifiers and missing references on load', () => {
    const { book, delivery } = setup();
    expect(() => decodeBook({ ...book, deliveries: [delivery, delivery] })).toThrow(
      'duplicate',
    );
    expect(() =>
      decodeBook({ ...book, deliveries: [{ ...delivery, destinationId: 'missing' }] }),
    ).toThrow('references');
  });
});
describe('reviewed replay plans', () => {
  it('excludes delivered, invalid and paused records with explicit reasons', () => {
    const { book } = setup();
    const delivered = book.deliveries.find((d) => d.status === 'delivered')!,
      invalid = book.deliveries.find((d) => !validatePayload(d.body).ok)!,
      paused = book.deliveries.find(
        (d) => d.status === 'failed' && d.destinationId === 'dest_archive',
      )!;
    const plan = planReplay(book, [delivered.id, invalid.id, paused.id]);
    expect(plan.eligible).toEqual([]);
    expect(plan.blocked.map((b) => b.reason)).toEqual([
      'Already delivered',
      'Contract validation failed',
      'Destination is paused',
    ]);
  });
  it('rejects a stale destination review atomically', () => {
    const { book, delivery } = setup(),
      plan = planReplay(book, [delivery.id]),
      destination = book.destinations[0]!;
    const changed = saveDestination(
      book,
      { ...destination, latencyMs: 720 },
      0,
      book.generation,
      'Latency reviewed',
      ctx(),
    );
    expect(() => startReplay(changed, plan, 'Recover events', 2, ctx())).toThrow(
      'plan changed',
    );
  });
  it('allows unrelated edits without invalidating an otherwise current plan', () => {
    const { book, delivery } = setup(),
      plan = planReplay(book, [delivery.id]),
      destination = book.destinations[1]!;
    const changed = saveDestination(
      book,
      { ...destination, latencyMs: 720 },
      0,
      book.generation,
      'Latency reviewed',
      ctx(),
    );
    expect(startReplay(changed, plan, 'Recover events', 2, ctx()).book.runs).toHaveLength(1);
  });
  it('rejects empty, duplicate and oversized selection', () => {
    const { book, delivery } = setup();
    for (const ids of [
      [],
      [delivery.id, delivery.id],
      Array.from({ length: 101 }, (_, i) => String(i)),
    ])
      expect(() => planReplay(book, ids)).toThrow('between 1 and 100');
  });
  it('rejects mismatched event identity and unsupported subscriptions', () => {
    const { book, delivery } = setup();
    const mismatch = {
      ...book,
      deliveries: book.deliveries.map((d) =>
        d.id === delivery.id ? { ...d, eventId: 'evt_different_001' } : d,
      ),
    };
    expect(planReplay(mismatch, [delivery.id]).blocked[0]?.reason).toContain('identity');
    const unsubscribed = {
      ...book,
      destinations: book.destinations.map((d) =>
        d.id === delivery.destinationId
          ? { ...d, subscriptions: [eventTypes.find((t) => t !== delivery.type)!] }
          : d,
      ),
    };
    expect(planReplay(unsubscribed, [delivery.id]).blocked[0]?.reason).toContain(
      'not subscribed',
    );
  });
  it('reserves equivalent events across active runs and blocks duplicates in one plan', () => {
    const { book, delivery } = setup();
    const copy = { ...delivery, id: 'dlv_duplicate' };
    const withCopy = { ...book, deliveries: [...book.deliveries, copy] };
    const plan = planReplay(withCopy, [delivery.id, copy.id]);
    expect(plan.eligible).toEqual([delivery.id]);
    expect(plan.blocked[0]?.reason).toContain('Duplicate');
    const run = startReplay(withCopy, plan, 'Recover events', 1, ctx());
    expect(planReplay(run.book, [copy.id]).blocked[0]?.reason).toContain('already queued');
  });
  it('does not replay an equivalent acknowledged event', () => {
    const { book, delivery } = setup();
    const next = {
      ...book,
      deliveries: [
        ...book.deliveries,
        { ...delivery, id: 'already_delivered', status: 'delivered' as const },
      ],
    };
    expect(planReplay(next, [delivery.id]).blocked[0]?.reason).toContain('Duplicate');
  });
  it('requires a reason and bounded rate', () => {
    const { book, delivery } = setup(),
      plan = planReplay(book, [delivery.id]);
    expect(() => startReplay(book, plan, ' ', 2, ctx())).toThrow('reason');
    expect(() => startReplay(book, plan, 'Review complete', 0, ctx())).toThrow('rate');
  });
});
describe('durable replay state machine', () => {
  it('applies an acknowledged delivery once and ignores a duplicate acknowledgement', () => {
    const { book } = queued();
    const claimed = claimWork(book, ctx()),
      work = claimed.work!;
    const done = completeWork(claimed.book, result(work), ctx(NOW + 300));
    expect(done.runs[0]?.status).toBe('completed');
    expect(done.deliveries.find((d) => d.id === work.deliveryId)?.status).toBe('delivered');
    expect(completeWork(done, result(work), ctx())).toBe(done);
    expect(() => decodeBook(done)).not.toThrow();
  });
  it.each([
    ['intermittent', 2, 'delivered'],
    ['rate_limited', 3, 'delivered'],
    ['unavailable', 3, 'failed'],
  ] as const)('%s policy has bounded retries', (policy, tries, status) => {
    const { book } = queued(policy);
    const done = drain(book);
    expect(done.runs[0]?.items[0]).toMatchObject({ tries, status });
    expect(done.runs[0]?.status).toBe('completed');
  });
  it('uses backoff and respects the maximum dispatch rate', () => {
    const initial = queued('intermittent', 2).book;
    const claimed = claimWork(initial, ctx()),
      work = claimed.work!;
    const after = completeWork(claimed.book, result(work), ctx(NOW));
    expect(after.runs[0]?.items[0]?.nextAt).toBe(NOW + 400);
    expect(claimWork(after, ctx(NOW + 399)).work).toBeNull();
    expect(claimWork(after, ctx(NOW + 499)).work).toBeNull();
    expect(claimWork(after, ctx(NOW + 500)).work).not.toBeNull();
  });
  it('does not claim a second item while a lease is live', () => {
    const { book } = queued('healthy', 2);
    const claimed = claimWork(book, ctx());
    expect(claimWork(claimed.book, ctx(NOW + 2000)).work).toBeNull();
  });
  it('reclaims an expired lease and ignores the earlier response', () => {
    const { book } = queued();
    const first = claimWork(book, ctx()),
      second = claimWork(first.book, ctx(NOW + 5001));
    expect(second.work?.token).not.toBe(first.work?.token);
    expect(completeWork(second.book, result(first.work!), ctx(NOW + 5200))).toBe(second.book);
    expect(
      completeWork(second.book, result(second.work!), ctx(NOW + 5300)).runs[0]?.items[0]?.tries,
    ).toBe(1);
  });
  it('pauses future claims while allowing an in-flight acknowledgement', () => {
    const { book, runId } = queued('healthy', 2);
    const claimed = claimWork(book, ctx());
    const paused = controlRun(claimed.book, runId, 'pause', ctx());
    const ack = completeWork(paused, result(claimed.work!), ctx(NOW + 400));
    expect(ack.runs[0]?.status).toBe('paused');
    expect(claimWork(ack, ctx(NOW + 9000)).work).toBeNull();
    const resumed = controlRun(ack, runId, 'resume', ctx(NOW + 9000));
    expect(claimWork(resumed, ctx(NOW + 9000)).work).not.toBeNull();
  });
  it('invalidates leases on cancellation and preserves finished items', () => {
    const { book, runId } = queued('healthy', 2);
    const claimed = claimWork(book, ctx());
    const cancelled = controlRun(claimed.book, runId, 'cancel', ctx());
    expect(completeWork(cancelled, result(claimed.work!), ctx())).toBe(cancelled);
    expect(cancelled.runs[0]?.items.every((i) => i.status === 'cancelled')).toBe(true);
    expect(cancelled.deliveries.find((d) => d.id === claimed.work!.deliveryId)?.status).toBe(
      'failed',
    );
    expect(() => controlRun(cancelled, runId, 'resume', ctx())).toThrow('finished');
  });
  it('rechecks a destination pause at dispatch and does not retry permanent rejection', () => {
    const initial = queued().book;
    const disabled = {
      ...initial,
      destinations: initial.destinations.map((d) => ({ ...d, enabled: false })),
    };
    const claimed = claimWork(disabled, ctx());
    expect(simulate(claimed.work!).code).toBe(423);
    const done = completeWork(claimed.book, result(claimed.work!), ctx());
    expect(done.runs[0]?.items[0]).toMatchObject({ tries: 1, status: 'failed' });
  });
  it('cannot accept a second event identity even if a duplicate acknowledgement is injected', () => {
    const { book } = queued();
    const claimed = claimWork(book, ctx()),
      delivery = claimed.book.deliveries.find((d) => d.id === claimed.work!.deliveryId)!;
    const duplicate = {
      ...claimed.book,
      deliveries: [
        ...claimed.book.deliveries,
        { ...delivery, id: 'another_record', status: 'delivered' as const },
      ],
    };
    const done = completeWork(duplicate, result(claimed.work!), ctx());
    expect(done.runs[0]?.items[0]?.status).toBe('skipped');
    expect(
      done.deliveries.filter(
        (d) => deliveryKey(d) === deliveryKey(delivery) && d.status === 'delivered',
      ),
    ).toHaveLength(1);
  });
});
describe('destination and playground commands', () => {
  it('rejects stale revisions and previous workspace generations', () => {
    const { book } = setup(),
      target = book.destinations[0]!;
    expect(() =>
      saveDestination(book, target, 99, book.generation, 'Review complete', ctx()),
    ).toThrow('another tab');
    expect(() =>
      saveDestination(book, target, 0, 'old-workspace', 'Review complete', ctx()),
    ).toThrow('reset');
  });
  it('records configuration changes without rewriting recorded history', () => {
    const { book } = setup(),
      target = book.destinations[0]!;
    const next = saveDestination(
      book,
      { ...target, policy: 'healthy' },
      0,
      book.generation,
      'Service recovered',
      ctx(),
    );
    expect(next.destinations[0]?.revision).toBe(1);
    expect(next.deliveries).toBe(book.deliveries);
    expect(next.activity[0]?.detail).toBe('Service recovered');
  });
  it('rejects insecure URLs and empty subscriptions', () => {
    const { book } = setup(),
      target = book.destinations[0]!;
    expect(() =>
      saveDestination(
        book,
        { ...target, url: 'https://user:secret@example.com' },
        0,
        book.generation,
        'Review complete',
        ctx(),
      ),
    ).toThrow();
    expect(() =>
      saveDestination(
        book,
        { ...target, subscriptions: [] },
        0,
        book.generation,
        'Review complete',
        ctx(),
      ),
    ).toThrow();
  });
  it('queues validated test events and rejects the same ID for that destination', () => {
    const { book } = setup(),
      raw = samplePayload('fixture.updated', 'evt_new_test', NOW);
    const next = queueTest(book, raw, 'dest_match', ctx());
    expect(next.book.deliveries[0]).toMatchObject({
      eventId: 'evt_new_test',
      status: 'queued',
    });
    expect(next.book.runs[0]?.source).toBe('playground');
    expect(() => queueTest(next.book, raw, 'dest_match', ctx())).toThrow('already exists');
    expect(queueTest(next.book, raw, 'dest_ledger', ctx()).book.runs).toHaveLength(2);
  });
  it('enforces event and active-run capacity', () => {
    const { book } = setup();
    const full = {
      ...book,
      deliveries: Array.from({ length: 2400 }, (_, i) => ({
        ...book.deliveries[0]!,
        id: `capacity_${i}`,
      })),
    };
    expect(() =>
      queueTest(full, samplePayload('fixture.updated', 'evt_capacity'), 'dest_match', ctx()),
    ).toThrow('2,400');
    let active = book;
    for (let i = 0; i < 8; i++)
      active = queueTest(
        active,
        samplePayload('fixture.updated', `evt_capacity_${i}`),
        'dest_match',
        ctx(),
      ).book;
    expect(() =>
      queueTest(
        active,
        samplePayload('fixture.updated', 'evt_capacity_9'),
        'dest_match',
        ctx(),
      ),
    ).toThrow('Eight');
  });
});
