import { afterEach, describe, expect, it, vi } from "vitest";
import { burn } from "../src/core/effect";
import { resolveBurnOptions } from "../src/core/options";
import type { BurnMaskSource, BurnOptions, BurnParticleOptions } from "../src/core/types";
import { createRectangle, FakeCanvasElement, FakeElement, FakeImageElement, FakeText, installFakeDom } from "./helpers/fake-dom";

type RenderedParticle = { x: number; y: number; width: number; height: number; alpha: number };
type TargetKind = "element" | "image" | "canvas" | "text";
type RecordingOptions = {
  scale?: number;
  referenceSize?: number;
  pixelRatio?: number;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  targetKind?: TargetKind;
  maskSource?: BurnMaskSource;
  particleOptions?: BurnParticleOptions;
  resizeAtFrame?: number;
  resizeScale?: number;
  viewportResize?: boolean;
};

function recordEffect(kind: "fire" | "smoke", recording: RecordingOptions = {}) {
  const { fakeDocument, runNextAnimationFrame, windowAddEventListener } = installFakeDom();
  const target = recording.targetKind === "image" ? new FakeImageElement(fakeDocument)
    : recording.targetKind === "canvas" ? new FakeCanvasElement(fakeDocument) : new FakeElement(fakeDocument);
  let scale = recording.scale ?? 1;
  const width = recording.width ?? 120;
  const height = recording.height ?? 60;
  const left = recording.left ?? 50;
  const top = recording.top ?? 60;
  target.rectangle = createRectangle(left, top, width * scale, height * scale);
  target.style.opacity = "0.7";

  if (target instanceof FakeCanvasElement) {
    target.width = 120;
    target.height = 60;
  }

  if (recording.targetKind === "text") {
    target.textNodes.push(new FakeText("Burn", target));
  }

  const onDone = vi.fn();
  const onCancel = vi.fn();
  const progress: number[] = [];
  const options: BurnOptions = {
    referenceSize: Object.hasOwn(recording, "referenceSize") ? recording.referenceSize : 60,
    seed: "target-scaling",
    canvas: { pixelRatio: recording.pixelRatio ?? 1 },
    mask: {
      source: recording.maskSource ?? (recording.targetKind === "text" ? "text" : "auto"),
      stepPx: 3,
      offset: { x: 3, y: 6 },
      luminanceThreshold: 100
    },
    fire: { enabled: false },
    smoke: { enabled: false },
    [kind]: {
      enabled: true,
      intensity: 1,
      lift: 0.4,
      spread: 0.8,
      drift: 0.7,
      turbulence: 0.3,
      particleSize: [15, 30],
      particleLife: [4, 7],
      particlesPerPixel: 0.001,
      maxParticles: 100,
      liftCurve: (particleProgress: number) => {
        progress.push(particleProgress);
        return 0.2 + 1.8 * particleProgress ** 2;
      },
      ...recording.particleOptions
    },
    timing: { igniteMs: 20, burnMs: 60, fadeMs: 40, emberMs: 20, smokeMs: 160 },
    reveal: { durationMs: 120 },
    hooks: { onDone, onCancel }
  };
  const controller = burn(target as unknown as HTMLElement, options);
  const canvas = fakeDocument.body.children[0] as FakeCanvasElement;
  const initialCanvas = { width: Number.parseFloat(canvas.style.width), height: Number.parseFloat(canvas.style.height) };
  const frames: RenderedParticle[][] = [];
  const opacity: string[] = [];
  const canvasSizes: { width: number; height: number }[] = [];
  const scales: number[] = [];
  let frameParticles: RenderedParticle[] = [];

  // Observe drawImage and the actual renderer transform, including canvas
  // expansion/positioning. Never inspect the effect's private particle arrays.
  canvas.context.drawImage.mockImplementation((_sprite, horizontal, vertical, particleWidth, particleHeight) => {
    const transform = canvas.context.setTransform.mock.lastCall!;
    const horizontalScale = transform[0] * Number.parseFloat(canvas.style.width) / canvas.width;
    const verticalScale = transform[3] * Number.parseFloat(canvas.style.height) / canvas.height;
    const particle = {
      x: (horizontal + particleWidth / 2) * horizontalScale + Number.parseFloat(canvas.style.left) - target.rectangle.left,
      y: (vertical + particleHeight / 2) * verticalScale + Number.parseFloat(canvas.style.top) - target.rectangle.top,
      width: particleWidth * horizontalScale,
      height: particleHeight * verticalScale,
      alpha: canvas.context.globalAlpha
    };
    expect(horizontal).toBeGreaterThanOrEqual(0);
    expect(vertical).toBeGreaterThanOrEqual(0);
    expect((horizontal + particleWidth) * horizontalScale).toBeLessThanOrEqual(Number.parseFloat(canvas.style.width) + 1e-9);
    expect((vertical + particleHeight) * verticalScale).toBeLessThanOrEqual(Number.parseFloat(canvas.style.height) + 1e-9);
    frameParticles.push(particle);
  });

  const timestamps = [0, 10, 20, 40, 60, 80, 100, 140, 160, 200, 250, 300, 350, 400, 450, 500];

  for (const [frameIndex, timestamp] of timestamps.entries()) {
    if (frameIndex === recording.resizeAtFrame) {
      scale = recording.resizeScale ?? 2;
      target.rectangle = createRectangle(left, top, width * scale, height * scale);

      if (recording.viewportResize) {
        const resizeListener = windowAddEventListener.mock.calls.find(([eventName]) => eventName === "resize")?.[1] as () => void;
        resizeListener();
      }
    }

    frameParticles = [];
    runNextAnimationFrame(timestamp);
    frames.push(frameParticles);
    scales.push(scale);
    opacity.push(target.style.opacity);
    canvasSizes.push({ width: Number.parseFloat(canvas.style.width), height: Number.parseFloat(canvas.style.height) });

    if (onDone.mock.calls.length > 0) {
      break;
    }
  }

  expect(onDone).toHaveBeenCalledOnce();
  expect(onCancel).not.toHaveBeenCalled();
  expect(fakeDocument.body.children).toHaveLength(0);

  return { frames, opacity, progress, canvasSizes, initialCanvas, scales, fakeDocument, canvas, controller };
}

function expectSameNormalizedRendering(actual: ReturnType<typeof recordEffect>, expected: ReturnType<typeof recordEffect>) {
  expect(actual.frames.map((particles) => particles.length)).toEqual(expected.frames.map((particles) => particles.length));
  expect(actual.opacity).toEqual(expected.opacity);
  expect(actual.progress).toEqual(expected.progress);

  for (const [frameIndex, particles] of actual.frames.entries()) {
    const scale = actual.scales[frameIndex];

    for (const [particleIndex, particle] of particles.entries()) {
      const reference = expected.frames[frameIndex][particleIndex];

      for (const dimension of ["x", "y", "width", "height"] as const) {
        expect(particle[dimension] / scale).toBeCloseTo(reference[dimension], 9);
      }

      expect(particle.alpha).toBe(reference.alpha);
      expect(particle.width).toBeCloseTo(particle.height, 9);
    }
  }
}

afterEach(() => vi.unstubAllGlobals());

describe.each(["fire", "smoke"] as const)("%s target-relative rendering", (kind) => {
  it.each([
    ["element", "bounds"], ["element", "auto"], ["image", "alpha"], ["image", "luminance"],
    ["image", "auto"], ["canvas", "alpha"], ["canvas", "luminance"], ["canvas", "auto"], ["text", "text"]
  ] as const)("preserves normalized geometry, count, curve, and reveal for %s / %s at 0.5×, 1×, and 2×", async (targetKind, maskSource) => {
    const reference = recordEffect(kind, { targetKind, maskSource });
    expect(reference.frames.flat().length).toBeGreaterThan(20);

    for (const scale of [0.5, 1, 2]) {
      const actual = recordEffect(kind, { scale, targetKind, maskSource });
      expectSameNormalizedRendering(actual, reference);
      expect(actual.initialCanvas.width / scale).toBe(reference.initialCanvas.width);
      expect(actual.initialCanvas.height / scale).toBe(reference.initialCanvas.height);
      expect(actual.canvasSizes.map((size) => ({ width: size.width / scale, height: size.height / scale }))).toEqual(reference.canvasSizes);
      await expect(actual.controller.done).resolves.toBeUndefined();

      if (targetKind === "text") {
        const textCanvas = actual.fakeDocument.canvases.find((entry) => entry.context.fillText.mock.calls.length > 0)!;
        expect(textCanvas.width).toBe(120);
        expect(textCanvas.height).toBe(60);
        expect(textCanvas.context.font).toContain("60px");
      }
    }
  });

  it("keeps both emission before the cap and the existing maximum particle budget", () => {
    const uncapped = recordEffect(kind);
    expect(Math.max(...uncapped.frames.map((particles) => particles.length))).toBeLessThan(100);
    const reference = recordEffect(kind, { particleOptions: { particlesPerPixel: 10, maxParticles: 5 } });
    expect(Math.max(...reference.frames.map((particles) => particles.length))).toBe(5);

    for (const scale of [0.5, 2]) {
      expectSameNormalizedRendering(recordEffect(kind, { scale, particleOptions: { particlesPerPixel: 10, maxParticles: 5 } }), reference);
    }
  });

  it.each([false, true])("rescales live particles and rebuilds masks on resize (viewport event: %s)", (viewportResize) => {
    for (const targetKind of ["element", "text", "image", "canvas"] as const) {
      const reference = recordEffect(kind, { targetKind });
      const resized = recordEffect(kind, { targetKind, resizeAtFrame: 4, resizeScale: 2, viewportResize });
      expectSameNormalizedRendering(resized, reference);
      const shrunk = recordEffect(kind, { targetKind, resizeAtFrame: 1, resizeScale: 0.5, viewportResize });
      expectSameNormalizedRendering(shrunk, reference);
    }
  });

  it.each([1, 1.25, 1.5, 2])("keeps CSS geometry independent of backing-store pixel ratio %s", (pixelRatio) => {
    const reference = recordEffect(kind);
    const actual = recordEffect(kind, { scale: 0.5, pixelRatio });
    expectSameNormalizedRendering(actual, reference);
    expect(actual.canvas.width).toBe(Math.round(Number.parseFloat(actual.canvas.style.width) * pixelRatio));
  });

  it("preserves fractional target alignment including scale 1", () => {
    const position = { left: 50.25, top: 60.75 };
    const reference = recordEffect(kind, position);

    for (const scale of [0.5, 2]) {
      expectSameNormalizedRendering(recordEffect(kind, { ...position, scale }), reference);
    }
  });

  it("does not enlarge or stretch particles when only the long side changes", () => {
    const particleOptions = { maxParticles: 1, particlesPerPixel: 1 };
    const reference = recordEffect(kind, { particleOptions });

    for (const dimensions of [{ width: 480, height: 60 }, { width: 60, height: 480 }]) {
      const stretched = recordEffect(kind, { ...dimensions, particleOptions });
      expect(stretched.frames.flat().map(({ width, height, alpha }) => ({ width, height, alpha })))
        .toEqual(reference.frames.flat().map(({ width, height, alpha }) => ({ width, height, alpha })));
    }
  });

  it("matches legacy rendering exactly at the reference size", () => {
    const legacy = recordEffect(kind, { referenceSize: undefined });
    const reference = recordEffect(kind);
    expect(reference.frames).toEqual(legacy.frames);
    expect(reference.canvasSizes).toEqual(legacy.canvasSizes);
  });

  it("keeps the legacy particle size when referenceSize is omitted on larger targets", () => {
    const particleOptions = { maxParticles: 1, particlesPerPixel: 1 };
    const reference = recordEffect(kind, { referenceSize: undefined, particleOptions });

    for (const scale of [0.5, 2]) {
      const actual = recordEffect(kind, { referenceSize: undefined, scale, particleOptions });
      expect(actual.frames.flat().map(({ width, height, alpha }) => ({ width, height, alpha })))
        .toEqual(reference.frames.flat().map(({ width, height, alpha }) => ({ width, height, alpha })));
    }
  });

  it("scales the built-in lift ramp without changing particle progress", () => {
    const particleOptions = { liftCurve: undefined };
    const reference = recordEffect(kind, { particleOptions });
    expectSameNormalizedRendering(recordEffect(kind, { scale: 2, particleOptions }), reference);
  });

  it.each([0, -60, NaN, Infinity, -Infinity, null, "60"])("falls back to legacy geometry for invalid reference %s", (referenceSize) => {
    const legacy = recordEffect(kind, { referenceSize: undefined });
    const actual = recordEffect(kind, { referenceSize: referenceSize as number });
    expect(actual.frames).toEqual(legacy.frames);
  });

  it.each([0, -20, NaN, Infinity, -Infinity])("handles a nonpositive or non-finite target dimension (%s) without invalid drawing", (dimension) => {
    for (const dimensions of [{ width: dimension }, { height: dimension }, { width: dimension, height: dimension }]) {
      const actual = recordEffect(kind, { ...dimensions, particleOptions: { particlesPerPixel: 1, maxParticles: 2 } });
      const legacy = recordEffect(kind, { ...dimensions, referenceSize: undefined, particleOptions: { particlesPerPixel: 1, maxParticles: 2 } });
      expect(actual.frames).toEqual(legacy.frames);
      expect(actual.frames.flat().length).toBeGreaterThan(0);
      expect(actual.frames.flat().every((particle) => Object.values(particle).every(Number.isFinite))).toBe(true);
    }
  });
});

it("resolves reference size through presets without mutating their spatial options", () => {
  const legacy = resolveBurnOptions({ preset: "wildfire" });
  const scaled = resolveBurnOptions({ preset: "wildfire", referenceSize: 100 });
  expect(scaled.referenceSize).toBe(100);
  expect(scaled.fire).toEqual(legacy.fire);
  expect(scaled.smoke).toEqual(legacy.smoke);
  expect(resolveBurnOptions().referenceSize).toBeUndefined();
});
