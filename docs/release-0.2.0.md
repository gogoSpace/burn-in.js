# Release preparation: 0.2.0

Checked on 2026-09-26: `package.json`, `package-lock.json`, the npm `latest` tag, and the latest Git tag are at `0.1.2` / `v0.1.2`. Optional custom lift curves are an additive feature, so the planned next minor is `0.2.0`. This feature PR leaves the package version unchanged and the changelog entry under **Unreleased**.

## Review first

1. Review the feature PR, including the callback contract, fallback behavior, regression tests, and browser verification. Passing tests do not replace human review.
2. Resolve review feedback with new commits; do not amend or rewrite published history.
3. Merge the feature only after approval and successful CI. Merge, tagging, and publication are separate follow-up actions; this preparation does not perform them.

## Prepare the version change

Use a clean checkout without unrelated changes. Recheck the registry and Git tags immediately before preparing the release; if another version has been published, reassess the target version.

```bash
git fetch origin --tags
npm view @gogospace/burn-in version dist-tags --json
git tag --list
git switch -c release/0.2.0 origin/main
npm version 0.2.0 --no-git-tag-version
```

This updates both package manifests without creating a commit or tag. Move the lift-curve entries from **Unreleased** into a dated **0.2.0** changelog section, retaining an empty **Unreleased** section above it. Review the exact staged changes, then create a new version commit and a PR into `main`. Review and merge that PR before publishing.

## Validate the exact release commit

Use Node 22 and a clean checkout of the approved, merged release commit. Record its commit hash with `git rev-parse HEAD`.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run build:demo
npm run pack:dry
npm pack
```

Confirm that the tarball is `gogospace-burn-in-0.2.0.tgz`, its manifests report `0.2.0`, its public declaration files include `liftCurve`, and it contains the core and Vue entry points, README, and license. The package's `files` allowlist excludes the demo, tests, and release notes. There is no `prepack` or `prepublishOnly` hook, so the library **must be built before packing or publishing**.

The existing `.github/workflows/ci.yml` runs `npm ci`, tests, library build (including type checking), demo build, and a dry pack on PRs into `main` and pushes to `main`. It does not publish to npm or run on release tags. Browser checks are currently manual, outside CI.

## Publish after approval

Recheck that `0.2.0` is still unpublished, authenticate to npm with an account permitted to publish `@gogospace/burn-in`, and satisfy any required two-factor authentication. Publish the inspected tarball from the exact approved commit:

```bash
npm whoami
npm publish ./gogospace-burn-in-0.2.0.tgz --access public --tag latest
npm view @gogospace/burn-in@0.2.0 version dist.integrity --json
npm view @gogospace/burn-in dist-tags --json
```

Verify the published integrity against the local tarball and confirm `latest` is `0.2.0`. If publication returns an ambiguous error, check the registry before retrying. npm versions cannot be overwritten.

After successful publication, create an annotated `v0.2.0` tag on that same approved commit, push only that tag, and create a GitHub release from the changelog. Do not move an existing tag. Publishing npm does not deploy the demo website.

## Release-note draft

Both `fire` and `smoke` now accept `liftCurve: (particleProgress: number) => number`, for example `fire: { lift: 0.1, liftCurve: (particleProgress) => 0.2 + 1.8 * particleProgress ** 2 }`. The callback multiplies base lift using each particle's normalized age and replaces the built-in ramp. Omitting it preserves the previous motion exactly. Invalid results and thrown errors use the previous ramp for that step. Counts, palettes, timing, rendering, and dependencies are unchanged.
