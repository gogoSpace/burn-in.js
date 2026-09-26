# Custom lift curve verification

Verified on 2026-09-26 against feature code based on `main` commit `a9f39f9`. Package version remains `0.1.2` pending review and the separate `0.2.0` release process.

## Automated checks

Local environment: Node `22.21.1`, npm `10.9.4`, macOS.

| Check | Result |
| --- | --- |
| `npm ci` | Passed; dependency manifests unchanged. |
| `npm run typecheck` | Passed, including declaration generation. |
| `npm test` | 42 tests passed in 3 files; 2 regression snapshots passed. |
| `npm run build` | Passed; core and Vue modules and declarations generated. |
| `npm run build:demo` | Passed. |
| `npm run pack:dry` | Passed; 14 files, including both entry points and the new public option declaration. |
| `git diff --check` | Passed. |

The trajectory snapshots were recorded on the unmodified implementation before adding the curve. They cover seeded fire and smoke positions, size, and opacity. Further tests cover the normalized per-particle input, expiry, exact legacy-ramp equivalence, quadratic curves at three base lift values, zero and negative multipliers, invalid JavaScript return values, thrown errors, recovery on the next step, completion, and independent callback resolution through presets.

The existing CI repeats tests, builds, and packing on Ubuntu with Node 22. Its result is tracked on the PR and is separate from the local results above.

`npm ci` reported 8 existing development dependency audit findings (1 low, 2 moderate, 5 high). `npm audit --omit=dev --json` reported zero findings. No dependency versions were changed by this feature.

## Real-browser checks

Used headed Chrome `153.0.8010.53` on macOS through Playwright, with viewports `1440 × 1000` and `390 × 844`. The narrow viewport is a desktop-browser simulation, **not a physical mobile device or a Safari/WebKit check**.

The existing demo provided the target and layout. Its automatic animation was paused using the reduced-motion preference, and the built `dist/index.js` module was imported into the page to exercise the public `burn()` API directly. No demo source changes were needed.

For each viewport:

- Ran the default effect, the README's custom fire/smoke curves, and curves alternating `NaN` with thrown errors, all to completion with default particle counts and timing.
- Sampled canvas alpha pixels around 700 and 1050 ms: both samples were nonblank and different. Inspected active and completed screenshots for framing and layout.
- Confirmed `onDone` fired once, `done` resolved, final target opacity was `1`, the overlay was removed, and the document had no horizontal overflow.
- Observed callback inputs starting at `0` and remaining below `1` for both particle types.
- Cancelled an active custom animation twice: `onCancel` fired once, `onDone` did not fire, `done` resolved, original opacity `0.7` returned, the canvas disappeared, and callbacks stopped.
- Cancelled before a 500 ms delayed ignition and waited beyond the delay: no particles or callback invocations appeared.

All six complete animations and four cancellation scenarios passed with zero uncaught page errors. Chrome's canvas-readback performance warnings were caused by the verification's `getImageData` sampling; the library's rendering path was unchanged.

## Curve overhead

Synthetic benchmark in the same Chrome session: 6,000 fire plus 3,600 smoke particles, 100 warm-up updates, then 30 samples of 25 updates each, rotating scenario order. Main and feature sources were transpiled with identical TypeScript settings. Lifetimes were set to one billion updates to keep the particle count constant. Timing included both particle update loops and their normal allocations, but excluded spawning, canvas bounds, and rendering.

| Scenario | Median per 9,600-particle update | 95th percentile |
| --- | --- | --- |
| Original main, no curve | 0.192 ms | 0.200 ms |
| Feature, no curve | 0.232 ms | 0.244 ms |
| Feature, README curves | 0.292 ms | 0.300 ms |

The median paired difference was **+0.056 ms** for the custom curves versus the feature without curves, and **+0.040 ms** for the feature without curves versus original main. The absolute overhead was small in this environment. These are local CPU measurements of particle updates, not rendered FPS, a mobile performance guarantee, or a bound on the cost of arbitrary user callbacks.

## Review and release

Review the callback contract and fallback policy before merging. The renderer, default options, palettes, counts, timing, dependency manifests, demo source, and CI configuration are unchanged. Follow [the 0.2.0 release checklist](./release-0.2.0.md) only after review and approval.
