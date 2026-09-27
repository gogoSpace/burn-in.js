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

API: `burn(target, { referenceSize: 100, ...options })`, or the same top-level
option in the Vue adapter. Reference size is a fixed CSS-pixel length for the
target's shorter side. Keep it constant across responsive sizes; derive neither
it nor a separate motion multiplier from the current font size. Measure a desired
baseline once if exact preservation at that layout is required.

For the existing gogoSpace hero, a practical starting point is **100 CSS pixels**
for both word targets. At a 100 px shorter side this preserves the configured
particle sizes/motion; at 200 px they double. This is a tuning recommendation,
not a visually approved consumer setting. The current desktop wordmark CSS uses
`17.4vw` (with a large-screen cap); its size therefore grows substantially across
layouts. The consumer retains its own final visual review.

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
