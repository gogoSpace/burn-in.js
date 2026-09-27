import { ease } from "./easing";
import { resolveBurnOptions } from "./options";
import { BurnRandom } from "./random";
import { buildBurnSource } from "./source";
import { createRadialSprite } from "./sprites";
import type { BurnController, BurnEmitter, BurnOptions, ResolvedBurnOptions } from "./types";

type Particle = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
  seed: number;
};

type DrawableParticle = {
  alpha: number;
  particle: Particle;
  size: number;
};

const canvasExpansionPadding = 256;
const canvasExpansionThreshold = 64;

function resolveCanvasRoot(target: HTMLElement, options: ResolvedBurnOptions): HTMLElement {
  if (options.host) {
    return options.host;
  }

  const { body } = target.ownerDocument;

  if (!body) {
    throw new Error("Burn-In.js: target element must belong to a document with a body.");
  }

  return body;
}

function resolveOwnerWindow(target: HTMLElement): Window {
  const ownerWindow = target.ownerDocument.defaultView;

  if (!ownerWindow) {
    throw new Error("Burn-In.js: target element must belong to a window.");
  }

  return ownerWindow;
}

function resolvePixelRatio(options: ResolvedBurnOptions, ownerWindow: Window): number {
  if (options.canvas.pixelRatio === "device") {
    return Math.max(1, Math.min(2, ownerWindow.devicePixelRatio || 1));
  }

  return Math.max(1, options.canvas.pixelRatio);
}

function timedProgress(elapsedMs: number, startsAtMs: number, durationMs: number): number {
  return Math.min(1, Math.max(0, (elapsedMs - startsAtMs) / Math.max(1, durationMs)));
}

function resolveTargetScale(rectangle: DOMRect, referenceSize: number | undefined): number | undefined {
  if (
    typeof referenceSize !== "number" || !Number.isFinite(referenceSize) || referenceSize <= 0 ||
    !Number.isFinite(rectangle.width) || !Number.isFinite(rectangle.height) ||
    rectangle.width <= 0 || rectangle.height <= 0
  ) {
    return undefined;
  }

  const scale = Math.min(rectangle.width, rectangle.height) / referenceSize;

  return Number.isFinite(scale) && scale > 0 &&
    Number.isFinite(rectangle.width / scale) && Number.isFinite(rectangle.height / scale) ? scale : undefined;
}

export class BurnInEffect implements BurnController {
  public readonly done: Promise<void>;

  private readonly target: HTMLElement;
  private readonly canvasRoot: HTMLElement;
  private readonly ownerWindow: Window;
  private readonly options: ResolvedBurnOptions;
  private readonly random: BurnRandom;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly fireSprite: HTMLCanvasElement;
  private readonly smokeSprite: HTMLCanvasElement;
  private readonly originalTargetOpacity: string;
  private readonly handleViewportChange = (): void => {
    this.refreshLayout();
  };
  private readonly fireParticles: Particle[] = [];
  private readonly smokeParticles: Particle[] = [];
  private emitters: BurnEmitter[] = [];
  private coveredPixelCount = 0;
  private animationFrame = 0;
  // Geometry, including canvas margins, stays in reference coordinates. Only
  // the renderer maps it to CSS pixels; pixelRatio controls raster resolution.
  private canvasHeight = 0;
  private canvasWidth = 0;
  private canvasPaddingX = 0;
  private canvasPaddingTop = 0;
  private targetWidth = 0;
  private targetHeight = 0;
  private targetScale = 1;
  private usesReferenceSize = false;
  private pixelRatio = 1;
  private startTime: number | null = null;
  private settled = false;
  private resolveDone!: () => void;

  public constructor(target: HTMLElement, options: BurnOptions = {}) {
    this.target = target;
    this.ownerWindow = resolveOwnerWindow(target);
    this.options = resolveBurnOptions(options);
    this.canvasRoot = resolveCanvasRoot(target, this.options);
    this.random = new BurnRandom(this.options.seed);
    this.originalTargetOpacity = target.style.opacity;
    this.canvas = target.ownerDocument.createElement("canvas");
    this.canvas.className = this.options.canvas.className;
    this.context = this.createContext(this.canvas);
    this.fireSprite = createRadialSprite(this.options.fire.spriteSize, this.options.fire.colors);
    this.smokeSprite = createRadialSprite(this.options.smoke.spriteSize, this.options.smoke.colors);
    this.done = new Promise((resolve) => {
      this.resolveDone = resolve;
    });

    this.mountCanvas();
  }

  public start(): this {
    this.options.hooks.onStart?.();
    this.layout();
    this.target.style.opacity = String(this.options.reveal.opacityFrom);

    this.ownerWindow.setTimeout(() => {
      if (this.settled) {
        return;
      }

      this.startTime = null;
      this.options.hooks.onIgnite?.();
      this.animationFrame = this.ownerWindow.requestAnimationFrame((timeStamp) => this.frame(timeStamp));
    }, this.options.timing.delayMs);

    return this;
  }

  public cancel(): void {
    if (this.settled) {
      return;
    }

    this.ownerWindow.cancelAnimationFrame(this.animationFrame);
    this.options.hooks.onCancel?.();
    this.finish(false);
  }

  private createContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = canvas.getContext("2d", { alpha: true });

    if (!context) {
      throw new Error("Burn-In.js: Canvas 2D context is not available.");
    }

    return context;
  }

  private mountCanvas(): void {
    Object.assign(this.canvas.style, {
      position: "fixed",
      left: "0",
      top: "0",
      pointerEvents: this.options.canvas.pointerEvents,
      zIndex: String(this.options.canvas.zIndex)
    });

    this.canvasRoot.appendChild(this.canvas);
    this.ownerWindow.addEventListener("scroll", this.handleViewportChange, { passive: true });
    this.ownerWindow.addEventListener("resize", this.handleViewportChange);
    this.ownerWindow.visualViewport?.addEventListener("scroll", this.handleViewportChange, { passive: true });
    this.ownerWindow.visualViewport?.addEventListener("resize", this.handleViewportChange);
  }

  private layout(rectangle = this.target.getBoundingClientRect()): void {
    this.targetWidth = rectangle.width;
    this.targetHeight = rectangle.height;
    const targetScale = resolveTargetScale(rectangle, this.options.referenceSize);
    this.targetScale = targetScale ?? 1;
    this.usesReferenceSize = targetScale !== undefined;
    const previousOpacity = this.target.style.opacity;
    // A resize can happen while reveal opacity is zero. Sample the original
    // content, then immediately restore the in-progress reveal state.
    this.target.style.opacity = this.originalTargetOpacity;
    let source;

    try {
      source = buildBurnSource(this.target, this.options.mask, this.targetScale);
    } finally {
      this.target.style.opacity = previousOpacity;
    }
    const expectedSmoke = this.options.smoke.enabled
      ? this.options.smoke.spriteSize * (1 + this.options.smoke.expansion) * Math.max(0.2, this.options.smoke.intensity)
      : 0;
    const paddingX = Math.round(Math.max(source.width * this.options.mask.padding.x, expectedSmoke * 0.48));
    const paddingTop = Math.round(source.height * this.options.mask.padding.top + expectedSmoke * 0.72);
    const paddingBottom = Math.round(Math.max(source.height * this.options.mask.padding.bottom, expectedSmoke * 0.24));
    const styleWidth = Math.max(1, Math.round(source.width + paddingX * 2));
    const styleHeight = Math.max(1, Math.round(source.height + paddingTop + paddingBottom));
    this.pixelRatio = resolvePixelRatio(this.options, this.ownerWindow);

    this.emitters = source.emitters.map((emitter) => ({
      x: emitter.x + paddingX,
      y: emitter.y + paddingTop,
      weight: emitter.weight
    }));

    for (const particle of [...this.fireParticles, ...this.smokeParticles]) {
      particle.x += paddingX - this.canvasPaddingX;
      particle.y += paddingTop - this.canvasPaddingTop;
    }

    this.canvasPaddingX = paddingX;
    this.canvasPaddingTop = paddingTop;
    this.coveredPixelCount = Math.max(1, source.emitters.length * this.options.mask.stepPx * this.options.mask.stepPx);
    this.resizeCanvas(styleWidth, styleHeight);
    this.positionCanvas();
  }

  private refreshLayout(): void {
    const rectangle = this.target.getBoundingClientRect();

    if (!Object.is(rectangle.width, this.targetWidth) || !Object.is(rectangle.height, this.targetHeight)) {
      this.layout(rectangle);
    } else {
      this.positionCanvas(rectangle);
    }
  }

  private positionCanvas(targetRect = this.target.getBoundingClientRect()): void {
    const left = (Number.isFinite(targetRect.left) ? targetRect.left : 0) - this.canvasPaddingX * this.targetScale;
    const top = (Number.isFinite(targetRect.top) ? targetRect.top : 0) - this.canvasPaddingTop * this.targetScale;

    this.canvas.style.left = `${this.usesReferenceSize ? left : Math.round(left)}px`;
    this.canvas.style.top = `${this.usesReferenceSize ? top : Math.round(top)}px`;
  }

  private resizeCanvas(styleWidth: number, styleHeight: number): void {
    this.canvasWidth = Math.max(1, styleWidth);
    this.canvasHeight = Math.max(1, styleHeight);
    const displayWidth = this.canvasWidth * this.targetScale;
    const displayHeight = this.canvasHeight * this.targetScale;
    this.canvas.width = Math.max(1, Math.round(displayWidth * this.pixelRatio));
    this.canvas.height = Math.max(1, Math.round(displayHeight * this.pixelRatio));
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    // Compensate integer backing-store rounding so its CSS projection keeps
    // exactly the same uniform target scale in both axes, including below 1.
    this.context.setTransform(this.canvas.width / this.canvasWidth, 0, 0, this.canvas.height / this.canvasHeight, 0, 0);
  }

  private expandCanvas(expandLeft: number, expandTop: number, expandRight: number, expandBottom: number): void {
    if (expandLeft === 0 && expandTop === 0 && expandRight === 0 && expandBottom === 0) {
      return;
    }

    this.canvasPaddingX += expandLeft;
    this.canvasPaddingTop += expandTop;

    if (expandLeft > 0 || expandTop > 0) {
      this.emitters = this.emitters.map((emitter) => ({
        ...emitter,
        x: emitter.x + expandLeft,
        y: emitter.y + expandTop
      }));

      for (const particle of [...this.fireParticles, ...this.smokeParticles]) {
        particle.x += expandLeft;
        particle.y += expandTop;
      }
    }

    this.resizeCanvas(this.canvasWidth + expandLeft + expandRight, this.canvasHeight + expandTop + expandBottom);
    this.positionCanvas();
  }

  private ensureParticleBounds(drawableParticles: DrawableParticle[]): void {
    if (drawableParticles.length === 0) {
      return;
    }

    let minimumX = Number.POSITIVE_INFINITY;
    let minimumY = Number.POSITIVE_INFINITY;
    let maximumX = Number.NEGATIVE_INFINITY;
    let maximumY = Number.NEGATIVE_INFINITY;

    for (const drawableParticle of drawableParticles) {
      const halfSize = drawableParticle.size / 2;

      minimumX = Math.min(minimumX, drawableParticle.particle.x - halfSize);
      minimumY = Math.min(minimumY, drawableParticle.particle.y - halfSize);
      maximumX = Math.max(maximumX, drawableParticle.particle.x + halfSize);
      maximumY = Math.max(maximumY, drawableParticle.particle.y + halfSize);
    }

    const expandLeft = minimumX < canvasExpansionThreshold ? Math.ceil(canvasExpansionPadding - minimumX) : 0;
    const expandTop = minimumY < canvasExpansionThreshold ? Math.ceil(canvasExpansionPadding - minimumY) : 0;
    const expandRight =
      maximumX > this.canvasWidth - canvasExpansionThreshold ? Math.ceil(maximumX - this.canvasWidth + canvasExpansionPadding) : 0;
    const expandBottom =
      maximumY > this.canvasHeight - canvasExpansionThreshold ? Math.ceil(maximumY - this.canvasHeight + canvasExpansionPadding) : 0;

    this.expandCanvas(expandLeft, expandTop, expandRight, expandBottom);
  }

  private spawnParticles(kind: "fire" | "smoke", amount: number, force: number): void {
    if (amount <= 0 || this.emitters.length === 0) {
      return;
    }

    const options = kind === "fire" ? this.options.fire : this.options.smoke;
    const particles = kind === "fire" ? this.fireParticles : this.smokeParticles;
    const availableSlots = Math.max(0, options.maxParticles - particles.length);
    const count = Math.min(availableSlots, Math.floor(amount));

    for (let index = 0; index < count; index += 1) {
      const emitter = this.emitters[this.random.integer(this.emitters.length)];
      const size = this.random.between(options.particleSize);
      const life = this.random.between(options.particleLife);
      const intensity = Math.max(0.01, options.intensity);
      const spread = options.spread * force;
      const lift = kind === "fire" ? 0.68 + this.random.next() * 1.05 : 0.34 + this.random.next() * 0.48;

      particles.push({
        x: emitter.x + this.random.signed(kind === "fire" ? 2 : 7),
        y: emitter.y + this.random.signed(kind === "fire" ? 2 : 5),
        velocityX: this.random.signed(spread) + this.random.signed(options.drift),
        velocityY: -lift * intensity * force,
        life: 0,
        maxLife: life,
        size,
        alpha: options.opacity * Math.min(1.4, intensity) * emitter.weight,
        seed: this.random.next() * Math.PI * 2
      });
    }
  }

  private updateParticles(kind: "fire" | "smoke"): DrawableParticle[] {
    const options = kind === "fire" ? this.options.fire : this.options.smoke;
    const particles = kind === "fire" ? this.fireParticles : this.smokeParticles;
    const drawableParticles: DrawableParticle[] = [];

    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      const particleProgress = particle.life / particle.maxLife;

      if (particleProgress >= 1) {
        particles.splice(index, 1);
        continue;
      }

      let liftMultiplier = 1 + particleProgress * 0.5;

      if (options.liftCurve) {
        try {
          const customLiftMultiplier = options.liftCurve(particleProgress);

          if (Number.isFinite(customLiftMultiplier)) {
            liftMultiplier = customLiftMultiplier;
          }
        } catch {
          // A faulty curve falls back for this step so the effect can still finish.
        }
      }

      particle.velocityX +=
        Math.sin(particle.seed + particle.life * 0.055) * options.turbulence +
        this.random.signed(options.turbulence);
      particle.velocityY -= options.lift * liftMultiplier;
      particle.velocityY *= kind === "fire" ? 0.986 : 0.992;
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      particle.life += 1;

      const alpha = particle.alpha * (kind === "fire" ? 1 - particleProgress : 1 - particleProgress * 0.9);
      const size = particle.size * (kind === "fire" ? 0.62 + options.expansion * (1 - particleProgress) : 1 + particleProgress * options.expansion);

      drawableParticles.push({
        alpha: Math.max(0, alpha),
        particle,
        size
      });
    }

    return drawableParticles;
  }

  private drawParticles(kind: "fire" | "smoke", drawableParticles: DrawableParticle[]): void {
    const options = kind === "fire" ? this.options.fire : this.options.smoke;
    const sprite = kind === "fire" ? this.fireSprite : this.smokeSprite;

    this.context.globalCompositeOperation = options.composite;

    for (const drawableParticle of drawableParticles) {
      this.context.globalAlpha = drawableParticle.alpha;
      this.context.drawImage(
        sprite,
        drawableParticle.particle.x - drawableParticle.size / 2,
        drawableParticle.particle.y - drawableParticle.size / 2,
        drawableParticle.size,
        drawableParticle.size
      );
    }
  }

  private updateReveal(elapsedMs: number): void {
    const timing = this.options.timing;
    const reveal = this.options.reveal;
    const startsAtMs =
      reveal.startsAt === "ignite"
        ? 0
        : reveal.startsAt === "burn"
          ? timing.igniteMs
          : timing.igniteMs + timing.burnMs;
    const progress = ease(reveal.easing, timedProgress(elapsedMs, startsAtMs, reveal.durationMs));
    const opacity = reveal.opacityFrom + (reveal.opacityTo - reveal.opacityFrom) * progress;

    if (progress > 0) {
      this.options.hooks.onReveal?.();
    }

    this.target.style.opacity = String(opacity);
  }

  private frame(timeStamp: number): void {
    this.refreshLayout();
    if (this.startTime === null) {
      this.startTime = timeStamp;
    }

    const elapsedMs = timeStamp - this.startTime;
    const timing = this.options.timing;
    const fireEndMs = timing.igniteMs + timing.burnMs + timing.fadeMs + timing.emberMs;
    const smokeEndMs = timing.smokeMs;
    const doneAtMs = Math.max(fireEndMs, smokeEndMs);
    this.context.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.updateReveal(elapsedMs);

    let fireForce = 0;

    if (this.options.fire.enabled && elapsedMs < fireEndMs) {
      if (elapsedMs < timing.igniteMs) {
        fireForce = ease(timing.easing.ignite, elapsedMs / Math.max(1, timing.igniteMs));
      } else if (elapsedMs < timing.igniteMs + timing.burnMs) {
        fireForce = 1;
      } else if (elapsedMs < timing.igniteMs + timing.burnMs + timing.fadeMs) {
        fireForce = 1 - ease(timing.easing.fade, (elapsedMs - timing.igniteMs - timing.burnMs) / Math.max(1, timing.fadeMs));
      } else {
        fireForce = 0.18;
      }

      this.spawnParticles(
        "fire",
        this.coveredPixelCount * this.options.fire.particlesPerPixel * this.options.fire.intensity * fireForce,
        Math.max(0.2, fireForce)
      );
    }

    let smokeForce = 0;

    if (this.options.smoke.enabled && elapsedMs < smokeEndMs) {
      const rampInMs = Math.max(1, Math.min(timing.igniteMs, timing.smokeMs * 0.32));
      const holdMs = Math.max(0, timing.smokeMs * 0.28);
      const fadeMs = Math.max(1, timing.smokeMs - rampInMs - holdMs);

      if (elapsedMs < rampInMs) {
        smokeForce = ease("easeInCubic", elapsedMs / rampInMs);
      } else if (elapsedMs < rampInMs + holdMs) {
        smokeForce = 1;
      } else {
        smokeForce = 1 - ease(timing.easing.smoke, (elapsedMs - rampInMs - holdMs) / fadeMs);
      }

      this.spawnParticles(
        "smoke",
        this.coveredPixelCount * this.options.smoke.particlesPerPixel * this.options.smoke.intensity * smokeForce,
        Math.max(0.2, smokeForce)
      );
    }

    const smokeDrawableParticles = this.updateParticles("smoke");
    const fireDrawableParticles = this.updateParticles("fire");

    this.ensureParticleBounds([...smokeDrawableParticles, ...fireDrawableParticles]);
    this.drawParticles("smoke", smokeDrawableParticles);
    this.drawParticles("fire", fireDrawableParticles);
    this.context.globalAlpha = 1;
    this.context.globalCompositeOperation = "source-over";

    if (elapsedMs >= doneAtMs && this.fireParticles.length === 0 && this.smokeParticles.length === 0) {
      this.target.style.opacity = String(this.options.reveal.opacityTo);
      this.options.hooks.onDone?.();
      this.finish(true);

      return;
    }

    this.animationFrame = this.ownerWindow.requestAnimationFrame((nextTimeStamp) => this.frame(nextTimeStamp));
  }

  private finish(keepOpacity: boolean): void {
    this.settled = true;
    this.ownerWindow.removeEventListener("scroll", this.handleViewportChange);
    this.ownerWindow.removeEventListener("resize", this.handleViewportChange);
    this.ownerWindow.visualViewport?.removeEventListener("scroll", this.handleViewportChange);
    this.ownerWindow.visualViewport?.removeEventListener("resize", this.handleViewportChange);
    this.canvas.remove();

    if (!keepOpacity) {
      this.target.style.opacity = this.originalTargetOpacity;
    }

    this.resolveDone();
  }
}

export function burn(target: HTMLElement, options: BurnOptions = {}): BurnController {
  return new BurnInEffect(target, options).start();
}
