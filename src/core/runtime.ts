import { useSyncExternalStore } from 'react';
import { CorruptWorkspaceError, WorkspaceDatabase } from './database';
import {
  claimWork,
  completeWork,
  controlRun,
  queueTest,
  resultSchema,
  saveDestination,
  startReplay,
  uuid,
} from './model';
import type { Book, Destination, ReplayPlan, Work, WorkResult } from './model';

export type Snapshot = {
  phase: 'loading' | 'ready' | 'error';
  book: Book | null;
  error: string;
  corrupt: unknown;
  engine: 'starting' | 'ready' | 'offline';
  toast: { message: string; error: boolean } | null;
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'The action could not be completed.';
export class IntegrationRuntime {
  private db = new WorkspaceDatabase();
  private snapshot: Snapshot = {
    phase: 'loading',
    book: null,
    error: '',
    corrupt: undefined,
    engine: 'starting',
    toast: null,
  };
  private listeners = new Set<() => void>();
  private users = 0;
  private epoch = 0;
  private worker: Worker | undefined;
  private channel: BroadcastChannel | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private pumping = false;
  private pending = new Map<
    string,
    {
      work: Work;
      resolve: (value: WorkResult | null) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private accept(book: Book) {
    const current = this.snapshot.book;
    if (
      !current ||
      current.generation !== book.generation ||
      book.revision >= current.revision
    ) {
      document.documentElement.dataset.motion = book.motionPaused ? 'paused' : 'full';
      this.update({ book, phase: 'ready', error: '', corrupt: undefined });
    }
  }
  notify = (text: string, error = false) => this.update({ toast: { message: text, error } });
  dismiss = () => this.update({ toast: null });
  connect = () => {
    this.users++;
    if (this.users === 1) {
      const epoch = ++this.epoch;
      void this.boot(epoch);
      window.addEventListener('focus', this.refresh);
    }
    return () => {
      this.users--;
      if (!this.users) {
        this.epoch++;
        this.stop();
        window.removeEventListener('focus', this.refresh);
      }
    };
  };
  private async boot(epoch: number) {
    this.update({ phase: 'loading', error: '' });
    try {
      const book = await this.db.initialize(uuid(), Date.now());
      if (epoch !== this.epoch || !this.users) return;
      this.accept(book);
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('rafrelay:workspace-updates');
        this.channel.onmessage = () => {
          void this.refresh();
        };
      }
      this.startWorker();
      this.interval = setInterval(() => {
        void this.pump();
      }, 250);
      void this.pump();
    } catch (e) {
      if (epoch !== this.epoch) return;
      this.update({
        phase: 'error',
        error: message(e),
        corrupt: e instanceof CorruptWorkspaceError ? e.value : undefined,
        engine: 'offline',
      });
    }
  }
  private startWorker() {
    this.worker?.terminate();
    try {
      this.worker = new Worker(new URL('./transport.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent<unknown>) => {
        const parsed = resultSchema.safeParse(event.data);
        if (!parsed.success) return;
        const p = this.pending.get(parsed.data.token);
        if (
          !p ||
          p.work.runId !== parsed.data.runId ||
          p.work.deliveryId !== parsed.data.deliveryId
        )
          return;
        clearTimeout(p.timer);
        this.pending.delete(parsed.data.token);
        p.resolve(parsed.data);
      };
      this.worker.onerror = () =>
        this.update({
          engine: 'offline',
          error: 'The replay worker stopped. Restart it to continue pending work.',
        });
      this.update({ engine: 'ready' });
    } catch {
      this.update({
        engine: 'offline',
        error: 'The replay worker could not start. Retry the workspace.',
      });
    }
  }
  restart = () => {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.resolve(null);
    }
    this.pending.clear();
    this.startWorker();
    if (this.snapshot.engine === 'ready') this.update({ error: '' });
  };
  retry = () => {
    this.stop();
    void this.boot(++this.epoch);
  };
  refresh = async () => {
    try {
      this.accept(await this.db.read());
    } catch (e) {
      this.update({
        phase: 'error',
        error: message(e),
        corrupt: e instanceof CorruptWorkspaceError ? e.value : undefined,
      });
    }
  };
  private announce(book: Book) {
    this.accept(book);
    this.channel?.postMessage({ generation: book.generation, revision: book.revision });
  }
  private async change<T>(fn: (b: Book) => { book: Book; value: T }) {
    if (this.snapshot.phase !== 'ready')
      throw new Error('Open the workspace before saving a change.');
    const result = await this.db.transact(fn);
    this.announce(result.book);
    return result.value;
  }
  createReplay = async (plan: ReplayPlan, reason: string, rate: number) => {
    if (this.snapshot.engine !== 'ready')
      throw new Error('Restart the replay worker before queuing a run.');
    const runId = await this.change((book) => {
      const next = startReplay(book, plan, reason, rate, { now: Date.now(), id: uuid });
      return { book: next.book, value: next.runId };
    });
    this.notify('Replay plan saved. Eligible deliveries are queued.');
    return runId;
  };
  saveTarget = async (
    value: Destination,
    revision: number | null,
    generation: string,
    reason: string,
  ) => {
    await this.change((book) => ({
      book: saveDestination(book, value, revision, generation, reason, {
        now: Date.now(),
        id: uuid,
      }),
      value: undefined,
    }));
    this.notify('Destination settings saved.');
  };
  control = async (id: string, action: 'pause' | 'resume' | 'cancel') => {
    await this.change((book) => ({
      book: controlRun(book, id, action, { now: Date.now(), id: uuid }),
      value: undefined,
    }));
    this.notify(
      action === 'pause'
        ? 'Run paused. Its current attempt can finish.'
        : action === 'resume'
          ? 'Run resumed.'
          : 'Run cancelled. Outstanding responses will be ignored.',
    );
  };
  testEvent = async (raw: string, destinationId: string) => {
    if (this.snapshot.engine !== 'ready')
      throw new Error('Restart the replay worker before queuing a test.');
    const id = await this.change((book) => {
      const next = queueTest(book, raw, destinationId, { now: Date.now(), id: uuid });
      return { book: next.book, value: next.runId };
    });
    this.notify('Validated event queued in the local simulator.');
    return id;
  };
  toggleMotion = async () => {
    await this.change((book) => ({
      book: { ...book, revision: book.revision + 1, motionPaused: !book.motionPaused },
      value: undefined,
    }));
  };
  reset = async () => {
    const value = this.snapshot.corrupt;
    if (value === undefined) throw new Error('No unreadable workspace is being reviewed.');
    const next = await this.db.reset(value, uuid(), Date.now());
    this.announce(next);
    this.retry();
  };
  private deliver(work: Work): Promise<WorkResult | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(work.token);
        resolve({
          token: work.token,
          runId: work.runId,
          deliveryId: work.deliveryId,
          code: null,
          latencyMs: 4000,
          message: 'Worker acknowledgement timed out. The attempt can be retried.',
        });
      }, 4000);
      this.pending.set(work.token, { work, resolve, timer });
      this.worker?.postMessage(work);
    });
  }
  private async pump() {
    if (
      this.pumping ||
      this.snapshot.phase !== 'ready' ||
      this.snapshot.engine !== 'ready' ||
      !this.snapshot.book?.runs.some((r) => r.status === 'running')
    )
      return;
    this.pumping = true;
    const epoch = this.epoch;
    try {
      const claimed = await this.db.transact((book) => {
        const next = claimWork(book, { now: Date.now(), id: uuid });
        return { book: next.book, value: next.work };
      });
      if (epoch !== this.epoch) return;
      if (claimed.value) {
        this.announce(claimed.book);
        const result = await this.deliver(claimed.value);
        if (!result || epoch !== this.epoch) return;
        const completed = await this.db.transact((book) => ({
          book: completeWork(book, result, { now: Date.now(), id: uuid }),
          value: undefined,
        }));
        this.announce(completed.book);
      } else this.accept(claimed.book);
    } catch (e) {
      this.update({ error: message(e) });
    } finally {
      this.pumping = false;
    }
  }
  private stop() {
    clearInterval(this.interval);
    this.interval = undefined;
    this.worker?.terminate();
    this.worker = undefined;
    this.channel?.close();
    this.channel = undefined;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.resolve(null);
    }
    this.pending.clear();
  }
}
export const runtime = new IntegrationRuntime();
export const useWorkspace = () => useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
