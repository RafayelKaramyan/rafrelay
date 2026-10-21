# Validation record

## Verified release — 22 October 2026

- Application commit: `fbc35236d07bf33e4d05354b9a421493eb41ae8e`.
- [Successful verification and GitHub Pages deployment](https://github.com/RafayelKaramyan/rafrelay/actions/runs/39687211712).
- [Published demo](https://rafayelkaramyan.github.io/rafrelay/).
- Clean Node.js 22 dependency installation, strict TypeScript, zero-warning ESLint, formatting and production build passed.
- **39 domain/database tests passed** in two files. These cover concurrent IndexedDB initialization, conflicting configuration saves, single lease ownership across connections, stale review rejection, storage rollback, preserved unreadable records, deduplication, pause/resume/cancel, bounded retries and late acknowledgements.
- **42 browser cases passed:** fourteen each in desktop Chromium, desktop Firefox and Pixel 7 Chromium emulation. No cases were skipped or retried.

## Browser coverage and visual review

The browser suite verifies derived dashboard metrics, route focus, mobile navigation, URL filters, keyboard pagination, bounded virtual DOM, inspector/dialog focus, mixed replay eligibility and reload persistence, pause/resume/cancel, retries, concurrent-tab configuration conflicts, malformed JSON and test dispatch, actual downloaded JSON contents, motion controls, rejected storage and preserved unreadable records.

Representative axe scans run across all five routes and an open event inspector. Download assertions parse the generated JSON and check actual run status, reason and attempt response codes. Screenshots from the successful run were inspected on desktop and mobile, including the mobile integration heading/topology layout. These captures are available in the workflow's seven-day `browser-evidence` artifact; the [mobile overview](images/overview-mobile.png) is retained in this repository.

The browser review caught and corrected entry-animation contrast, sidebar overflow on short viewports, action and POST-badge contrast, and a mobile health-panel layout collision. The final successful run includes those corrections; accessibility rules were not excluded to obtain a pass.

## Separate public-demo review

The deployed site was opened in Cloud Browser, independently of the CI test server:

1. Changed Ledger Relay from Unavailable to Healthy with a recorded reason.
2. Selected `evt_001800` and `evt_001796`. The replay review excluded the invalid contract and accepted only the eligible delivery.
3. Queued the eligible event with the reason `Public demo: verified recovery of evt_001796 after configuration review`.
4. Observed a completed 1/1 run. A full reload retained the result and exact reason. The delivery inspector showed the original HTTP 503 and the subsequent HTTP 202 acknowledgement.
5. Triggered **Export evidence** and observed a completed browser download event. This cloud browser's returned download path was not readable from either filesystem, so no local export-file attachment is claimed. Exact JSON bytes were parsed and asserted in all three CI browser projects.
6. Reloaded the deployed overview after the final mobile correction. It retained 1,690 acknowledged deliveries, 110 failures, two healthy destinations and one run in history. The [published workspace capture](images/overview.jpg) records this state.

Earlier interactive review also exercised contract validation, unique test queueing and worker completion in a 390px responsive frame, and inspected 390px and 768px layouts.

## Verification limits

This is a browser-local simulator using fictional records, not external event delivery or a shared production service. Pixel 7 and responsive frames are emulation; physical devices, Safari and assistive-technology sessions were not exercised. Representative automated accessibility checks are not a complete accessibility certification. No Lighthouse, Core Web Vitals, production availability or external throughput benchmark is claimed.

GitHub Pages serves client routes through `404.html`; a direct route may retain an HTTP 404 status while the app renders. IndexedDB storage may be cleared or evicted, background timers may delay work, and exports are evidence rather than a supported import backup. Release documentation and image changes after the tested application commit do not alter the deployed application.
