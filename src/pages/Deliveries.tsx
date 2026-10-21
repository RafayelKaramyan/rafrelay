import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  List,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Book, Delivery } from '../core/model';
import { eventTypes, shortTime } from '../core/model';
import { runtime } from '../core/runtime';
import { Badge, Empty, ExportButton, PageHeader } from '../ui/primitives';
import { number } from '../ui/format';
import { ReplayModal } from '../ui/ReplayModal';
import { DeliveryInspector } from '../ui/DeliveryInspector';
const statuses = ['all', 'failed', 'delivered', 'queued', 'sending'];
export function Deliveries({ book }: { book: Book }) {
  const [params, setParams] = useSearchParams(),
    [selected, setSelected] = useState<string[]>([]),
    [replay, setReplay] = useState<string[] | null>(null),
    [paginated, setPaginated] = useState(false);
  const q = params.get('q') ?? '',
    status = statuses.includes(params.get('status') ?? '') ? params.get('status')! : 'all',
    destination = params.get('destination') ?? '',
    type = params.get('type') ?? '';
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () =>
      book.deliveries
        .filter(
          (d) =>
            (status === 'all' || d.status === status) &&
            (!destination || d.destinationId === destination) &&
            (!type || d.type === type) &&
            (!q ||
              `${d.eventId} ${d.id} ${d.type} ${book.destinations.find((target) => target.id === d.destinationId)?.name}`
                .toLowerCase()
                .includes(q.toLowerCase())),
        )
        .sort((a, b) => b.createdAt - a.createdAt),
    [book, q, status, destination, type],
  );
  const page = Math.max(
    0,
    Math.min(Math.ceil(rows.length / 25) - 1, Math.floor(Number(params.get('page')) || 0)),
  );
  // React Compiler is not enabled; the scroll observer intentionally remains mutable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: paginated ? 0 : rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 65,
    overscan: 7,
  });
  const virtualRows = virtual.getVirtualItems();
  const visible = paginated
    ? rows.slice(page * 25, page * 25 + 25)
    : virtualRows.map((r) => rows[r.index]!);
  const inspect = book.deliveries.find((d) => d.id === params.get('inspect'));
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
    scrollRef.current?.scrollTo({ top: 0 });
  };
  const toggle = (id: string) =>
    setSelected((old) =>
      old.includes(id)
        ? old.filter((entry) => entry !== id)
        : old.length >= 100
          ? (runtime.notify('Up to 100 deliveries can be selected for a run.', true), old)
          : [...old, id],
    );
  const selectPage = rows
    .slice(paginated ? page * 25 : 0, paginated ? page * 25 + 25 : 25)
    .map((d) => d.id);
  const allSelected = selectPage.length > 0 && selectPage.every((id) => selected.includes(id));
  const clearInspector = () => {
    const next = new URLSearchParams(params);
    next.delete('inspect');
    setParams(next, { replace: true });
  };
  const inspectDelivery = (d: Delivery) => {
    const next = new URLSearchParams(params);
    next.set('inspect', d.id);
    setParams(next);
  };
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / EVENT OPERATIONS"
        title="Delivery queue"
        description="Inspect the details. Isolate failures. Recover with a reviewed replay plan."
        actions={
          <>
            <ExportButton book={book} />
            <button
              className="button primary"
              disabled={!selected.length}
              onClick={() => setReplay(selected)}
            >
              <RotateCcw size={15} />
              Replay selected
              {selected.length > 0 && <span className="button-count">{selected.length}</span>}
            </button>
          </>
        }
      />
      <section className="panel deliveries-panel" aria-label="Delivery records">
        <div className="delivery-status-tabs" aria-label="Filter delivery status">
          {['all', 'failed', 'delivered', 'queued'].map((s) => (
            <button
              key={s}
              aria-pressed={status === s}
              onClick={() => update('status', s === 'all' ? '' : s)}
            >
              {s === 'all'
                ? 'All events'
                : s === 'failed'
                  ? 'Needs attention'
                  : s === 'queued'
                    ? 'In queue'
                    : 'Delivered'}
              <span>
                {number(book.deliveries.filter((d) => s === 'all' || d.status === s).length)}
              </span>
            </button>
          ))}
          <span className="recorded-label">
            <span className="status-dot" />
            Saved locally
          </span>
        </div>
        <div className="table-toolbar">
          <label className="table-search">
            <Search size={16} />
            <input
              aria-label="Search deliveries"
              maxLength={100}
              placeholder="Search event ID, type or destination…"
              value={q}
              onChange={(e) => update('q', e.target.value)}
            />
            {q && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => update('q', '')}
              >
                <X size={13} />
              </button>
            )}
          </label>
          <label className="filter-control">
            <Filter size={14} />
            <select
              aria-label="Filter destination"
              value={destination}
              onChange={(e) => update('destination', e.target.value)}
            >
              <option value="">All destinations</option>
              {book.destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-control">
            <select
              aria-label="Filter event type"
              value={type}
              onChange={(e) => update('type', e.target.value)}
            >
              <option value="">All event types</option>
              {eventTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <button
            className={`icon-button table-mode ${paginated ? 'is-on' : ''}`}
            title={paginated ? 'Use virtual scrolling' : 'Use paginated table'}
            aria-label={paginated ? 'Use virtual scrolling' : 'Use paginated table'}
            onClick={() => setPaginated(!paginated)}
          >
            <List size={18} />
          </button>
        </div>
        {selected.length > 0 && (
          <div className="selection-bar">
            <strong>{selected.length} selected</strong>
            <span>Up to 100 per replay plan</span>
            <button onClick={() => setSelected([])}>
              Clear selection
              <X size={13} />
            </button>
          </div>
        )}
        {rows.length ? (
          <div
            ref={scrollRef}
            className={`table-scroll ${paginated ? 'paginated-table' : ''}`}
            tabIndex={0}
            aria-label={paginated ? 'Paginated delivery table' : 'Scrollable delivery table'}
          >
            <table
              className="delivery-table"
              aria-label="Event deliveries"
              aria-rowcount={rows.length + 1}
            >
              <colgroup>
                <col style={{ width: 46 }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: 45 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select 25 filtered deliveries"
                      checked={allSelected}
                      onChange={() =>
                        setSelected((old) =>
                          allSelected
                            ? old.filter((id) => !selectPage.includes(id))
                            : [...new Set([...old, ...selectPage])].slice(0, 100),
                        )
                      }
                    />
                  </th>
                  <th>
                    Event <ArrowDown size={12} />
                  </th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Received</th>
                  <th>
                    <span className="sr-only">Inspect</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!paginated && (virtualRows[0]?.start ?? 0) > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={7}
                      style={{ height: virtualRows[0]!.start, padding: 0, border: 0 }}
                    />
                  </tr>
                )}
                {visible.map((d, i) => {
                  const target = book.destinations.find((t) => t.id === d.destinationId)!;
                  return (
                    <tr
                      key={d.id}
                      aria-rowindex={
                        (paginated ? page * 25 + i : (virtualRows[i]?.index ?? i)) + 2
                      }
                      className={selected.includes(d.id) ? 'row-selected' : ''}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${d.eventId}`}
                          checked={selected.includes(d.id)}
                          onChange={() => toggle(d.id)}
                        />
                      </td>
                      <td>
                        <button className="event-id mono" onClick={() => inspectDelivery(d)}>
                          {d.eventId}
                        </button>
                        <span className="event-type">{d.type}</span>
                      </td>
                      <td>
                        <div className="table-target">
                          <span
                            className={`destination-square dest-${book.destinations.indexOf(target) % 4}`}
                          >
                            {target.name.slice(0, 1)}
                          </span>
                          <span>{target.name}</span>
                        </div>
                      </td>
                      <td>
                        <Badge status={d.status} />
                      </td>
                      <td>
                        <span className="attempt-count mono">
                          {d.attempts.length.toString().padStart(2, '0')}
                        </span>
                        <span
                          className={`last-response ${d.attempts.at(-1)?.code && d.attempts.at(-1)!.code! >= 400 ? 'text-coral' : ''}`}
                        >
                          {d.attempts.at(-1)?.code ?? '—'}
                        </span>
                      </td>
                      <td>
                        <time className="table-time">{shortTime(d.createdAt)}</time>
                        <span className="table-date">
                          {new Date(d.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </td>
                      <td>
                        <button
                          className="icon-button row-inspect"
                          aria-label={`Inspect ${d.eventId}`}
                          onClick={() => inspectDelivery(d)}
                        >
                          <ArrowRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!paginated && virtualRows.length > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={7}
                      style={{
                        height: Math.max(
                          0,
                          virtual.getTotalSize() - (virtualRows.at(-1)?.end ?? 0),
                        ),
                        padding: 0,
                        border: 0,
                      }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching deliveries"
            description="Try a different event ID, status or destination."
            action={
              <button className="button secondary" onClick={() => setParams({})}>
                Clear filters
              </button>
            }
          />
        )}
        <div className="table-footer">
          <span>
            {number(rows.length)} matching {rows.length === 1 ? 'event' : 'events'}
            <i />
            Newest first · local data
          </span>
          {paginated ? (
            <div className="pagination">
              <button
                className="icon-button"
                aria-label="Previous page"
                disabled={page === 0}
                onClick={() => update('page', String(page - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page {page + 1} of {Math.max(1, Math.ceil(rows.length / 25))}
              </span>
              <button
                className="icon-button"
                aria-label="Next page"
                disabled={(page + 1) * 25 >= rows.length}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(page + 1));
                  setParams(next, { replace: true });
                  scrollRef.current?.scrollTo({ top: 0 });
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <button className="text-link" onClick={() => setPaginated(true)}>
              Keyboard-friendly pagination <ArrowRight size={13} />
            </button>
          )}
        </div>
      </section>
      <div className="table-help">
        <span>
          <span className="status-dot" />
          Persisted in this browser
        </span>
        <span>
          Selection is reviewed before queuing · delivery identity prevents duplicate replay
        </span>
      </div>
      {inspect && (
        <DeliveryInspector
          key={inspect.id}
          book={book}
          delivery={inspect}
          onClose={clearInspector}
          onReplay={() => setReplay([inspect.id])}
        />
      )}
      {replay && <ReplayModal book={book} ids={replay} onClose={() => setReplay(null)} />}
    </>
  );
}
