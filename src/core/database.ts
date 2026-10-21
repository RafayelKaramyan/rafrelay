import { decodeBook } from './model';
import type { Book } from './model';
import { seedBook } from './seed';

export const DATABASE_NAME = 'rafrelay-workspace-v1';
export class CorruptWorkspaceError extends Error {
  readonly value: unknown;
  constructor(value: unknown) {
    super('The saved workspace could not be read. Export its recovery data before resetting.');
    this.value = value;
  }
}
export class WorkspaceDatabase {
  private connection: Promise<IDBDatabase> | undefined;
  constructor(private name = DATABASE_NAME) {}
  private open() {
    if (!this.connection)
      this.connection = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('workspace');
        request.onerror = () =>
          reject(new Error('Browser database is unavailable. No changes have been saved.'));
        request.onblocked = () =>
          reject(new Error('Close an older workspace tab, then retry opening the database.'));
        request.onsuccess = () => {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
      }).catch((e: unknown) => {
        this.connection = undefined;
        throw e;
      });
    return this.connection;
  }
  async initialize(generation: string, now: number): Promise<Book> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', 'readwrite');
      const store = tx.objectStore('workspace');
      const request = store.get('primary');
      let next: Book, cause: unknown;
      request.onsuccess = () => {
        try {
          if (request.result === undefined) {
            next = seedBook(generation, now);
            store.put(next, 'primary');
          } else {
            try {
              next = decodeBook(request.result);
            } catch {
              throw new CorruptWorkspaceError(request.result);
            }
          }
        } catch (e) {
          cause = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(next);
      tx.onabort = () =>
        reject(cause ?? new Error('The workspace could not be opened. No data was replaced.'));
      tx.onerror = () => {};
    });
  }
  async read(): Promise<Book> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', 'readonly');
      const req = tx.objectStore('workspace').get('primary');
      req.onsuccess = () => {
        try {
          resolve(decodeBook(req.result));
        } catch {
          reject(new CorruptWorkspaceError(req.result));
        }
      };
      req.onerror = () => reject(new Error('The saved workspace could not be read.'));
    });
  }
  async transact<T>(
    change: (current: Book) => { book: Book; value: T },
  ): Promise<{ book: Book; value: T }> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', 'readwrite');
      const store = tx.objectStore('workspace');
      const req = store.get('primary');
      let result: { book: Book; value: T }, cause: unknown;
      req.onsuccess = () => {
        try {
          let book: Book;
          try {
            book = decodeBook(req.result);
          } catch {
            throw new CorruptWorkspaceError(req.result);
          }
          result = change(book);
          if (result.book !== book) store.put(result.book, 'primary');
        } catch (e) {
          cause = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          cause ?? new Error('The database rejected this save. Your change was not applied.'),
        );
      tx.onerror = () => {};
    });
  }
  async reset(reviewed: unknown, generation: string, now: number): Promise<Book> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', 'readwrite');
      const store = tx.objectStore('workspace');
      const req = store.get('primary');
      let next: Book, cause: unknown;
      req.onsuccess = () => {
        try {
          if (JSON.stringify(req.result) !== JSON.stringify(reviewed))
            throw new Error('Saved data changed. Review it again before resetting.');
          next = seedBook(generation, now);
          store.put(next, 'primary');
        } catch (e) {
          cause = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(next);
      tx.onabort = () =>
        reject(cause ?? new Error('Reset failed. The existing data was preserved.'));
      tx.onerror = () => {};
    });
  }
  async close() {
    (await this.open()).close();
    this.connection = undefined;
  }
}
