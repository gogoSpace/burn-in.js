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
    this.positionCanvas();
  };
  private readonly fireParticles: Particle[] = [];
  private readonly smokeParticles: Particle[] = [];
  private emitters: BurnEmitter[] = [];
  private coveredPixelCount = 0;
  private animationFrame = 0;
  private canvasStyleHeight = 0;
  private canvasStyleWidth = 0;
  private canvasPaddingX = 0;
  private canvasPaddingTop = 0;
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

  private layout(): void {
    const source = buildBurnSource(this.target, this.options.mask);
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
    this.canvasPaddingX = paddingX;
    this.canvasPaddingTop = paddingTop;
    this.coveredPixelCount = Math.max(1, source.emitters.length * this.options.mask.stepPx * this.options.mask.stepPx);
    this.resizeCanvas(styleWidth, styleHeight);
    this.positionCanvas();
  }

  private positionCanvas(): void {
    const targetRect = this.target.getBoundingClientRect();

    this.canvas.style.left = `${Math.round(targetRect.left - this.canvasPaddingX)}px`;
    this.canvas.style.top = `${Math.round(targetRect.top - this.canvasPaddingTop)}px`;
  }

  private resizeCanvas(styleWidth: number, styleHeight: number): void {
    this.canvasStyleWidth = Math.max(1, styleWidth);
    this.canvasStyleHeight = Math.max(1, styleHeight);
    this.canvas.width = Math.max(1, Math.round(this.canvasStyleWidth * this.pixelRatio));
    this.canvas.height = Math.max(1, Math.round(this.canvasStyleHeight * this.pixelRatio));
    this.canvas.style.width = `${this.canvasStyleWidth}px`;
    this.canvas.style.height = `${this.canvasStyleHeight}px`;
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
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

    this.resizeCanvas(this.canvasStyleWidth + expandLeft + expandRight, this.canvasStyleHeight + expandTop + expandBottom);
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
      maximumX > this.canvasStyleWidth - canvasExpansionThreshold ? Math.ceil(maximumX - this.canvasStyleWidth + canvasExpansionPadding) : 0;
    const expandBottom =
      maximumY > this.canvasStyleHeight - canvasExpansionThreshold ? Math.ceil(maximumY - this.canvasStyleHeight + canvasExpansionPadding) : 0;

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
      const progress = particle.life / particle.maxLife;

      if (progress >= 1) {
        particles.splice(index, 1);
        continue;
      }

      particle.velocityX +=
        Math.sin(particle.seed + particle.life * 0.055) * options.turbulence +
        this.random.signed(options.turbulence);
      particle.velocityY -= options.lift * (1 + progress * 0.5);
      particle.velocityY *= kind === "fire" ? 0.986 : 0.992;
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      particle.life += 1;

      const alpha = particle.alpha * (kind === "fire" ? 1 - progress : 1 - progress * 0.9);
      const size = particle.size * (kind === "fire" ? 0.62 + options.expansion * (1 - progress) : 1 + progress * options.expansion);

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
    if (this.startTime === null) {
      this.startTime = timeStamp;
    }

    const elapsedMs = timeStamp - this.startTime;
    const timing = this.options.timing;
    const fireEndMs = timing.igniteMs + timing.burnMs + timing.fadeMs + timing.emberMs;
    const smokeEndMs = timing.smokeMs;
    const doneAtMs = Math.max(fireEndMs, smokeEndMs);
    this.context.clearRect(0, 0, this.canvasStyleWidth, this.canvasStyleHeight);
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
