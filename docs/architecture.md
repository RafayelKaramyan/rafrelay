# Architecture and tradeoffs

Rafrelay models the operator side of an integration incident: identify a failure, inspect its contract and attempt history, review configuration, queue eligible records, then verify and export the result.

## State ownership

`core/model.ts` owns schemas and pure commands. `core/database.ts` owns IndexedDB transaction boundaries. `core/runtime.ts` connects durable commands, worker acknowledgements, cross-tab revision notifications and React’s external-store subscription. Pages render derived state and collect operator intent.

A command reads the current saved workspace inside a read/write transaction, validates its preconditions, and writes the next workspace as one record. No asynchronous work occurs inside the transaction callback. React receives the new state only after `transaction.oncomplete`. This keeps activity and configuration changes together and avoids an optimistic success message after a failed write.

The single-record approach is intentionally bounded. It simplifies atomicity but reparses the workspace on each command and is unsuitable for unbounded event history. A production service would move queue ownership and leases to a server, normalize records, paginate queries and enforce authorization there.

## Replay safety

A plan reviews event status, strict payload validity, matching event identity, subscriptions, destination availability and duplicate/reserved keys. Its fingerprint includes workspace generation and the selected records’ and destinations’ revisions. Starting the run recomputes the plan in the committing transaction. Unrelated edits do not invalidate a plan; a changed selected destination does.

A claim assigns an attempt token and five-second lease in one transaction. Multiple tabs cannot claim the same live item. The worker validates its input and simulates a response. Completion checks the token, current item state and cancellation before updating an outcome. A duplicate or old response is ignored. If a tab closes, a later tab can reclaim the expired lease.

Identity is scoped to `destinationId/eventId`. Active runs reserve this key; acknowledged equivalents cannot be selected again. Completion also checks for an acknowledged equivalent before accepting a result. This is a local simulation of idempotency, not a guarantee of exactly-once delivery to a remote service.

Policies are captured at claim time. Changing a policy affects the next claim. The current maximum-attempt setting is checked at completion. Transient errors use a 400 ms exponential backoff capped at 2.4 seconds, subject to the per-run maximum dispatch rate and the simulator’s response latency. No network client or secret signing system exists.

Pause prevents new claims while allowing an in-flight attempt to finish. Cancel invalidates outstanding tokens and preserves finished outcomes. Worker teardown does not invent a delivery acknowledgement; its lease can expire and be reclaimed.

## UI and persistence

Filters are URL state; selection and form drafts are transient. Configuration, completed attempts, queued work, run controls, activity and the motion setting are durable. Virtual scrolling bounds the table DOM. A paginated alternative supports predictable keyboard navigation and is tested independently.

Invalid saved schemas produce a recovery screen rather than silently reseeding. Reset compares the reviewed unreadable value against the current saved value before replacement. JSON evidence bundles include their generation, revision, records, destinations, runs and activity, and explicitly label the local simulator boundary.

## Deployment

GitHub Pages serves a static React application at `/rafrelay/`. Self-hosted font files avoid a third-party font request. The worker and all application assets are built by Vite. Native browser storage and Worker support are required; unavailable storage and failed worker startup have visible recovery states. Direct client routes use a custom static 404 fallback.
