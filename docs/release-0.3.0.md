# Release: 0.3.0

## Release contract

The registry and `origin/main` were at `0.2.0` on 2026-09-27. Target-relative
scaling is additive and opt-in, so the next release is minor `0.3.0` unless
another release appears first. The feature PR retains `0.2.0`. Prepare a separate
small PR changing both manifests and moving the Unreleased changelog into a
dated 0.3.0 section. Review both PRs and require successful CI before each merge.
All fixes use new commits; publication uses the merged release commit.

## Exact-commit gate

After merging the release PR, check out its merge commit and run:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run build:demo
npm run pack:dry
node tests/browser-scaling.mjs /absolute/path/to/playwright/index.mjs
npm pack --pack-destination /path/to/release-artifacts
```

Inspect the archive's version, both entry points, referenceSize and liftCurve
declarations, README, license, and complete file list. No publish/prepack hook
builds the package. Publish this inspected archive with public access and the
`latest` tag. If npm requests 2FA, keep one publication process and present its
actual confirmation step. For an ambiguous outcome, inspect the registry before
retrying. Do not repeat login based on historical failures.

Confirm `latest=0.3.0`, compare registry integrity and the downloaded published
archive to the locally verified archive, then push an annotated `v0.3.0` tag on
the same merge commit and create the GitHub release. Do not move an existing tag.

## Consumer integration notes

API: `burn(target, { referenceSize: 120, scaleBasis: "font-size", ...options })`,
or the same top-level options in the Vue adapter. Generic object targets may
instead use the default shorter side, width, height, or a target callback.
Keep the reference fixed across responsive sizes. Calibrate it to the desired
baseline's selected measurement, not to the current size on every replay.

For the existing gogoSpace hero, use the font-size basis for both word targets.
Choose the reference from the previously approved desktop font size so that the
existing motion is preserved there and becomes proportional elsewhere. The
value 120 above is an API example, not an approved visual setting. Do not use
the earlier shorter-side recommendation for wrapping text. The consumer retains
its own final visual review.

Spatial options now use reference units when enabled. In particular, convert a
mask offset measured in current CSS pixels using `offset / targetScale`, or use
a fixed offset calibrated at the reference size. Existing padding coefficients
remain dimensionless; compute fixed reference margins using reference target
dimensions, not current CSS dimensions. Existing breakpoint particle caps may
remain; constant caps and sampling are needed for identical cross-size budgets.

The public minimum canvas pixel ratio is still **1**. gogoSpace's `0.2.0` patch
allowing smaller ratios must be reviewed before updating its version guard and
minified function match. `resolvePixelRatio` retains its old policy, but canvas
dimensions now include target scale and `setTransform` compensates backing-store
rounding. A transform is no longer generally equal to `pixelRatio`: it maps
reference coordinates into the actual backing bitmap. Preserve that mapping
when adapting the patch. No consumer files or production deployment were changed.

## Status

[Feature PR #4](https://github.com/gogoSpace/burn-in.js/pull/4) passed review and
[CI](https://github.com/gogoSpace/burn-in.js/actions/runs/36305003207), then merged
as `11c1b0f32a2ccf542260f6253e456c814edb12b7`. The separate release branch updates
both manifests to `0.3.0` and dates the changelog. Registry `latest` was rechecked
at `0.2.0` before that bump; npm authentication is valid.

Next gate: release PR review/CI and merge, followed by the exact-commit gate above.
Final release commit, archive integrity, registry verification, and tag links are
to be recorded on the release PR and the published GitHub release once verified.

## Scale-basis follow-up before publication

The initial 0.3.0 archive was not published. Its 2FA process was cancelled while
responsive wrapping was discussed. A follow-up feature PR adds scaleBasis to the
already bumped main. After merging it, repeat the exact-commit gate and create a
new archive from that merge commit. Never publish the previous staged archive.
