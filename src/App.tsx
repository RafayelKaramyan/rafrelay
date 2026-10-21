import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Cable,
  CircleHelp,
  Command,
  ExternalLink,
  Github,
  Layers3,
  LayoutDashboard,
  Menu,
  Pause,
  Play,
  Search,
  ShieldCheck,
  TerminalSquare,
  X,
} from 'lucide-react';
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { downloadJson, runtime, useWorkspace } from './core/runtime';
import { Overview } from './pages/Overview';
import { Deliveries } from './pages/Deliveries';
import { Destinations } from './pages/Destinations';
import { Runs } from './pages/Runs';
import { Playground } from './pages/Playground';
import { Empty, ErrorNote, LoadingButton, Modal } from './ui/primitives';
import { errorMessage } from './ui/format';
const navigation = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/deliveries', label: 'Delivery queue', icon: Activity },
  { path: '/destinations', label: 'Destinations', icon: Cable },
  { path: '/runs', label: 'Replay runs', icon: Layers3 },
  { path: '/playground', label: 'Contract playground', icon: TerminalSquare },
];
function Guide({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="A workspace built for recovery"
      subtitle="Rafrelay · independent integration operations portfolio"
      onClose={onClose}
      wide
    >
      <div className="modal-body guide-body">
        <div className="guide-intro">
          <ShieldCheck size={28} />
          <p>
            A hands-on local sandbox with fictional partners and events. Every metric comes from
            the saved workspace; every replay runs through a Web Worker.
          </p>
        </div>
        <ol>
          <li>
            <strong>Investigate</strong>
            <p>
              Open Delivery queue, filter “Needs attention” and inspect the payload and attempt
              history.
            </p>
          </li>
          <li>
            <strong>Configure</strong>
            <p>
              Open Ledger Relay, choose a Healthy response policy and save a reason for the
              change. Changes are guarded by revision.
            </p>
          </li>
          <li>
            <strong>Recover</strong>
            <p>
              Select up to 100 failed events, review eligible and blocked items, then queue a
              replay. Follow its progress, pause or resume, and export evidence.
            </p>
          </li>
          <li>
            <strong>Experiment</strong>
            <p>
              Use Contract playground to validate JSON and queue a test event. Intermittent and
              Rate limited policies exercise real retry and backoff state transitions.
            </p>
          </li>
        </ol>
        <div className="guide-boundaries">
          <h3>What this demo models</h3>
          <p>
            Atomic claims in one browser database, expiring worker leases, local cross-tab
            updates, strict event contracts and identity checks. One attempt per run is in
            flight, at a maximum of 1–5 events/s.
          </p>
          <h3>Where the boundary is</h3>
          <p>
            No external HTTP dispatch, authentication, server, shared team state or tamper-proof
            audit. IndexedDB belongs to this browser profile and may be cleared or evicted. Keep
            a workspace tab open for dispatch; exported JSON is evidence, not an import backup.
          </p>
          <p>
            Bounded history: 2,400 deliveries, 24 destinations, 8 active runs, latest 40 runs,
            120 activity entries and 8 attempts per delivery. Seeded history is fictional;
            destination policies describe future simulation behaviour.
          </p>
        </div>
      </div>
      <div className="modal-footer">
        <a
          href="https://github.com/RafayelKaramyan/rafrelay"
          target="_blank"
          rel="noreferrer"
          className="button secondary"
        >
          <Github size={15} />
          View source
          <ExternalLink size={13} />
        </a>
        <button className="button primary" onClick={onClose}>
          Explore workspace
          <ArrowRight size={15} />
        </button>
      </div>
    </Modal>
  );
}
function CommandMenu({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState(''),
    navigate = useNavigate();
  const choices = navigation.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <Modal title="Go to…" onClose={onClose}>
      <div className="command-search">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Search workspace pages"
          placeholder="Search pages or tools…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && choices[0]) {
              void navigate(choices[0].path);
              onClose();
            }
          }}
        />
        <kbd>↵</kbd>
      </div>
      <div className="command-options">
        {choices.map((n) => (
          <button
            key={n.path}
            onClick={() => {
              void navigate(n.path);
              onClose();
            }}
          >
            <n.icon size={18} />
            {n.label}
            <ArrowRight size={14} />
          </button>
        ))}
        {!choices.length && <p>No matching page. Try “delivery” or “contract”.</p>}
      </div>
    </Modal>
  );
}
function Recovery() {
  const state = useWorkspace(),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="startup-screen">
      <Link to="/" className="brand startup-brand">
        <span className="brand-mark">R</span>rafrelay<span className="brand-dot">.</span>
      </Link>
      {state.phase === 'loading' ? (
        <>
          <div className="startup-loader" />
          <h1>Opening your workspace</h1>
          <p>Loading recorded events and saved runs from this browser.</p>
        </>
      ) : (
        <>
          <span className="startup-error">
            <ShieldCheck size={30} />
          </span>
          <h1>The workspace needs attention</h1>
          <p>{state.error}</p>
          <div className="startup-actions">
            <button className="button primary" onClick={runtime.retry}>
              Retry opening
            </button>
            {state.corrupt !== undefined && (
              <>
                <button
                  className="button secondary"
                  onClick={() => downloadJson('rafrelay-recovery.json', state.corrupt)}
                >
                  Export recovery data
                </button>
                <button className="button ghost" onClick={() => setConfirm(true)}>
                  Reset local workspace
                </button>
              </>
            )}
          </div>
          <p className="local-disclosure">
            Saved data is preserved until you explicitly reset it. If browser storage is
            blocked, enable it for this site and retry.
          </p>
        </>
      )}
      {confirm && (
        <Modal
          title="Replace unreadable local data?"
          subtitle="This deletes the reviewed workspace and creates a new fictional one."
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <div className="modal-body">
            <p>
              Export recovery data first if you need to retain the existing record. This action
              replaces only this browser’s Rafrelay workspace.
            </p>
            {error && <ErrorNote>{error}</ErrorNote>}
          </div>
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setConfirm(false)}>
              Keep existing data
            </button>
            <LoadingButton
              busy={busy}
              className="button danger"
              onClick={() => {
                setBusy(true);
                void runtime
                  .reset()
                  .then(() => setConfirm(false))
                  .catch((e: unknown) => setError(errorMessage(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Reset workspace
            </LoadingButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Workspace() {
  const state = useWorkspace(),
    [guide, setGuide] = useState(false),
    [command, setCommand] = useState(false),
    [menu, setMenu] = useState(false);
  const location = useLocation(),
    main = useRef<HTMLElement>(null),
    drawer = useRef<HTMLElement>(null),
    menuButton = useRef<HTMLButtonElement>(null),
    previousRoute = useRef<string | null>(null);
  useEffect(() => runtime.connect(), []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMenu(false);
        setCommand((old) => !old);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useLayoutEffect(() => {
    if (menu) {
      drawer.current
        ?.querySelector<HTMLElement>('.navigation-close')
        ?.focus({ preventScroll: true });
    }
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = menuButton.current;
    document.body.style.overflow = 'hidden';
    const handler = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false);
      }
      if (event.key === 'Tab') {
        const nodes = Array.from(
          drawer.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)') ?? [],
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [menu]);
  useEffect(() => {
    if (state.phase !== 'ready') return;
    if (previousRoute.current === null) {
      previousRoute.current = location.pathname;
      return;
    }
    if (previousRoute.current !== location.pathname) {
      previousRoute.current = location.pathname;
      main.current?.querySelector('h1')?.focus();
      window.scrollTo({ top: 0 });
    }
  }, [location.pathname, state.phase]);
  useEffect(() => {
    if (!state.toast) return;
    const timer = setTimeout(runtime.dismiss, 6000);
    return () => clearTimeout(timer);
  }, [state.toast]);
  const current = navigation.find((n) => n.path === location.pathname);
  if (state.phase !== 'ready' || !state.book) return <Recovery />;
  const book = state.book,
    failures = book.deliveries.filter((d) => d.status === 'failed').length,
    active = book.runs.filter((r) => r.status === 'running' || r.status === 'paused').length;
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="app-shell">
        <header className="masthead" inert={menu}>
          <div className="brand-lockup">
            <Link to="/" className="brand" aria-label="Rafrelay overview">
              <span className="brand-mark" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              rafrelay<span className="brand-dot">/</span>
            </Link>
            <span className="brand-caption">
              Partner integration
              <br />
              studio
            </span>
          </div>
          <div className="masthead-actions">
            <span className="sandbox-badge">
              <span />
              LOCAL SANDBOX
            </span>
            <button
              className="command-trigger"
              onClick={() => setCommand(true)}
              aria-label="Search workspace"
            >
              <Search size={16} />
              <span>Find a page</span>
              <kbd>
                <Command size={10} /> K
              </kbd>
            </button>
            <button
              className="icon-button motion-toggle"
              aria-label={
                book.motionPaused ? 'Enable interface motion' : 'Pause interface motion'
              }
              aria-pressed={book.motionPaused}
              onClick={() => {
                void runtime
                  .toggleMotion()
                  .catch((e: unknown) => runtime.notify(errorMessage(e), true));
              }}
            >
              {book.motionPaused ? <Play size={17} /> : <Pause size={17} />}
            </button>
            <button
              className="icon-button"
              aria-label="Open workspace guide"
              onClick={() => setGuide(true)}
            >
              <CircleHelp size={19} />
            </button>
            <a
              className="source-link"
              href="https://github.com/RafayelKaramyan/rafrelay"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={16} />
              <span>Source code</span>
              <ExternalLink size={12} />
            </a>
            <button
              ref={menuButton}
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
          </div>
        </header>
        {menu && (
          <button
            className="mobile-scrim"
            aria-label="Close navigation"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setMenu(false)}
          />
        )}
        <aside
          ref={drawer}
          className={`navigation-shell ${menu ? 'navigation-open' : ''}`}
          role={menu ? 'dialog' : undefined}
          aria-modal={menu || undefined}
          aria-label={menu ? 'Workspace navigation drawer' : 'Workspace sections'}
        >
          <div className="mobile-nav-heading">
            <span>Explore the studio</span>
            <button
              className="navigation-close icon-button"
              aria-label="Close navigation drawer"
              onClick={() => setMenu(false)}
            >
              <X size={21} />
            </button>
          </div>
          <nav aria-label="Workspace navigation">
            {navigation.map((n, index) => (
              <NavLink
                key={n.path}
                to={n.path}
                end={n.path === '/'}
                onClick={() => setMenu(false)}
              >
                <span className="nav-index" aria-hidden="true">
                  0{index + 1}
                </span>
                <span>{n.label}</span>
                {n.path === '/deliveries' && failures > 0 && (
                  <b className="nav-count">{failures}</b>
                )}
                {n.path === '/runs' && active > 0 && (
                  <i className="nav-live" aria-hidden="true" />
                )}
              </NavLink>
            ))}
          </nav>
          <button
            className="drawer-guide text-link"
            onClick={() => {
              setMenu(false);
              setGuide(true);
            }}
          >
            <CircleHelp size={17} /> Workspace guide
          </button>
          <div className="nav-context">
            <span className="context-mark">N</span>
            <span>
              Northline<span className="context-caption">Integration workspace</span>
            </span>
          </div>
        </aside>
        <div className="workspace-main" inert={menu}>
          <div className="workspace-wayfinding">
            <span>NORTHLINE / {current?.label.toUpperCase() ?? 'PAGE NOT FOUND'}</span>
            <span>INDEPENDENT PRODUCT BY RAFAYEL KARAMYAN</span>
          </div>
          <main id="main-content" ref={main} tabIndex={-1}>
            {(state.engine === 'offline' || state.error) && (
              <div className="engine-error" role="alert">
                <ShieldCheck size={18} />
                <span>{state.error || 'Replay worker is offline.'}</span>
                <button className="button secondary" onClick={runtime.restart}>
                  Restart worker
                </button>
              </div>
            )}
            <Routes>
              <Route path="/" element={<Overview book={book} />} />
              <Route path="/deliveries" element={<Deliveries book={book} />} />
              <Route path="/destinations" element={<Destinations book={book} />} />
              <Route path="/runs" element={<Runs book={book} />} />
              <Route path="/playground" element={<Playground book={book} />} />
              <Route
                path="*"
                element={
                  <>
                    <h1 tabIndex={-1}>Page not found</h1>
                    <Empty
                      title="This page is outside the workspace"
                      description="Return to an existing page to continue exploring."
                      action={
                        <Link className="button primary" to="/">
                          Open overview
                          <ArrowRight size={15} />
                        </Link>
                      }
                    />
                  </>
                }
              />
            </Routes>
          </main>
          <footer className="app-status">
            <span>
              <i className={`status-dot ${state.engine !== 'ready' ? 'status-off' : ''}`} />
              {state.engine === 'ready' ? 'Replay engine ready' : 'Replay engine offline'}
            </span>
            <span>
              Browser-local persistence
              <ShieldCheck size={11} />
            </span>
            <span className="app-version">
              RAFRELAY <b>/</b> Integration studio <b>·</b> v1.0
            </span>
          </footer>
        </div>
      </div>
      {state.toast && (
        <div
          className={`toast ${state.toast.error ? 'toast-error' : ''}`}
          role={state.toast.error ? 'alert' : 'status'}
        >
          <span>{state.toast.message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={runtime.dismiss}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {guide && <Guide onClose={() => setGuide(false)} />}{' '}
      {command && <CommandMenu onClose={() => setCommand(false)} />}
    </>
  );
}
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Workspace />
    </BrowserRouter>
  );
}
