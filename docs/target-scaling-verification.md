# Target-relative scaling contract and verification

## Scale basis follow-up — 2026-09-27

The unpublished 0.3.0 release now also accepts a selected scale basis: shorter
side (default), width, height, font size, or a synchronous target callback.
Reference size uses the selected basis in CSS pixels. Geometry remains generic
for every supported target. Wrapping a text target without changing font size
must not change particle sizes or motion when font-size is selected. Changes
to font size or callback output must update live geometry even when the target
rectangle stays unchanged. Invalid results and callback errors fall back to
legacy scale 1; omitted reference size must not evaluate the basis.

Continue in the existing checkout on feat/scale-basis from current origin/main.
Add deterministic renderer tests and a native canvas regression for wrapping,
font changes, callback evaluation, both particle kinds, and existing defaults.
Use a new reviewed PR and passing CI before updating the pending 0.3.0 archive.
No new version bump is needed while registry latest remains 0.2.0. The prior
2FA publication was cancelled. Never publish that superseded archive.

## Contract — 2026-09-27

Implement one opt-in `referenceSize?: number` option, in CSS pixels, shared by all
supported targets and masks. The uniform scale is the shorter rendered target side
divided by this reference. Width alone therefore does not enlarge flames on a wide
heading. Omission, invalid references, or invalid target dimensions use scale 1.
Existing calls and seeded default trajectories remain compatible.

Keep mask sampling, emission, particle simulation, mask offsets, and canvas margins
in reference coordinates. Map those coordinates uniformly to CSS pixels at the
existing canvas renderer. Keep backing-store pixel ratio separate. Uniform target
resize must preserve particle counts, normalized motion, lifetime, opacity,
timing, and lift-curve inputs. Rebuild masks on size changes and preserve live
particle state. No new dependencies, renderer, palettes, or particle-budget changes.

Allowed changes: library source, deterministic tests, README, changelog, and these
verification/release notes. Demo changes only if needed to explain the option.
Use the existing clean checkout on `feat/target-relative-scaling`, based on
`e1d1d2ddc28bf7dd5c4635d0d5a8859166efc80b`. Other checkouts and consumer projects
are outside the write set. No screenshots or consumer-site visual inspection.
No delegated subagents. Commits are authorized; never amend a commit.

Acceptance: rendered fire/smoke geometry and trajectories at 0.5×, 1×, and 2×;
counts, timing, callbacks, all supported mask paths, aspect ratio, resizing,
invalid/zero dimensions, pixel ratio independence, and legacy snapshots. Run
`npm test`, `npm run typecheck`, `npm run build`, `npm run build:demo`,
`npm run pack:dry`, and `git diff --check`. Add a real-browser functional check
without screenshots. Review feature PR and successful CI, merge, then create a
separate minor-version PR. Revalidate the merged release commit before packing.
Verify npm archive integrity/latest tag, Git tag, and GitHub release.

Stop for conflicting concurrent changes, an unresolved compatibility failure, or
an actual credential/2FA requirement. Report the exact pending action; do not
repeat ambiguous publication or leave multiple publication processes running.

## Status

- Readiness: checkout clean and unused; branch created from current `origin/main`.
- Registry checked: `latest` is `0.2.0`; planned minor is `0.3.0`.
- Current milestone: implementation and deterministic rendering tests.
- Next gate: local automated checks and browser functional verification.

## Local acceptance — 2026-09-27

Node `22.21.1`, npm `10.9.4`, macOS. All commands passed:

| Gate | Evidence |
| --- | --- |
| `npm ci` | Passed with unchanged dependency manifests. |
| `npm test` | 109 tests in 4 files, including both unchanged legacy trajectory snapshots. |
| `npm run typecheck` | Source, test, demo, and declaration checks passed. |
| `npm run build` | Core and Vue bundles/declarations generated. |
| `npm run build:demo` | Existing demo compiled. No demo UI change needed. |
| `npm run pack:dry` | 14 intended package files; referenceSize declaration included. |
| `git diff --check` | Passed. Dependency manifests unchanged. |

The new deterministic tests observe canvas drawing, transformation, positioning,
and expansion rather than private particle state. Coverage includes both particle
types at 0.5×/1×/2×, nine target/mask combinations, normalized trajectories,
sizes, opacity, emission below the limit and at the limit, completion timing,
custom and default lift curves, long-side-only changes, both frame-driven and
viewport-driven resize, invalid target/reference dimensions, and fractional
backing-store ratios. The fake DOM moved into a shared fixture; original snapshot
contents are unchanged.

The clean install reports the same eight existing development dependency audit
findings recorded for 0.2.0. This feature changes no dependency version.

## Native canvas verification

Run after building, using an already available Playwright installation and Chrome:

```bash
node tests/browser-scaling.mjs /absolute/path/to/playwright/index.mjs
```

This optional script adds no dependency and captures no screenshots. It imports
the built `dist/index.js` and executes real Canvas 2D calls in Chrome, including
pixel readback to prove the output is nonblank. The deterministic clock makes
frame-by-frame comparisons reproducible; separate checks use the real animation
clock for completion and cancellation.

Chrome `153.0.8010.53`: **51 scenarios passed**, zero page errors. Forty-eight
multi-particle scenarios cover bounds, image and canvas auto/alpha/luminance,
and text masks; 0.5×/1×/2× size; pixel ratios 1/2; and live resize to 0.5×/2×.
Normalized rendered position and size error was at most **0.00002568 reference
pixels**, below the 0.001 gate. Emission, lift callback progress, reveal, particle
opacity, completion, and cleanup matched.

Three additional text cases use a font size whose DOM ranges round differently
across scales. They compare displacement and fading from each particle's birth,
with one live particle of each kind, while retaining strict count/lifetime/size
checks. DOM text range rounding can move glyph-edge mask samples and therefore
seeded birth positions and initial mask weights; README documents this precision
limit. This is not a geometry or particle-lifetime difference.

Native rendering exposed an integer backing-store rounding error that the first
fake-canvas test did not model. The renderer now compensates that rounding using
actual backing dimensions; both suites include the CSS projection. Canonical
font rasterization avoids scale-dependent font metrics. No screenshot, consumer
site visual inspection, new renderer, color change, or dependency was used.

## Review / next gate

Local acceptance and diff review passed. Review checked API compatibility,
reference-space units, source and emitter normalization, unchanged random-number
consumption and particle caps, resize state preservation, curve semantics,
backing-store compensation, fractional positioning, and package boundaries.
No blocking finding remains. Text-mask precision and the consumer's separate
pixelRatio patch are documented limitations. Next: feature PR and CI, followed
by a separate `0.3.0` release PR and exact-commit release validation.

## Feature merged — 2026-09-27

[Feature PR #4](https://github.com/gogoSpace/burn-in.js/pull/4) passed author
self-review and [CI](https://github.com/gogoSpace/burn-in.js/actions/runs/36305003207).
Merged as `11c1b0f32a2ccf542260f6253e456c814edb12b7`. The version-only release
phase is now in progress on `release/0.3.0`; publication remains gated on its
merged commit and the checks in [the release notes](./release-0.3.0.md).

## Scale-basis acceptance — 2026-09-27

- 145 deterministic tests pass, including every previous test and unchanged
  legacy snapshots. Both particle kinds cover all five scale bases, all four
  target kinds, wrapping geometry, live font/callback changes with fixed target
  bounds, invalid measurements, unknown bases, exceptions, and omitted references.
- Typecheck, core/Vue/declaration build, demo build, package dry run, and diff
  whitespace checks pass. No dependency or manifest changes.
- 71 native Chrome 153.0.8010.53 scenarios pass, with no page errors. The 20 new
  cases cover font-size and callback bases at 0.5/1/2 scale, actual one/two-line
  text measured with DOM ranges, wrapping during playback, and increasing or
  decreasing font size inside fixed bounds. Rendered sizes, normalized motion
  from birth, fade/lifetime, completion, and capped counts match. Maximum error
  remains 0.00002568 reference pixels. No screenshots were taken.
- Self-review checked owner-window font measurement, one callback evaluation per
  layout check, error isolation, refresh detection beyond bounding-box changes,
  reference-space mask and particle geometry, package exports, and documentation.
  The prepared 0.3.0 remains unpublished; next gate is this follow-up PR and CI.
