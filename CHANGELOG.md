# Changelog

## Unreleased

## 0.3.0 — 2026-09-27

- Add optional `referenceSize` for uniform particle geometry relative to the target's shorter side, across text, image, canvas, and bounds masks. Existing calls retain pixel-based sizing.
- Normalize mask sampling and emission at the reference size, preserving particle counts and lifetimes during uniform resizing without changing particle budgets, palettes, or lift-curve timing.
- Rebuild masks on target resize and scale active particle geometry, offsets, and canvas margins independently of backing-store pixel ratio.

## 0.2.0 — 2026-09-26

- Add optional `fire.liftCurve` and `smoke.liftCurve` callbacks to multiply base lift by each particle's normalized age, for example `fire: { lift: 0.1, liftCurve: (particleProgress) => 0.2 + 1.8 * particleProgress ** 2 }`.
- Preserve the original `1 + particleProgress * 0.5` lift multiplier when no curve is provided. Custom curves replace it; non-number/non-finite results and thrown errors fall back to it for that step.

## 0.1.2

- Add `mask.source: "text"` for burning real selectable DOM text using an internal alpha mask.
- Add `mask.offset` for fine-tuning mask alignment.
- Update the demo to burn selectable text on a wooden surface.
- Fix mobile scroll jumps caused by burn canvas overflow.
- Expand the fixed burn canvas dynamically so large smoke and fire particles are not clipped.

## 0.1.1

- Add `targetSelector` to the Vue adapter for burning a concrete element inside the slot.

## 0.1.0

- Initial public release.
