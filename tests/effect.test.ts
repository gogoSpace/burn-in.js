import { afterEach, describe, expect, it, vi } from "vitest";
import { burn } from "../src/core/effect";
import type { BurnParticleOptions } from "../src/core/types";

import { createRectangle, FakeCanvasElement, FakeElement, installFakeDom } from "./helpers/fake-dom";

function recordParticleTrajectory(kind: "fire" | "smoke", particleOptions: BurnParticleOptions = {}) {
  const { fakeDocument, runNextAnimationFrame } = installFakeDom();
  const target = new FakeElement(fakeDocument);
  const trajectory: { x: number; y: number; size: number; alpha: number }[] = [];
  const onDone = vi.fn();

  target.rectangle = createRectangle(50, 60, 10, 10);

  const controller = burn(target as unknown as HTMLElement, {
    seed: "lift-curve-regression",
    mask: { source: "bounds", stepPx: 10 },
    fire: { enabled: false },
    smoke: { enabled: false },
    [kind]: {
      enabled: true,
      intensity: 1,
      maxParticles: 1,
      particleLife: 4,
      particlesPerPixel: 1,
      ...particleOptions
    },
    timing: { igniteMs: 1, burnMs: 1, fadeMs: 0, emberMs: 0, smokeMs: 2 },
    hooks: { onDone }
  });
  const canvas = fakeDocument.body.children[0] as FakeCanvasElement;

  canvas.context.drawImage.mockImplementation((_sprite, xPosition, yPosition, width) => {
    trajectory.push({
      x: xPosition + width / 2 + Number.parseFloat(canvas.style.left),
      y: yPosition + width / 2 + Number.parseFloat(canvas.style.top),
      size: width,
      alpha: canvas.context.globalAlpha
    });
  });

  // Large timestamp gaps stop emission but still advance each particle once per frame.
  for (const timeStamp of [0, 1, 1000, 2000, 3000, 4000]) {
    runNextAnimationFrame(timeStamp);
  }

  expect(onDone).toHaveBeenCalledOnce();
  expect(fakeDocument.body.children).toHaveLength(0);

  return { controller, trajectory };
}

describe("BurnInEffect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["fire", "smoke"] as const)("preserves the original %s trajectory without a lift curve", (kind) => {
    const { trajectory } = recordParticleTrajectory(kind);

    // Captured from main before adding liftCurve; includes horizontal motion, size, and opacity.
    expect(trajectory).toMatchSnapshot();
  });

  describe.each(["fire", "smoke"] as const)("%s lift curves", (kind) => {
    it("receives each particle's age, starting at zero and stopping before expiry", async () => {
      const liftCurve = vi.fn((particleProgress: number) => 1 + particleProgress * 0.5);
      const original = recordParticleTrajectory(kind);
      const custom = recordParticleTrajectory(kind, { liftCurve });

      expect(liftCurve.mock.calls).toEqual([[0], [0.25], [0.5], [0.75]]);
      expect(custom.trajectory).toEqual(original.trajectory);
      await expect(custom.controller.done).resolves.toBeUndefined();
    });

    it.each([0, 0.1, 0.4])("multiplies base lift %s once by a custom curve without the default ramp", (lift) => {
      const withoutAcceleration = recordParticleTrajectory(kind, { lift: 0 }).trajectory;
      const liftCurve = (particleProgress: number) => 0.2 + 1.8 * particleProgress ** 2;
      const { trajectory } = recordParticleTrajectory(kind, { lift, liftCurve });
      const damping = kind === "fire" ? 0.986 : 0.992;
      let velocityDifference = 0;
      let positionDifference = 0;

      expect(trajectory).toHaveLength(4);

      for (const [frameIndex, frame] of trajectory.entries()) {
        const multiplier = [0.2, 0.3125, 0.65, 1.2125][frameIndex];
        velocityDifference = (velocityDifference - lift * multiplier) * damping;
        positionDifference += velocityDifference;

        expect(frame.y).toBeCloseTo(withoutAcceleration[frameIndex].y + positionDifference, 10);
        expect(frame.x).toBeCloseTo(withoutAcceleration[frameIndex].x, 10);
        expect(frame.size).toBe(withoutAcceleration[frameIndex].size);
        expect(frame.alpha).toBe(withoutAcceleration[frameIndex].alpha);
      }
    });

    it.each([0, -2])("allows a finite multiplier of %s", (multiplier) => {
      const lift = 0.1;
      const { trajectory } = recordParticleTrajectory(kind, { lift, liftCurve: () => multiplier });
      const previousVelocity = trajectory[1].y - trajectory[0].y;
      const nextVelocity = trajectory[2].y - trajectory[1].y;
      const damping = kind === "fire" ? 0.986 : 0.992;

      expect(nextVelocity).toBeCloseTo((previousVelocity - lift * multiplier) * damping, 10);
    });

    it.each([NaN, Infinity, -Infinity, undefined, null, "2", {}])("falls back to the original trajectory for an invalid result (%s)", (result) => {
      const original = recordParticleTrajectory(kind);
      // Non-number results model callers in JavaScript, outside the TypeScript contract.
      const custom = recordParticleTrajectory(kind, { liftCurve: () => result as number });

      expect(custom.trajectory).toEqual(original.trajectory);
    });

    it("falls back after a thrown error and still completes", async () => {
      const original = recordParticleTrajectory(kind);
      const custom = recordParticleTrajectory(kind, {
        liftCurve: () => {
          throw new Error("Invalid custom curve");
        }
      });

      expect(custom.trajectory).toEqual(original.trajectory);
      await expect(custom.controller.done).resolves.toBeUndefined();
    });

    it.each(["invalid result", "exception"])("retries the curve on the next step after an %s", (failure) => {
      const expected = recordParticleTrajectory(kind, {
        liftCurve: (particleProgress) => particleProgress === 0.25 ? 1.125 : 2
      });
      const custom = recordParticleTrajectory(kind, {
        liftCurve: (particleProgress) => {
          if (particleProgress === 0.25) {
            if (failure === "exception") {
              throw new Error("Curve failed for one step");
            }

            return NaN;
          }

          return 2;
        }
      });

      expect(custom.trajectory).toEqual(expected.trajectory);
    });
  });

  it("keeps the canvas fixed to the viewport instead of expanding document overflow", () => {
    const {
      fakeDocument,
      visualViewportAddEventListener,
      visualViewportRemoveEventListener,
      windowAddEventListener,
      windowRemoveEventListener
    } = installFakeDom();
    const target = new FakeElement(fakeDocument);

    target.rectangle = createRectangle(24, 30, 100, 80);

    const controller = burn(target as unknown as HTMLElement, {
      canvas: {
        pixelRatio: 1
      },
      fire: {
        enabled: false
      },
      mask: {
        padding: {
          bottom: 0,
          top: 0,
          x: 0
        },
        source: "bounds"
      },
      smoke: {
        enabled: false
      },
      timing: {
        delayMs: 1000
      }
    });

    const canvas = fakeDocument.body.children[0] as FakeCanvasElement;

    expect(canvas).toBeInstanceOf(FakeCanvasElement);
    expect(canvas.style.position).toBe("fixed");
    expect(canvas.style.left).toBe("24px");
    expect(canvas.style.top).toBe("30px");
    expect(canvas.style.width).toBe("100px");
    expect(canvas.style.height).toBe("80px");
    expect(windowAddEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });
    expect(visualViewportAddEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });

    const scrollListener = windowAddEventListener.mock.calls.find(([eventName]) => eventName === "scroll")?.[1] as () => void;
    target.rectangle = createRectangle(12, 14, 100, 80);
    scrollListener();

    expect(canvas.style.left).toBe("12px");
    expect(canvas.style.top).toBe("14px");

    controller.cancel();

    expect(fakeDocument.body.children).toHaveLength(0);
    expect(windowRemoveEventListener).toHaveBeenCalledWith("scroll", scrollListener);
    expect(visualViewportRemoveEventListener).toHaveBeenCalledWith("scroll", scrollListener);
  });

  it("expands the fixed canvas before large particles hit its edges", () => {
    const { fakeDocument, runNextAnimationFrame } = installFakeDom();
    const target = new FakeElement(fakeDocument);

    target.rectangle = createRectangle(50, 60, 100, 80);

    const controller = burn(target as unknown as HTMLElement, {
      canvas: {
        pixelRatio: 1
      },
      fire: {
        enabled: false
      },
      mask: {
        padding: {
          bottom: 0,
          top: 0,
          x: 0
        },
        source: "bounds",
        stepPx: 100
      },
      seed: "particle-bounds",
      smoke: {
        enabled: true,
        expansion: 0,
        intensity: 1,
        lift: 0,
        maxParticles: 1,
        particleLife: 20,
        particlesPerPixel: 0.001,
        particleSize: 200,
        spread: 0,
        turbulence: 0
      },
      timing: {
        delayMs: 0,
        igniteMs: 1,
        smokeMs: 1000
      }
    });

    const canvas = fakeDocument.body.children[0] as FakeCanvasElement;
    const initialLeft = Number.parseFloat(canvas.style.left);
    const initialTop = Number.parseFloat(canvas.style.top);
    const initialWidth = Number.parseFloat(canvas.style.width);
    const initialHeight = Number.parseFloat(canvas.style.height);

    runNextAnimationFrame(0);
    runNextAnimationFrame(10);

    expect(Number.parseFloat(canvas.style.left)).toBeLessThan(initialLeft);
    expect(Number.parseFloat(canvas.style.top)).toBeLessThan(initialTop);
    expect(Number.parseFloat(canvas.style.width)).toBeGreaterThan(initialWidth);
    expect(Number.parseFloat(canvas.style.height)).toBeGreaterThan(initialHeight);

    controller.cancel();
  });
});
