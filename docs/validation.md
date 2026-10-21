# Validation record

## Visual refresh — 22 October 2026

- Application commit: `e82cba44b0f185779ad402e653e23a108545ecb4`.
- [Verification and GitHub Pages deployment](https://github.com/RafayelKaramyan/rafrelay/actions/runs/39691992498).
- [Published demo](https://rafayelkaramyan.github.io/rafrelay/).
- Clean Node.js 22 dependency installation, strict TypeScript, zero-warning ESLint, formatting and production build passed.
- **39 domain/database tests passed** in two files. These cover concurrent IndexedDB initialization, conflicting configuration saves, single lease ownership, stale review rejection, storage rollback, preserved unreadable records, deduplication, pause/resume/cancel, bounded retries and late acknowledgements.
- **48 browser cases passed:** sixteen each in desktop Chromium, desktop Firefox and Pixel 7 Chromium emulation. No cases were skipped or retried.

## Browser coverage and visual review

The suite verifies derived metrics, route focus, navigation, URL filters, keyboard pagination, bounded virtual DOM, inspector/dialog focus, mixed replay eligibility and reload persistence, pause/resume/cancel, retries, concurrent-tab configuration conflicts, malformed JSON and test dispatch, actual downloaded JSON contents, motion controls, rejected storage and preserved unreadable records.

The two added scenarios exercise the refreshed interface: opening configuration from the routing map, reflecting a saved policy after navigating home and reloading, and checking all five tools at both 320px and 768px. The compact navigation check verifies initial close-button focus, Escape close and return to the opening button. Desktop, tablet and compact screenshots were visually inspected. The [mobile overview](images/overview-mobile.png) is retained in this repository; the workflow's complete `browser-evidence` artifact is retained for seven days.

Representative axe scans run across all five routes and an open event inspector. Download assertions parse generated JSON and check actual run status, reason and attempt response codes. These checks passed with the new palette and layout without excluding accessibility rules.

The first refresh run passed 45 browser cases. The new home/reload scenario caught a missing trailing slash in the router's deployment base: returning to the overview produced `/rafrelay`, which Vite's preview server could not serve on reload. Preserving `/rafrelay/` fixes the actual navigation target; the regression test asserts that address and verifies the saved policy after reloading. The complete passing run includes that fix.

## Separate interactive review

Cloud Browser review of the managed preview inspected the desktop observatory, configuration dialog, dark contract editor and completed-run presentation. At 320px and 390px, the map rearranged into a source/relay pair and a destination register. The 320px document stayed within its viewport. Configuration changed through the real form, the home navigation retained its trailing slash, and a full reload retained Healthy policy and two healthy destinations. A validated playground event was queued and completed through the actual worker.

Public deployment was checked separately from the test server. The earlier completed run and Healthy destination policy remained available after the visual refresh. A mixed selection excluded invalid `evt_001800` and replayed `evt_001792`. Run `3609faed-6b95-4ec9-bbe7-2b513dce35f7` completed 1/1 and retained the exact reason `Public redesign verification: recovered evt_001792 after routing review` after reload. The inspector retained the original HTTP 503 and subsequent HTTP 202. The overview then showed 1,691 acknowledgements, 109 failures, two healthy destinations and two completed runs. The [published workspace capture](images/overview.jpg) records that refreshed interface.

The public **Export evidence** action downloaded a 3,225-byte JSON bundle. Its actual bytes were parsed and checked: schema version 1, the completed run and exact reason, `evt_001792` marked delivered, and attempt codes `[503, 202]`. The CI download scenario also parses and asserts actual JSON contents in all three browser projects.

## Earlier release

The [initial release workflow](https://github.com/RafayelKaramyan/rafrelay/actions/runs/39687211712) passed 39 domain/database tests and 42 browser cases. Its public review recovered `evt_001796` with a recorded reason and retained the completed run, original HTTP 503 and subsequent HTTP 202 after reload. The refresh changes presentation and canonical home navigation; the domain commands, worker and IndexedDB schema are unchanged.

## Verification limits

This is a browser-local simulator using fictional records, not external event delivery or a shared production service. Pixel 7 and responsive frames are emulation; physical devices, Safari and assistive-technology sessions were not exercised. Representative automated accessibility checks are not a complete accessibility certification. No Lighthouse, Core Web Vitals, production availability or external throughput benchmark is claimed.

GitHub Pages serves client routes through `404.html`; a direct route may retain an HTTP 404 status while the app renders. IndexedDB storage may be cleared or evicted, background timers may delay work, and exports are evidence rather than a supported import backup. Release documentation and image changes after the tested application commit do not alter the deployed application.
