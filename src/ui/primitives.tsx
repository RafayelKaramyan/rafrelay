import { createPortal } from 'react-dom';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  LoaderCircle,
  Pause,
  X,
  XCircle,
} from 'lucide-react';
import type { Book, Delivery, Run } from '../core/model';
import { downloadJson } from '../core/runtime';

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  const Icon =
    status === 'delivered' || status === 'completed' || status === 'healthy'
      ? CheckCircle2
      : status === 'failed' || status === 'unavailable'
        ? XCircle
        : status === 'paused'
          ? Pause
          : status === 'sending' || status === 'working' || status === 'running'
            ? LoaderCircle
            : status === 'queued' || status === 'pending'
              ? Clock3
              : Circle;
  return (
    <span className={`badge badge-${status}`}>
      <Icon size={12} aria-hidden="true" />
      {children ?? status}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 tabIndex={-1}>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  busy = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId(),
    subtitleId = useId();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous !== document.body && previous.isConnected)
        previous.focus();
      else document.querySelector<HTMLElement>('main h1')?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close.current();
      }}
    >
      <div className="modal-heading">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p id={subtitleId}>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <Check size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="error-note">
      <XCircle size={16} aria-hidden="true" />
      {children}
    </p>
  );
}
export function LoadingButton({
  busy,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy: boolean }) {
  return (
    <button {...props} disabled={busy || props.disabled}>
      {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
export function ExportButton({
  book,
  run,
  delivery,
}: {
  book: Book;
  run?: Run;
  delivery?: Delivery;
}) {
  return (
    <button
      className="button secondary"
      onClick={() => {
        const ids = new Set(
          run?.items.map((item) => item.deliveryId) ??
            (delivery ? [delivery.id] : book.deliveries.map((item) => item.id)),
        );
        const deliveries = book.deliveries.filter((item) => ids.has(item.id));
        downloadJson(
          `rafrelay-${run ? 'run' : delivery ? 'delivery' : 'workspace'}-${new Date().toISOString().slice(0, 10)}.json`,
          {
            product: 'Rafrelay',
            schemaVersion: 1,
            mode: 'local-simulator',
            exportedAt: new Date().toISOString(),
            generation: book.generation,
            revision: book.revision,
            scope:
              'Fictional local events. No external HTTP requests, real credentials or production audit guarantees.',
            destinations: book.destinations.filter((target) =>
              deliveries.some((item) => item.destinationId === target.id),
            ),
            deliveries,
            runs: run
              ? [run]
              : delivery
                ? book.runs.filter((item) =>
                    item.items.some((entry) => entry.deliveryId === delivery.id),
                  )
                : book.runs,
            activity: book.activity,
          },
        );
      }}
    >
      <ArrowDownToLine size={15} />
      Export {run || delivery ? 'evidence' : 'workspace'}
    </button>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={14} />
    </button>
  );
}
