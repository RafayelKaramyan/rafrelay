import { z } from 'zod';

export const eventTypes = ['fixture.updated', 'market.suspended', 'result.confirmed'] as const;
export type EventType = (typeof eventTypes)[number];
export const policies = ['healthy', 'intermittent', 'unavailable', 'rate_limited'] as const;
export type Policy = (typeof policies)[number];
const text = z.string().min(1).max(160);
const time = z.number().int().nonnegative();
const id = z.string().min(1).max(100);
export const destinationSchema = z
  .object({
    id,
    name: z.string().trim().min(3).max(48),
    url: z
      .url()
      .max(240)
      .refine((v) => v.startsWith('https://'), 'Use an HTTPS address.')
      .refine((v) => {
        try {
          const url = new URL(v);
          return !url.username && !url.password;
        } catch {
          return false;
        }
      }, 'Do not include credentials in an endpoint label.'),
    description: z.string().max(120),
    enabled: z.boolean(),
    policy: z.enum(policies),
    latencyMs: z.number().int().min(120).max(1200),
    maxAttempts: z.number().int().min(1).max(4),
    subscriptions: z.array(z.enum(eventTypes)).min(1).max(3),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type Destination = z.infer<typeof destinationSchema>;
export const eventSchema = z
  .object({
    event_id: z
      .string()
      .regex(/^evt_[a-zA-Z0-9_-]{3,64}$/, 'Use an event ID beginning with evt_.'),
    type: z.enum(eventTypes),
    schema_version: z.literal(1),
    occurred_at: z.iso.datetime(),
    data: z
      .object({
        fixture_id: z.string().min(3).max(64),
        competition: z.string().min(3).max(80),
        sequence: z.number().int().nonnegative(),
        state: z.enum(['scheduled', 'live', 'suspended', 'confirmed']),
      })
      .strict(),
  })
  .strict();
export type EventPayload = z.infer<typeof eventSchema>;
export const attemptSchema = z
  .object({
    id,
    at: time,
    code: z.number().int().min(100).max(599).nullable(),
    latencyMs: z.number().int().nonnegative().max(30000),
    message: z.string().max(240),
    runId: id.optional(),
  })
  .strict();
export type Attempt = z.infer<typeof attemptSchema>;
export const deliverySchema = z
  .object({
    id,
    eventId: id,
    type: z.enum(eventTypes),
    destinationId: id,
    createdAt: time,
    body: z.string().max(48000),
    status: z.enum(['delivered', 'failed', 'queued', 'sending']),
    attempts: z.array(attemptSchema).max(8),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type Delivery = z.infer<typeof deliverySchema>;
export const itemSchema = z
  .object({
    deliveryId: id,
    status: z.enum(['pending', 'working', 'delivered', 'failed', 'skipped', 'cancelled']),
    tries: z.number().int().nonnegative().max(4),
    nextAt: time,
    lease: id.nullable(),
    leaseUntil: time,
    result: z.string().max(240),
  })
  .strict();
export type RunItem = z.infer<typeof itemSchema>;
export const runSchema = z
  .object({
    id,
    label: text,
    reason: z.string().min(4).max(240),
    createdAt: time,
    status: z.enum(['running', 'paused', 'completed', 'cancelled']),
    source: z.enum(['replay', 'playground']),
    rate: z.number().int().min(1).max(5),
    nextAt: time,
    items: z.array(itemSchema).min(1).max(100),
  })
  .strict();
export type Run = z.infer<typeof runSchema>;
export const activitySchema = z
  .object({
    id,
    at: time,
    kind: z.enum(['configuration', 'replay', 'control', 'playground']),
    title: text,
    detail: z.string().max(360),
  })
  .strict();
export type Activity = z.infer<typeof activitySchema>;
export const bookSchema = z
  .object({
    schemaVersion: z.literal(1),
    generation: id,
    revision: z.number().int().nonnegative(),
    createdAt: time,
    destinations: z.array(destinationSchema).min(1).max(24),
    deliveries: z.array(deliverySchema).max(2400),
    runs: z.array(runSchema).max(40),
    activity: z.array(activitySchema).max(120),
    motionPaused: z.boolean(),
  })
  .strict();
export type Book = z.infer<typeof bookSchema>;
export type BlockedItem = { deliveryId: string; reason: string };
export type ReplayPlan = {
  ids: string[];
  eligible: string[];
  blocked: BlockedItem[];
  fingerprint: string;
};
export type Context = { now: number; id: () => string };
export type Work = {
  token: string;
  runId: string;
  deliveryId: string;
  destination: Destination;
  body: string;
  tryNumber: number;
};
export const workSchema = z
  .object({
    token: id,
    runId: id,
    deliveryId: id,
    destination: destinationSchema,
    body: z.string().max(48000),
    tryNumber: z.number().int().min(1).max(4),
  })
  .strict();
export const resultSchema = z
  .object({
    token: id,
    runId: id,
    deliveryId: id,
    code: z.number().int().min(100).max(599).nullable(),
    latencyMs: z.number().int().min(0).max(30000),
    message: z.string().max(240),
  })
  .strict();
export type WorkResult = z.infer<typeof resultSchema>;

export function uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 15) | 64;
  b[8] = (b[8]! & 63) | 128;
  const h = Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function decodeBook(value: unknown): Book {
  const b = bookSchema.parse(value);
  const destinations = new Set(b.destinations.map((d) => d.id));
  const deliveries = new Set(b.deliveries.map((d) => d.id));
  if (
    destinations.size !== b.destinations.length ||
    deliveries.size !== b.deliveries.length ||
    new Set(b.runs.map((r) => r.id)).size !== b.runs.length
  )
    throw new Error('Saved records contain duplicate identifiers.');
  if (
    b.deliveries.some((d) => !destinations.has(d.destinationId)) ||
    b.runs.some(
      (r) =>
        r.items.some((i) => !deliveries.has(i.deliveryId)) ||
        new Set(r.items.map((i) => i.deliveryId)).size !== r.items.length,
    )
  )
    throw new Error('Saved records contain missing references.');
  return b;
}
export function validatePayload(raw: string) {
  if (raw.length > 48000)
    return { ok: false as const, issues: ['Payload exceeds 48,000 characters.'] };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      ok: false as const,
      issues: ['The body is not valid JSON. Check commas, quotes and brackets.'],
    };
  }
  const result = eventSchema.safeParse(value);
  return result.success
    ? { ok: true as const, event: result.data, issues: [] }
    : {
        ok: false as const,
        issues: result.error.issues.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`),
      };
}
export const deliveryKey = (d: Delivery) => `${d.destinationId}/${d.eventId}`;
export const isTerminal = (i: RunItem) =>
  ['delivered', 'failed', 'skipped', 'cancelled'].includes(i.status);
export function planReplay(book: Book, ids: string[]): ReplayPlan {
  if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
    throw new Error('Select between 1 and 100 different deliveries.');
  const eligible: string[] = [];
  const blocked: BlockedItem[] = [];
  const seen = new Set(
    book.deliveries.filter((d) => d.status === 'delivered').map(deliveryKey),
  );
  const reserved = new Set(
    book.runs
      .filter((r) => r.status === 'running' || r.status === 'paused')
      .flatMap((r) =>
        r.items
          .filter((i) => !isTerminal(i))
          .map((i) => book.deliveries.find((d) => d.id === i.deliveryId)),
      )
      .filter((d): d is Delivery => Boolean(d))
      .map(deliveryKey),
  );
  const fingerprint: unknown[] = [book.generation];
  for (const id of ids) {
    const d = book.deliveries.find((r) => r.id === id);
    const target = book.destinations.find((t) => t.id === d?.destinationId);
    fingerprint.push([id, d?.revision, d?.status, target?.revision]);
    let reason = '';
    if (!d || !target) reason = 'Record no longer available';
    else if (d.status !== 'failed')
      reason = d.status === 'delivered' ? 'Already delivered' : 'Already queued';
    else if (!target.enabled) reason = 'Destination is paused';
    else {
      const parsed = validatePayload(d.body);
      if (!parsed.ok) reason = 'Contract validation failed';
      else if (parsed.event.event_id !== d.eventId || parsed.event.type !== d.type)
        reason = 'Event identity does not match the record';
      else if (!target.subscriptions.includes(parsed.event.type))
        reason = 'Event type is not subscribed';
      else if (reserved.has(deliveryKey(d))) reason = 'An equivalent event is already queued';
      else if (seen.has(deliveryKey(d)))
        reason = 'Duplicate event already delivered or selected';
    }
    if (reason) blocked.push({ deliveryId: id, reason });
    else if (d) {
      eligible.push(id);
      seen.add(deliveryKey(d));
    }
  }
  return { ids, eligible, blocked, fingerprint: JSON.stringify(fingerprint) };
}
function log(book: Book, ctx: Context, kind: Activity['kind'], title: string, detail: string) {
  return [{ id: ctx.id(), at: ctx.now, kind, title, detail }, ...book.activity].slice(0, 120);
}
function roomForRun(book: Book) {
  if (book.runs.filter((r) => r.status === 'running' || r.status === 'paused').length >= 8)
    throw new Error(
      'Finish or cancel an active run before starting another. Eight can be active at once.',
    );
}
function retainRuns(runs: Run[]) {
  const active = runs.filter((r) => r.status === 'running' || r.status === 'paused');
  const finished = runs.filter((r) => r.status !== 'running' && r.status !== 'paused');
  return [...active, ...finished.slice(0, 40 - active.length)].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}
export function startReplay(
  book: Book,
  reviewed: ReplayPlan,
  reason: string,
  rate: number,
  ctx: Context,
): { book: Book; runId: string } {
  if (reason.trim().length < 4 || reason.trim().length > 240)
    throw new Error('Add a reason between 4 and 240 characters.');
  if (!Number.isInteger(rate) || rate < 1 || rate > 5)
    throw new Error('Choose a rate between 1 and 5 events per second.');
  roomForRun(book);
  const plan = planReplay(book, reviewed.ids);
  if (
    plan.fingerprint !== reviewed.fingerprint ||
    JSON.stringify(plan.eligible) !== JSON.stringify(reviewed.eligible)
  )
    throw new Error(
      'The reviewed plan changed in another tab or destination settings changed. Reopen the plan.',
    );
  if (!plan.eligible.length) throw new Error('No deliveries in this plan are eligible.');
  const runId = ctx.id();
  const run: Run = {
    id: runId,
    label: `Replay ${book.runs.length + 1}`,
    reason: reason.trim(),
    createdAt: ctx.now,
    status: 'running',
    source: 'replay',
    rate,
    nextAt: ctx.now,
    items: plan.eligible.map((deliveryId) => ({
      deliveryId,
      status: 'pending',
      tries: 0,
      nextAt: ctx.now,
      lease: null,
      leaseUntil: 0,
      result: '',
    })),
  };
  const selected = new Set(plan.eligible);
  return {
    runId,
    book: {
      ...book,
      revision: book.revision + 1,
      runs: retainRuns([run, ...book.runs]),
      deliveries: book.deliveries.map((d) =>
        selected.has(d.id) ? { ...d, status: 'queued', revision: d.revision + 1 } : d,
      ),
      activity: log(
        book,
        ctx,
        'replay',
        `${plan.eligible.length} ${plan.eligible.length === 1 ? 'delivery' : 'deliveries'} queued`,
        reason.trim(),
      ),
    },
  };
}
export function saveDestination(
  book: Book,
  input: Destination,
  expectedRevision: number | null,
  generation: string,
  reason: string,
  ctx: Context,
): Book {
  if (generation !== book.generation)
    throw new Error('This workspace was reset. Reopen the destination.');
  if (reason.trim().length < 4 || reason.trim().length > 240)
    throw new Error('Add a reason between 4 and 240 characters.');
  const parsed = destinationSchema.parse(input);
  if (new Set(parsed.subscriptions).size !== parsed.subscriptions.length)
    throw new Error('Choose each event type once.');
  const existing = book.destinations.find((d) => d.id === input.id);
  if ((existing?.revision ?? null) !== expectedRevision)
    throw new Error('This destination changed in another tab. Reopen it before saving.');
  if (!existing && book.destinations.length >= 24)
    throw new Error('This demo supports up to 24 destinations.');
  const next = { ...parsed, revision: (existing?.revision ?? -1) + 1 };
  return {
    ...book,
    revision: book.revision + 1,
    destinations: existing
      ? book.destinations.map((d) => (d.id === next.id ? next : d))
      : [...book.destinations, next],
    activity: log(
      book,
      ctx,
      'configuration',
      `${next.name} ${existing ? 'updated' : 'created'}`,
      reason.trim(),
    ),
  };
}
export function controlRun(
  book: Book,
  id: string,
  action: 'pause' | 'resume' | 'cancel',
  ctx: Context,
): Book {
  const run = book.runs.find((r) => r.id === id);
  if (!run || run.status === 'completed' || run.status === 'cancelled')
    throw new Error('This run has already finished.');
  if (action === 'pause' && run.status !== 'running')
    throw new Error('This run is already paused.');
  if (action === 'resume' && run.status !== 'paused')
    throw new Error('This run is already running.');
  const next: Run = {
    ...run,
    status: action === 'pause' ? 'paused' : action === 'resume' ? 'running' : 'cancelled',
    items:
      action === 'cancel'
        ? run.items.map((i) =>
            isTerminal(i)
              ? i
              : {
                  ...i,
                  status: 'cancelled',
                  lease: null,
                  result: 'Cancelled before acknowledgement',
                },
          )
        : run.items,
  };
  const cancelled = new Set(
    action === 'cancel' ? run.items.filter((i) => !isTerminal(i)).map((i) => i.deliveryId) : [],
  );
  return {
    ...book,
    revision: book.revision + 1,
    runs: book.runs.map((r) => (r.id === id ? next : r)),
    deliveries: book.deliveries.map((d) =>
      cancelled.has(d.id) ? { ...d, status: 'failed', revision: d.revision + 1 } : d,
    ),
    activity: log(
      book,
      ctx,
      'control',
      `${run.label} ${action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'cancelled'}`,
      action === 'pause'
        ? 'The current attempt can finish; no new attempt starts.'
        : action === 'cancel'
          ? 'Outstanding leases were invalidated. Late responses cannot apply.'
          : 'Pending deliveries will continue.',
    ),
  };
}
export function claimWork(book: Book, ctx: Context): { book: Book; work: Work | null } {
  for (const run of [...book.runs].reverse()) {
    if (run.status !== 'running' || run.nextAt > ctx.now) continue;
    if (run.items.some((i) => i.status === 'working' && i.leaseUntil > ctx.now)) continue;
    const item = run.items.find(
      (i) =>
        (i.status === 'pending' && i.nextAt <= ctx.now) ||
        (i.status === 'working' && i.leaseUntil <= ctx.now),
    );
    if (!item) continue;
    const d = book.deliveries.find((r) => r.id === item.deliveryId);
    const target = book.destinations.find((t) => t.id === d?.destinationId);
    if (!d || !target) continue;
    const token = ctx.id();
    const nextItem: RunItem = {
      ...item,
      status: 'working',
      lease: token,
      leaseUntil: ctx.now + 5000,
    };
    const nextRun: Run = {
      ...run,
      nextAt: ctx.now + Math.ceil(1000 / run.rate),
      items: run.items.map((i) => (i.deliveryId === item.deliveryId ? nextItem : i)),
    };
    return {
      book: {
        ...book,
        revision: book.revision + 1,
        runs: book.runs.map((r) => (r.id === run.id ? nextRun : r)),
        deliveries: book.deliveries.map((r) =>
          r.id === d.id ? { ...r, status: 'sending', revision: r.revision + 1 } : r,
        ),
      },
      work: {
        token,
        runId: run.id,
        deliveryId: d.id,
        destination: target,
        body: d.body,
        tryNumber: item.tries + 1,
      },
    };
  }
  return { book, work: null };
}
export function simulate(work: Work): Omit<WorkResult, 'token' | 'runId' | 'deliveryId'> {
  const t = work.destination;
  const payload = validatePayload(work.body);
  if (!payload.ok)
    return {
      code: 422,
      latencyMs: 0,
      message: 'Contract validation failed; nothing was sent.',
    };
  if (!t.enabled)
    return { code: 423, latencyMs: 0, message: 'Destination paused; nothing was sent.' };
  if (!t.subscriptions.includes(payload.event.type))
    return { code: 422, latencyMs: 0, message: 'Destination is not subscribed to this event.' };
  if (t.policy === 'unavailable')
    return {
      code: 503,
      latencyMs: t.latencyMs,
      message: 'Simulator: destination returned 503 Service Unavailable.',
    };
  if (t.policy === 'rate_limited' && work.tryNumber < 3)
    return {
      code: 429,
      latencyMs: t.latencyMs,
      message: 'Simulator: destination rate limit; retry is scheduled.',
    };
  if (t.policy === 'intermittent' && work.tryNumber < 2)
    return {
      code: 502,
      latencyMs: t.latencyMs,
      message: 'Simulator: transient gateway failure; retry is scheduled.',
    };
  return {
    code: 202,
    latencyMs: t.latencyMs,
    message: 'Simulator: event accepted and acknowledged.',
  };
}
export function completeWork(book: Book, result: WorkResult, ctx: Context): Book {
  const run = book.runs.find((r) => r.id === result.runId);
  const item = run?.items.find((i) => i.deliveryId === result.deliveryId);
  const d = book.deliveries.find((r) => r.id === result.deliveryId);
  if (
    !run ||
    !item ||
    !d ||
    item.status !== 'working' ||
    item.lease !== result.token ||
    run.status === 'cancelled'
  )
    return book;
  const target = book.destinations.find((t) => t.id === d.destinationId)!;
  const duplicate = book.deliveries.some(
    (r) => r.id !== d.id && r.status === 'delivered' && deliveryKey(r) === deliveryKey(d),
  );
  const accepted = result.code !== null && result.code >= 200 && result.code < 300;
  const tries = item.tries + 1;
  const retry =
    !accepted &&
    !duplicate &&
    (result.code === null || result.code === 429 || result.code >= 500) &&
    tries < target.maxAttempts;
  const nextItem: RunItem = {
    ...item,
    tries,
    lease: null,
    leaseUntil: 0,
    nextAt: ctx.now + Math.min(2400, 400 * 2 ** (tries - 1)),
    status: duplicate ? 'skipped' : accepted ? 'delivered' : retry ? 'pending' : 'failed',
    result: duplicate ? 'Duplicate acknowledgement blocked by event identity' : result.message,
  };
  const items = run.items.map((i) => (i.deliveryId === d.id ? nextItem : i));
  const nextRun: Run = {
    ...run,
    items,
    status: items.every(isTerminal) ? 'completed' : run.status,
  };
  const attempt: Attempt = {
    id: ctx.id(),
    at: ctx.now,
    code: duplicate ? 409 : result.code,
    latencyMs: result.latencyMs,
    message: nextItem.result,
    runId: run.id,
  };
  return {
    ...book,
    revision: book.revision + 1,
    runs: book.runs.map((r) => (r.id === run.id ? nextRun : r)),
    deliveries: book.deliveries.map((r) =>
      r.id === d.id
        ? {
            ...r,
            status: accepted && !duplicate ? 'delivered' : retry ? 'queued' : 'failed',
            revision: r.revision + 1,
            attempts: [...r.attempts, attempt].slice(-8),
          }
        : r,
    ),
  };
}
export function queueTest(
  book: Book,
  raw: string,
  destinationId: string,
  ctx: Context,
): { book: Book; runId: string } {
  roomForRun(book);
  const valid = validatePayload(raw);
  if (!valid.ok) throw new Error(valid.issues[0] ?? 'Invalid payload.');
  const target = book.destinations.find((d) => d.id === destinationId);
  if (!target?.enabled) throw new Error('Choose an enabled destination.');
  if (!target.subscriptions.includes(valid.event.type))
    throw new Error('This destination is not subscribed to the selected event type.');
  if (
    book.deliveries.some(
      (d) => d.destinationId === destinationId && d.eventId === valid.event.event_id,
    )
  )
    throw new Error(
      'This event ID already exists for the destination. Change it before queuing.',
    );
  if (book.deliveries.length >= 2400)
    throw new Error(
      'This workspace has reached its 2,400-event limit. Export your work before resetting.',
    );
  const deliveryId = ctx.id(),
    runId = ctx.id();
  const d: Delivery = {
    id: deliveryId,
    eventId: valid.event.event_id,
    type: valid.event.type,
    destinationId,
    createdAt: ctx.now,
    body: raw,
    status: 'queued',
    attempts: [],
    revision: 0,
  };
  const run: Run = {
    id: runId,
    label: 'Playground test',
    reason: 'A validated test event from the playground',
    createdAt: ctx.now,
    status: 'running',
    source: 'playground',
    rate: 1,
    nextAt: ctx.now,
    items: [
      {
        deliveryId,
        status: 'pending',
        tries: 0,
        nextAt: ctx.now,
        lease: null,
        leaseUntil: 0,
        result: '',
      },
    ],
  };
  return {
    runId,
    book: {
      ...book,
      revision: book.revision + 1,
      deliveries: [d, ...book.deliveries],
      runs: retainRuns([run, ...book.runs]),
      activity: log(
        book,
        ctx,
        'playground',
        'Test event queued',
        `${valid.event.type} → ${target.name}`,
      ),
    },
  };
}
export function getMetrics(book: Book) {
  const attempts = book.deliveries.flatMap((d) => d.attempts);
  const delivered = book.deliveries.filter((d) => d.status === 'delivered').length;
  const failed = book.deliveries.filter((d) => d.status === 'failed').length;
  const latency = attempts
    .map((a) => a.latencyMs)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  return {
    total: book.deliveries.length,
    delivered,
    failed,
    success: book.deliveries.length ? (delivered / book.deliveries.length) * 100 : 0,
    p95: latency[Math.max(0, Math.ceil(latency.length * 0.95) - 1)] ?? 0,
    attempts: attempts.length,
    active: book.runs.filter((r) => r.status === 'running' || r.status === 'paused').length,
  };
}
export function samplePayload(
  type: EventType,
  eventId = 'evt_playground_001',
  now = Date.now(),
) {
  return JSON.stringify(
    {
      event_id: eventId,
      type,
      schema_version: 1,
      occurred_at: new Date(now).toISOString(),
      data: {
        fixture_id: 'fix_northbridge_42',
        competition: 'Northern Premier',
        sequence: 1842,
        state:
          type === 'result.confirmed'
            ? 'confirmed'
            : type === 'market.suspended'
              ? 'suspended'
              : 'live',
      },
    },
    null,
    2,
  );
}
export function shortTime(at: number) {
  return new Date(at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
export function elapsed(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}
