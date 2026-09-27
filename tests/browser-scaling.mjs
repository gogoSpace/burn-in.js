// Optional functional browser gate. Uses an already installed Playwright module
// passed as the first argument; it adds no project dependency and takes no images.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const renderer = await readFile(new URL("../dist/index.js", import.meta.url), "utf8");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.setContent("<!doctype html><body style='margin:0'></body>");
  const results = await page.evaluate(async (source) => {
    const { burn } = await import(`data:text/javascript;base64,${btoa(source)}`);
    const originalRequestFrame = window.requestAnimationFrame;
    const originalCancelFrame = window.cancelAnimationFrame;
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    const animationFrames = new Map();
    let nextFrameIdentifier = 0;
    window.requestAnimationFrame = (callback) => {
      animationFrames.set(++nextFrameIdentifier, callback);
      return nextFrameIdentifier;
    };
    window.cancelAnimationFrame = (identifier) => animationFrames.delete(identifier);
    const recordings = [];
    let activeRecording;
    let currentFrame;
    let currentTarget;

    CanvasRenderingContext2D.prototype.fillText = function (...argumentsList) {
      activeRecording.textDraws.push({ font: this.font, argumentsList });
      originalFillText.apply(this, argumentsList);
    };

    CanvasRenderingContext2D.prototype.drawImage = function (...argumentsList) {
      originalDrawImage.apply(this, argumentsList);

      if (this.canvas.className !== "burn-in-browser-test") return;
      const [, horizontal, vertical, width, height] = argumentsList;
      const transform = this.getTransform();
      const canvasRectangle = this.canvas.getBoundingClientRect();
      const targetRectangle = currentTarget.getBoundingClientRect();
      // Include the browser's backing-store-to-CSS mapping and pixel rounding,
      // rather than treating drawImage arguments as rendered CSS dimensions.
      const horizontalScale = transform.a * canvasRectangle.width / this.canvas.width;
      const verticalScale = transform.d * canvasRectangle.height / this.canvas.height;
      currentFrame.push({
        x: (horizontal + width / 2) * horizontalScale + canvasRectangle.left - targetRectangle.left,
        y: (vertical + height / 2) * verticalScale + canvasRectangle.top - targetRectangle.top,
        width: width * horizontalScale,
        height: height * verticalScale,
        alpha: this.globalAlpha,
        kind: this.globalCompositeOperation
      });
    };

    async function createTarget(kind, scale, fontSize = 32) {
      let target;

      if (kind === "image" || kind === "canvas") {
        const artwork = document.createElement("canvas");
        artwork.width = 180;
        artwork.height = 60;
        const drawing = artwork.getContext("2d");
        drawing.fillStyle = "white";
        drawing.fillRect(12, 9, 78, 42);
        drawing.fillStyle = "rgb(60,60,60)";
        drawing.fillRect(96, 9, 72, 42);
        target = artwork;

        if (kind === "image") {
          target = new Image();
          target.src = artwork.toDataURL();
          await target.decode();
        }
      } else {
        target = document.createElement("div");
        if (kind === "text") target.textContent = "BURN";
      }

      target.style.cssText = `position:absolute;left:80.25px;top:60.75px;width:${180 * scale}px;height:${60 * scale}px;font:${fontSize * scale}px/${60 * scale}px monospace;opacity:0.7;`;
      document.body.appendChild(target);
      return target;
    }

    async function record(kind, maskSource, scale, pixelRatio = 1, resizeScale, fontSize = 32, maxParticles = 300, measurement = {}) {
      currentTarget = await createTarget(kind, scale, fontSize);
      const basis = measurement.basis ?? "short-side";
      const group = measurement.group ?? "target";
      if (group === "wrapping") {
        currentTarget.textContent = "BURN SMOKE";
        currentTarget.style.height = "auto";
        if (measurement.wrapped) currentTarget.style.width = `${90 * scale}px`;
      }
      activeRecording = { kind, maskSource, scale, pixelRatio, resizeScale, fontSize, maxParticles, basis, group, wrapped: !!measurement.wrapped, wrapDuringPlay: !!measurement.wrapDuringPlay, frames: [], opacity: [], scales: [], fireProgress: [], smokeProgress: [], textDraws: [], lineCounts: [], targetDimensions: [], nonblank: false, doneCount: 0 };
      const particleSettings = { intensity: 1, particlesPerPixel: group === "target" ? 0.003 : 1, maxParticles, particleLife: 5, lift: 0.4, spread: 0.8, drift: 0.7, turbulence: 0.3 };
      const controller = burn(currentTarget, {
        referenceSize: basis === "short-side" ? 60 : fontSize,
        scaleBasis: basis === "callback" ? (target) => Number.parseFloat(getComputedStyle(target).fontSize) : basis,
        seed: "browser-target-scaling",
        mask: { source: maskSource, stepPx: 3, luminanceThreshold: 100, offset: { x: 3, y: 6 } },
        canvas: { pixelRatio, className: "burn-in-browser-test" },
        fire: { ...particleSettings, liftCurve: (progress) => { activeRecording.fireProgress.push(progress); return 0.2 + progress ** 2; } },
        smoke: { ...particleSettings, liftCurve: (progress) => { activeRecording.smokeProgress.push(progress); return 1 - progress; } },
        timing: { igniteMs: 20, burnMs: 60, fadeMs: 40, emberMs: 20, smokeMs: 160 },
        reveal: { durationMs: 120 },
        hooks: { onDone: () => activeRecording.doneCount++ }
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const overlay = document.querySelector(".burn-in-browser-test");

      for (const [frameIndex, timestamp] of [0, 10, 20, 40, 60, 80, 100, 140, 160, 200, 250, 300, 350, 400].entries()) {
        if (resizeScale && frameIndex === 4) {
          scale = resizeScale;
          if (!measurement.fontOnlyResize) {
            currentTarget.style.width = `${180 * scale}px`;
            currentTarget.style.height = `${60 * scale}px`;
            currentTarget.style.lineHeight = `${60 * scale}px`;
          }
          currentTarget.style.fontSize = `${fontSize * scale}px`;
        }
        if (measurement.wrapDuringPlay && frameIndex === 4) currentTarget.style.width = `${90 * scale}px`;

        currentFrame = [];
        const callbacks = [...animationFrames.values()];
        animationFrames.clear();
        callbacks.forEach((callback) => callback(timestamp));
        activeRecording.frames.push(currentFrame);
        activeRecording.opacity.push(currentTarget.style.opacity);
        activeRecording.scales.push(scale);
        const range = document.createRange();
        range.selectNodeContents(currentTarget);
        activeRecording.lineCounts.push(range.getClientRects().length);
        const rectangle = currentTarget.getBoundingClientRect();
        activeRecording.targetDimensions.push([rectangle.width, rectangle.height]);

        if (currentFrame.length > 0 && !activeRecording.nonblank) {
          const pixels = overlay.getContext("2d").getImageData(0, 0, overlay.width, overlay.height).data;
          activeRecording.nonblank = pixels.some((value, index) => index % 4 === 3 && value > 0);
        }

        if (activeRecording.doneCount) break;
      }

      if (!activeRecording.doneCount) throw new Error("Effect did not finish");
      await controller.done;
      if (document.querySelector(".burn-in-browser-test")) throw new Error("Overlay survived completion");
      recordings.push(activeRecording);
      currentTarget.remove();
    }

    try {
      for (const [kind, maskSource] of [["element", "bounds"], ["image", "auto"], ["image", "alpha"], ["image", "luminance"], ["canvas", "auto"], ["canvas", "alpha"], ["canvas", "luminance"], ["text", "text"]]) {
        for (const scale of [1, 0.5, 2]) await record(kind, maskSource, scale);
        await record(kind, maskSource, 2, 2);
        await record(kind, maskSource, 1, 1, 2);
        await record(kind, maskSource, 1, 1, 0.5);
      }

      // Non-integer DOM font metrics can shift mask samples slightly between
      // sizes. Test motion and fading from each birth independently of that
      // rasterization, in addition to the exact multi-particle cases above.
      for (const scale of [1, 0.5, 2]) await record("text", "text", scale, 1, undefined, 40, 1);

      for (const basis of ["font-size", "callback"]) {
        for (const scale of [1, 0.5, 2]) {
          await record("text", "text", scale, 1, undefined, 20, 1, { basis, group: "wrapping" });
          await record("text", "text", scale, 1, undefined, 20, 1, { basis, group: "wrapping", wrapped: true });
        }
        await record("text", "text", 1, 1, undefined, 20, 1, { basis, group: "wrapping", wrapDuringPlay: true });
        await record("text", "text", 1, 1, undefined, 20, 1, { basis, group: "font-only" });
        await record("text", "text", 1, 1, 2, 20, 1, { basis, group: "font-only", fontOnlyResize: true });
        await record("text", "text", 1, 1, 0.5, 20, 1, { basis, group: "font-only", fontOnlyResize: true });
      }
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
      window.requestAnimationFrame = originalRequestFrame;
      window.cancelAnimationFrame = originalCancelFrame;
    }

    // A real requestAnimationFrame lifecycle complements the deterministic clock.
    const target = await createTarget("text", 2);
    let completionCount = 0;
    let cancellationCount = 0;
    const live = burn(target, { referenceSize: 60, mask: { source: "text" }, timing: { igniteMs: 10, burnMs: 20, fadeMs: 10, smokeMs: 50 }, fire: { particleLife: 3 }, smoke: { particleLife: 3 }, hooks: { onDone: () => completionCount++ } });
    await live.done;
    const cancelled = burn(target, { referenceSize: 60, hooks: { onCancel: () => cancellationCount++ } });
    await new Promise((resolve) => setTimeout(resolve, 40));
    cancelled.cancel();
    cancelled.cancel();
    await cancelled.done;
    target.remove();
    return { recordings, completionCount, cancellationCount, remainingOverlays: document.querySelectorAll(".burn-in-canvas").length };
  }, renderer);

  let maximumCoordinateError = 0;

  for (const actual of results.recordings) {
    const reference = results.recordings.find((entry) => entry.kind === actual.kind && entry.maskSource === actual.maskSource && entry.scale === 1 && !entry.resizeScale && entry.fontSize === actual.fontSize && entry.maxParticles === actual.maxParticles && entry.basis === actual.basis && entry.group === actual.group && !entry.wrapped && !entry.wrapDuringPlay);
    const label = `${actual.kind}/${actual.maskSource}/${actual.scale}/${actual.pixelRatio}/${actual.resizeScale}/${actual.fontSize}/${actual.basis}/${actual.group}/${actual.wrapped}/${actual.wrapDuringPlay}`;
    assert.equal(actual.doneCount, 1, label);
    assert.equal(actual.nonblank, true, label);
    assert.deepEqual(actual.frames.map((frame) => frame.length), reference.frames.map((frame) => frame.length), `${label}: emission`);
    assert.deepEqual(actual.fireProgress, reference.fireProgress, `${label}: fire curve`);
    assert.deepEqual(actual.smokeProgress, reference.smokeProgress, `${label}: smoke curve`);
    assert.deepEqual(actual.opacity, reference.opacity, `${label}: reveal`);
    if (actual.group === "wrapping") {
      assert.equal(reference.lineCounts[0], 1, `${label}: reference is one line`);
      if (actual.wrapped) assert.equal(actual.lineCounts[0], 2, `${label}: actually wrapped`);
      if (actual.wrapDuringPlay) {
        assert.equal(actual.lineCounts[0], 1);
        assert.equal(actual.lineCounts[4], 2);
      }
    }
    if (actual.group === "font-only") {
      assert.deepEqual(actual.targetDimensions, reference.targetDimensions, `${label}: fixed bounds`);
    }

    const births = new Map();

    for (const [frameIndex, particles] of actual.frames.entries()) {
      const visibleKinds = new Set(particles.map((particle) => particle.kind));
      for (const kind of births.keys()) if (!visibleKinds.has(kind)) births.delete(kind);
      for (const [particleIndex, particle] of particles.entries()) {
        const expected = reference.frames[frameIndex][particleIndex];
        assert.equal(particle.kind, expected.kind, label);
        if (!births.has(particle.kind)) births.set(particle.kind, { actual: particle, expected, scale: actual.scales[frameIndex] });
        const birth = births.get(particle.kind);
        const relativeToBirth = actual.maxParticles === 1;
        assert.ok(Math.abs((relativeToBirth ? particle.alpha / birth.actual.alpha : particle.alpha) - (relativeToBirth ? expected.alpha / birth.expected.alpha : expected.alpha)) < 1e-6, `${label}: opacity`);

        for (const dimension of ["x", "y", "width", "height"]) {
          const actualOrigin = relativeToBirth && (dimension === "x" || dimension === "y") ? birth.actual[dimension] / birth.scale : 0;
          const expectedOrigin = relativeToBirth && (dimension === "x" || dimension === "y") ? birth.expected[dimension] : 0;
          const difference = Math.abs(particle[dimension] / actual.scales[frameIndex] - actualOrigin - (expected[dimension] - expectedOrigin));
          maximumCoordinateError = Math.max(maximumCoordinateError, difference);
          assert.ok(difference < 0.001, `${label}: ${dimension} error ${difference}; text ${JSON.stringify(actual.textDraws)} vs ${JSON.stringify(reference.textDraws)}`);
        }
      }
    }
  }

  assert.equal(results.completionCount, 1);
  assert.equal(results.cancellationCount, 1);
  assert.equal(results.remainingOverlays, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: await browser.version(), scenarios: results.recordings.length, maximumCoordinateError, liveCompletion: "passed", cancellation: "passed", pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}
