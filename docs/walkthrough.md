# Code walkthrough

Use one incident to explain the implementation: Ledger Relay is unavailable, a valid event fails, configuration is reviewed, then that event is replayed. Include an invalid event in the selection to demonstrate why a recovery tool needs eligibility rules.

## Follow the data, not just the screens

1. `seed.ts` produces fictional history and four destinations. Every dashboard total is derived by `getMetrics`; the traffic chart groups saved records into two-minute buckets.
2. `DeliveryInspector.tsx` renders the saved payload and the latest eight attempts. `validatePayload` parses unknown JSON through a strict schema and returns field paths.
3. `DestinationEditor` captures the reviewed generation and revision once. `saveDestination` checks both against the current saved record and requires a reason. A competing tab cannot silently overwrite it.
4. `ReplayModal.tsx` freezes an eligibility plan. `startReplay` recomputes that plan inside the committing database transaction. Only eligible records become queued, and the reason is saved with the run.
5. `claimWork` assigns the token and expiring lease. `transport.worker.ts` validates the work message and simulates the destination policy without blocking React or sending network traffic.
6. `completeWork` accepts only the matching current lease. It records an acknowledgement, schedules a bounded retry or finishes the item. Cancellation removes authority from late responses.
7. `ExportButton` builds a real JSON evidence bundle from current records. Its downloaded payload is asserted by the browser suite rather than substituting a notification for a download.

## Decisions to be able to defend

| Decision                     | Benefit                                                          | Cost or limit                                                          |
| ---------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| One workspace record         | Atomic configuration, activity and queue transitions             | Full bounded record is read and parsed per command                     |
| Token plus expiring lease    | Cross-tab claim ownership and recovery after tab closure         | Browser timers can be delayed; this is not a remote delivery guarantee |
| Fingerprint selected records | Rejects stale reviews without rejecting unrelated edits          | A changed relevant record requires the operator to review again        |
| Worker simulator             | Actual asynchronous attempts with deterministic failure policies | No external HTTP, credentials, signing or server queue                 |
| Virtual and paginated table  | Bounded DOM and an alternative for keyboard users                | Two browsing modes need their own verification                         |
| Local evidence export        | Portable review of the run and its reasons                       | No import flow or tamper-proof audit                                   |

The important distinction is between an operation being requested, durably queued, claimed and acknowledged. The UI reflects each state rather than treating a click as a successful delivery.
