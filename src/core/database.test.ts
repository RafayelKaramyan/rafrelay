import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CorruptWorkspaceError, WorkspaceDatabase } from './database';
import { claimWork, planReplay, saveDestination, startReplay, validatePayload } from './model';
import type { Book } from './model';
const NOW = 1770000000000;
let serial = 0;
const next = () => `db_id_${++serial}`;
const databases: WorkspaceDatabase[] = [];
const open = (name = next()) => {
  const db = new WorkspaceDatabase(name);
  databases.push(db);
  return db;
};
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(databases.splice(0).map((db) => db.close()));
});
async function rawWrite(name: string, value: unknown) {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onsuccess = () => {
      const db = req.result,
        tx = db.transaction('workspace', 'readwrite');
      tx.objectStore('workspace').put(value, 'primary');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}
describe('atomic IndexedDB workspace', () => {
  it('initializes once when two tabs race to create the workspace', async () => {
    const name = next(),
      a = open(name),
      b = open(name);
    const [first, second] = await Promise.all([
      a.initialize('generation_a', NOW),
      b.initialize('generation_b', NOW + 1),
    ]);
    expect(first.generation).toBe(second.generation);
    expect((await a.read()).deliveries).toHaveLength(1800);
  });
  it('returns only committed changes and reloads them from another connection', async () => {
    const name = next(),
      a = open(name),
      b = open(name),
      book = await a.initialize('g', NOW);
    await a.transact((current) => ({
      book: saveDestination(
        current,
        { ...current.destinations[0]!, policy: 'healthy' },
        0,
        book.generation,
        'Destination recovered',
        { now: NOW, id: next },
      ),
      value: 'saved',
    }));
    expect((await b.read()).destinations[0]?.policy).toBe('healthy');
    expect((await b.read()).activity).toHaveLength(1);
  });
  it('serializes concurrent revision checks so one edit wins', async () => {
    const name = next(),
      a = open(name),
      b = open(name),
      book = await a.initialize('g', NOW);
    const save = (db: WorkspaceDatabase, latencyMs: number) =>
      db.transact((current) => ({
        book: saveDestination(
          current,
          { ...current.destinations[0]!, latencyMs },
          0,
          book.generation,
          'Concurrent review',
          { now: NOW, id: next },
        ),
        value: undefined,
      }));
    const results = await Promise.allSettled([save(a, 600), save(b, 900)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await a.read()).destinations[0]?.revision).toBe(1);
    expect((await a.read()).activity).toHaveLength(1);
  });
  it('gives a live delivery lease to only one tab', async () => {
    const name = next(),
      a = open(name),
      b = open(name),
      book = await a.initialize('g', NOW),
      delivery = book.deliveries.find(
        (d) =>
          d.status === 'failed' &&
          d.destinationId === 'dest_ledger' &&
          validatePayload(d.body).ok,
      )!;
    await a.transact((current) => ({
      book: startReplay(current, planReplay(current, [delivery.id]), 'Review complete', 2, {
        now: NOW,
        id: next,
      }).book,
      value: undefined,
    }));
    const claim = (db: WorkspaceDatabase) =>
      db.transact((current) => {
        const c = claimWork(current, { now: NOW, id: next });
        return { book: c.book, value: c.work };
      });
    const claimed = await Promise.all([claim(a), claim(b)]);
    expect(claimed.filter((r) => r.value !== null)).toHaveLength(1);
  });
  it('rolls back a domain command that throws after modifying its local copy', async () => {
    const db = open();
    const initial = await db.initialize('g', NOW);
    await expect(
      db.transact((book) => {
        book.revision = 999;
        throw new Error('invalid command');
      }),
    ).rejects.toThrow('invalid command');
    expect((await db.read()).revision).toBe(initial.revision);
  });
  it('rejects a storage failure without reporting a successful save', async () => {
    const db = open(),
      initial = await db.initialize('g', NOW);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Storage quota reached', 'QuotaExceededError');
    });
    await expect(
      db.transact((book) => ({ book: { ...book, revision: 1 }, value: 'saved' })),
    ).rejects.toThrow('quota');
    put.mockRestore();
    expect((await db.read()).revision).toBe(initial.revision);
  });
  it('preserves unreadable storage and requires an explicit matching reset', async () => {
    const name = next(),
      db = open(name);
    await db.initialize('g', NOW);
    const corrupt = { schemaVersion: 999, valuable: 'keep this' };
    await rawWrite(name, corrupt);
    await expect(db.read()).rejects.toBeInstanceOf(CorruptWorkspaceError);
    await expect(db.initialize('replacement', NOW)).rejects.toMatchObject({ value: corrupt });
    await expect(db.reset({ schemaVersion: 1 }, 'replacement', NOW + 1)).rejects.toThrow(
      'changed',
    );
    await expect(db.read()).rejects.toMatchObject({ value: corrupt });
    expect((await db.reset(corrupt, 'replacement', NOW + 1)).generation).toBe('replacement');
    expect((await db.read()).deliveries).toHaveLength(1800);
  });
  it('does not commit a replay built from an obsolete review', async () => {
    const db = open(),
      book = await db.initialize('g', NOW),
      delivery = book.deliveries.find(
        (d) =>
          d.status === 'failed' &&
          d.destinationId === 'dest_ledger' &&
          validatePayload(d.body).ok,
      )!,
      plan = planReplay(book, [delivery.id]);
    await db.transact((current) => ({
      book: saveDestination(
        current,
        { ...current.destinations[0]!, policy: 'healthy' },
        0,
        book.generation,
        'Service recovered',
        { now: NOW, id: next },
      ),
      value: undefined,
    }));
    await expect(
      db.transact((current: Book) => ({
        book: startReplay(current, plan, 'Retry reviewed', 2, { now: NOW, id: next }).book,
        value: undefined,
      })),
    ).rejects.toThrow('plan changed');
    expect((await db.read()).runs).toHaveLength(0);
    expect((await db.read()).deliveries.find((d) => d.id === delivery.id)?.status).toBe(
      'failed',
    );
  });
});
