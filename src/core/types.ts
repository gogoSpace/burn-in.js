export type BurnPresetName = "soft" | "wildfire" | "smolder" | "flash" | "ritual" | "psycho";

export type BurnEasingName =
  | "linear"
  | "easeInQuad"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeOutQuart";

export type BurnMaskSource = "auto" | "alpha" | "luminance" | "bounds";

export type BurnRange = number | [number, number];

export type BurnColorStop = {
  at: number;
  color: string;
};

export type BurnTimingOptions = {
  delayMs?: number;
  igniteMs?: number;
  burnMs?: number;
  fadeMs?: number;
  emberMs?: number;
  smokeMs?: number;
  easing?: Partial<Record<"ignite" | "burn" | "fade" | "smoke", BurnEasingName>>;
};

export type BurnParticleOptions = {
  enabled?: boolean;
  intensity?: number;
  colors?: BurnColorStop[];
  spriteSize?: number;
  lift?: number;
  spread?: number;
  drift?: number;
  turbulence?: number;
  opacity?: number;
  expansion?: number;
  particleSize?: BurnRange;
  particleLife?: BurnRange;
  particlesPerPixel?: number;
  maxParticles?: number;
  composite?: GlobalCompositeOperation;
};

export type BurnMaskOptions = {
  source?: BurnMaskSource;
  alphaThreshold?: number;
  luminanceThreshold?: number;
  stepPx?: number;
  padding?: {
    x?: number;
    top?: number;
    bottom?: number;
  };
  edgeBias?: number;
};

export type BurnRevealOptions = {
  opacityFrom?: number;
  opacityTo?: number;
  startsAt?: "ignite" | "burn" | "fade";
  durationMs?: number;
  easing?: BurnEasingName;
};

export type BurnCanvasOptions = {
  className?: string;
  zIndex?: number | string;
  pixelRatio?: number | "device";
  pointerEvents?: "none" | "auto";
};

export type BurnHookOptions = {
  onStart?: () => void;
  onIgnite?: () => void;
  onReveal?: () => void;
  onDone?: () => void;
  onCancel?: () => void;
};

export type BurnOptions = {
  preset?: BurnPresetName;
  seed?: string | number;
  host?: HTMLElement | null;
  timing?: BurnTimingOptions;
  fire?: BurnParticleOptions;
  smoke?: BurnParticleOptions;
  mask?: BurnMaskOptions;
  reveal?: BurnRevealOptions;
  canvas?: BurnCanvasOptions;
  hooks?: BurnHookOptions;
};

export type ResolvedBurnTimingOptions = Required<Omit<BurnTimingOptions, "easing">> & {
  easing: Required<NonNullable<BurnTimingOptions["easing"]>>;
};

export type ResolvedBurnParticleOptions = Required<BurnParticleOptions>;

export type ResolvedBurnMaskOptions = Required<Omit<BurnMaskOptions, "padding">> & {
  padding: Required<NonNullable<BurnMaskOptions["padding"]>>;
};

export type ResolvedBurnRevealOptions = Required<BurnRevealOptions>;

export type ResolvedBurnCanvasOptions = Required<BurnCanvasOptions>;

export type ResolvedBurnOptions = {
  preset: BurnPresetName;
  seed: string | number | undefined;
  host: HTMLElement | null;
  timing: ResolvedBurnTimingOptions;
  fire: ResolvedBurnParticleOptions;
  smoke: ResolvedBurnParticleOptions;
  mask: ResolvedBurnMaskOptions;
  reveal: ResolvedBurnRevealOptions;
  canvas: ResolvedBurnCanvasOptions;
  hooks: BurnHookOptions;
};

export type BurnEmitter = {
  x: number;
  y: number;
  weight: number;
};

export type BurnSource = {
  width: number;
  height: number;
  emitters: BurnEmitter[];
};

export type BurnController = {
  cancel: () => void;
  done: Promise<void>;
};
