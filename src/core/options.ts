import type { BurnOptions, BurnPresetName, ResolvedBurnOptions } from "./types";

const transparentStop = { at: 1, color: "rgba(0, 0, 0, 0)" };

export const defaultBurnOptions: ResolvedBurnOptions = {
  preset: "soft",
  seed: undefined,
  host: null,
  timing: {
    delayMs: 0,
    igniteMs: 400,
    burnMs: 1000,
    fadeMs: 900,
    emberMs: 0,
    smokeMs: 3000,
    easing: {
      ignite: "easeInCubic",
      burn: "linear",
      fade: "easeOutCubic",
      smoke: "easeOutCubic"
    }
  },
  fire: {
    enabled: true,
    intensity: 0.5,
    colors: [
      { at: 0, color: "rgba(255, 255, 210, 0.33)" },
      { at: 0.2, color: "rgba(255, 190, 60, 0.22)" },
      { at: 0.55, color: "rgba(255, 90, 10, 0.11)" },
      transparentStop
    ],
    spriteSize: 28,
    lift: 0.1,
    spread: 0.56,
    drift: 0,
    turbulence: 0.02,
    opacity: 0.9,
    expansion: 0.6,
    particleSize: [8, 24],
    particleLife: [16, 30],
    particlesPerPixel: 0.015,
    maxParticles: 6000,
    composite: "lighter"
  },
  smoke: {
    enabled: true,
    intensity: 0.33,
    colors: [
      { at: 0, color: "rgba(20, 20, 20, 0.2)" },
      { at: 0.4, color: "rgba(10, 10, 10, 0.1)" },
      transparentStop
    ],
    spriteSize: 48,
    lift: 0.05,
    spread: 0.22,
    drift: 0.12,
    turbulence: 0.01,
    opacity: 0.42,
    expansion: 1.6,
    particleSize: [21, 52],
    particleLife: [46, 90],
    particlesPerPixel: 0.008,
    maxParticles: 3600,
    composite: "destination-over"
  },
  mask: {
    source: "auto",
    alphaThreshold: 150,
    luminanceThreshold: 20,
    stepPx: 3,
    padding: {
      x: 0.25,
      top: 0.7,
      bottom: 0.25
    },
    edgeBias: 0
  },
  reveal: {
    opacityFrom: 0,
    opacityTo: 1,
    startsAt: "burn",
    durationMs: 1900,
    easing: "easeInQuad"
  },
  canvas: {
    className: "burn-in-canvas",
    zIndex: 2,
    pixelRatio: "device",
    pointerEvents: "none"
  },
  hooks: {
    onStart: undefined,
    onIgnite: undefined,
    onReveal: undefined,
    onDone: undefined,
    onCancel: undefined
  }
};

export const burnPresets: Record<BurnPresetName, BurnOptions> = {
  soft: {},
  wildfire: {
    timing: {
      igniteMs: 320,
      burnMs: 1120,
      fadeMs: 960,
      emberMs: 540,
      smokeMs: 2400
    },
    fire: {
      intensity: 1.55,
      lift: 0.014,
      spread: 0.58,
      turbulence: 0.038,
      particleSize: [12, 34],
      particleLife: [18, 34],
      particlesPerPixel: 0.019,
      maxParticles: 2400
    },
    smoke: {
      intensity: 1.08,
      drift: 0.62,
      opacity: 0.48,
      particleSize: [28, 72],
      particlesPerPixel: 0.01,
      maxParticles: 1900
    }
  },
  smolder: {
    timing: {
      igniteMs: 880,
      burnMs: 720,
      fadeMs: 1500,
      emberMs: 900,
      smokeMs: 3600
    },
    fire: {
      intensity: 0.44,
      colors: [
        { at: 0, color: "rgba(255, 232, 180, 0.26)" },
        { at: 0.35, color: "rgba(226, 88, 34, 0.18)" },
        { at: 0.75, color: "rgba(126, 28, 12, 0.1)" },
        transparentStop
      ],
      lift: 0.006,
      spread: 0.2,
      turbulence: 0.016,
      particleSize: [7, 16],
      particlesPerPixel: 0.008
    },
    smoke: {
      intensity: 1.35,
      opacity: 0.52,
      lift: 0.01,
      drift: 0.72,
      expansion: 2.15,
      particleLife: [80, 142],
      particleSize: [34, 92],
      particlesPerPixel: 0.012,
      maxParticles: 2300
    }
  },
  flash: {
    timing: {
      igniteMs: 140,
      burnMs: 360,
      fadeMs: 420,
      emberMs: 80,
      smokeMs: 520
    },
    fire: {
      intensity: 1.85,
      colors: [
        { at: 0, color: "rgba(255, 255, 255, 0.5)" },
        { at: 0.24, color: "rgba(255, 224, 120, 0.32)" },
        { at: 0.64, color: "rgba(255, 58, 10, 0.16)" },
        transparentStop
      ],
      lift: 0.018,
      spread: 0.68,
      turbulence: 0.05,
      particleSize: [10, 32],
      particleLife: [10, 20],
      maxParticles: 1600
    },
    smoke: {
      intensity: 0.22,
      opacity: 0.22,
      particlesPerPixel: 0.003,
      maxParticles: 420
    }
  },
  ritual: {
    timing: {
      igniteMs: 720,
      burnMs: 1180,
      fadeMs: 1140,
      emberMs: 620,
      smokeMs: 2600
    },
    fire: {
      intensity: 1.1,
      colors: [
        { at: 0, color: "rgba(255, 245, 215, 0.42)" },
        { at: 0.2, color: "rgba(255, 156, 54, 0.26)" },
        { at: 0.52, color: "rgba(218, 50, 30, 0.14)" },
        { at: 0.78, color: "rgba(92, 48, 128, 0.1)" },
        transparentStop
      ],
      lift: 0.011,
      spread: 0.42,
      drift: 0.32,
      turbulence: 0.032
    },
    smoke: {
      intensity: 0.9,
      colors: [
        { at: 0, color: "rgba(48, 38, 48, 0.25)" },
        { at: 0.5, color: "rgba(30, 22, 32, 0.12)" },
        transparentStop
      ],
      drift: 0.54,
      expansion: 1.9
    }
  },
  psycho: {
    timing: {
      igniteMs: 220,
      burnMs: 980,
      fadeMs: 1280,
      emberMs: 420,
      smokeMs: 4200
    },
    fire: {
      intensity: 1.75,
      colors: [
        { at: 0, color: "rgba(255, 255, 255, 0.5)" },
        { at: 0.18, color: "rgba(98, 255, 184, 0.34)" },
        { at: 0.44, color: "rgba(70, 104, 255, 0.2)" },
        { at: 0.72, color: "rgba(255, 52, 214, 0.14)" },
        transparentStop
      ],
      lift: 0.13,
      spread: 0.86,
      drift: 0.32,
      turbulence: 0.07,
      particleSize: [12, 40],
      particleLife: [14, 32],
      particlesPerPixel: 0.018,
      maxParticles: 7200
    },
    smoke: {
      intensity: 1.3,
      colors: [
        { at: 0, color: "rgba(38, 24, 72, 0.28)" },
        { at: 0.38, color: "rgba(18, 64, 72, 0.16)" },
        { at: 0.72, color: "rgba(82, 12, 64, 0.1)" },
        transparentStop
      ],
      lift: 0.07,
      drift: 0.84,
      turbulence: 0.044,
      expansion: 2.45,
      particleSize: [30, 110],
      particleLife: [84, 168],
      particlesPerPixel: 0.012,
      maxParticles: 5200
    }
  }
};

type DeepPartialRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is DeepPartialRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : (override as T);
  }

  const result: DeepPartialRecord = { ...base };

  Object.entries(override).forEach(([key, value]) => {
    result[key] = deepMerge(result[key], value);
  });

  return result as T;
}

export function resolveBurnOptions(options: BurnOptions = {}): ResolvedBurnOptions {
  const presetName = options.preset ?? "soft";
  const presetOptions = burnPresets[presetName] ?? burnPresets.soft;
  const resolvedFromPreset = deepMerge(defaultBurnOptions, presetOptions);

  return deepMerge(resolvedFromPreset, {
    ...options,
    preset: presetName
  });
}
