# Rafrelay

A partner integration studio for investigating event failures, reviewing destination configuration and recovering deliveries with durable replay runs.

**Independent portfolio product by [Rafayel Karamyan](https://github.com/RafayelKaramyan).** Fictional partners and synthetic sports events; no employer affiliation.

## Try the recovery workflow

1. Open **Delivery queue → Needs attention** and inspect a Ledger Relay event. Payloads, schema errors and recorded attempts are available in the inspector.
2. Open **Destinations → Ledger Relay**, set its response policy to **Healthy**, and save a reason.
3. Select failed events and choose **Replay selected**. Review the eligible and excluded records, provide a reason and queue the run.
4. Follow **Replay runs**. Pause or resume a batch, inspect attempts after completion and export its actual JSON evidence.
5. In **Contract playground**, edit an event, validate it, then queue a test. Intermittent and rate-limited destination policies exercise retries.

The initial workspace contains 1,800 recorded events, four destinations and a deliberately recoverable incident. Traffic and outcomes derive from the saved records. The chart covers the recorded hour at workspace creation; playground events and replays remain available in the queue and run history.

## Engineering choices

- **React / strict TypeScript / Vite.** Route-based operations, URL filters, a virtual table with a paginated keyboard alternative and native dialogs.
- **Pure domain commands.** Contract validation, destination revision checks, replay planning, deduplication, run controls and bounded retry transitions live outside the UI.
- **Atomic IndexedDB transactions.** A single workspace record keeps configuration, queue transitions and their activity entries in the same commit. Commands resolve only after commit; a rejected write does not display success.
- **Web Worker transport simulator.** Bounded attempts, deterministic response policies and exponential backoff execute outside rendering. It never contacts an endpoint.
- **Cross-tab coordination.** Read/write transactions serialize claims; per-attempt tokens and five-second leases reject stale responses. BroadcastChannel announces revisions rather than transmitting whole workspaces.
- **Accessible interaction.** Visible focus, route heading focus, dialog focus return, meaningful labels, responsive layouts and both reduced-motion and a persisted motion pause control.

See [architecture](docs/architecture.md), [validation](docs/validation.md) and [the CI workflow](.github/workflows/pages.yml).

## Run locally

Node 22.12+ and npm are required.

```sh
npm ci
npm run dev
```

Open the Vite URL under `/rafrelay/`. No accounts, secrets, environment variables or external services are required.

```sh
npm run check          # strict types, lint, formatting, domain + database tests
npm run build          # production bundle
npx playwright install --with-deps chromium firefox
npm run test:e2e       # Chromium, Firefox and Pixel 7 browser projects
```

GitHub Actions verifies the code and all browser projects before publishing the built `dist` artifact to GitHub Pages. Pages uses `main` and the GitHub Actions deployment source. A custom `404.html` serves the app for direct client routes; these requests can retain an HTTP 404 status on static hosting even though the application loads.

## Deliberate demo boundary

All dispatch is **local simulation**. There is no outbound HTTP, authentication, server, shared team tenancy, real betting, payment flow or production audit guarantee. The endpoint URL is a label. Seeded attempts are fictional history; current destination policies control future simulation, not that history.

The workspace belongs to this browser profile. Keep at least one tab open to dispatch pending work; after reopening, expired leases can be reclaimed. Background browser throttling can delay work. IndexedDB can be cleared or evicted, and export is evidence rather than a supported import backup.

History is bounded: 2,400 deliveries, 24 destinations, 8 active runs, latest 40 runs, 120 activity entries and 8 attempts per delivery. Replay plans contain up to 100 unique events and permit at most 1–5 dispatches/s, with one attempt per run in flight. Validation failures and paused destinations are excluded from new plans. 429, 5xx and missing acknowledgements retry within each destination’s attempt limit; 4xx contract or pause rejections do not.

Unreadable saved data is preserved with an export/recovery screen. It is never silently replaced.
