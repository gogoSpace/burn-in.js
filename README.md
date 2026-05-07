# Burn-In.js

Burn-In.js is a small canvas engine for burning DOM elements into view with configurable fire, smoke, masks, timing, and presets.

It ships as a framework-neutral core with an optional Vue 3 adapter.

```bash
npm install @gogospace/burn-in
```

## Quick Start

```ts
import { burn } from "@gogospace/burn-in";

const element = document.querySelector(".logo");

if (element instanceof HTMLElement) {
  burn(element, {
    preset: "ritual",
    fire: { intensity: 1.2 },
    smoke: { intensity: 0.8 },
    seed: "launch"
  });
}
```

## Vue

```vue
<script setup>
import { ref } from "vue";
import { BurnIn } from "@gogospace/burn-in/vue";

const replayKey = ref(0);
</script>

<template>
  <button type="button" @click="replayKey++">Replay</button>

  <BurnIn
    active
    :replay-key="replayKey"
    :options="{ preset: 'smolder', smoke: { intensity: 1.4 } }"
  >
    <strong>Burn me in</strong>
  </BurnIn>
</template>
```

## Configuration

Burn-In.js keeps the easy path short and the expert path deep. Start with a preset and override only what you need.

```ts
burn(element, {
  preset: "wildfire",
  seed: "same-effect-every-time",
  timing: {
    igniteMs: 420,
    burnMs: 1000,
    fadeMs: 900,
    smokeMs: 2600
  },
  fire: {
    intensity: 1.4,
    lift: 0.014,
    spread: 0.56,
    turbulence: 0.04,
    particleSize: [10, 30],
    colors: [
      { at: 0, color: "rgba(255,255,230,0.42)" },
      { at: 0.24, color: "rgba(255,180,50,0.28)" },
      { at: 0.62, color: "rgba(255,60,10,0.14)" },
      { at: 1, color: "rgba(0,0,0,0)" }
    ]
  },
  smoke: {
    intensity: 0.9,
    drift: 0.6,
    expansion: 2,
    particleLife: [72, 140]
  },
  reveal: {
    startsAt: "burn",
    durationMs: 980
  }
});
```

## Presets

- `soft` - default profile matching the original Burn concept timing and density
- `wildfire` - stronger fire and dense smoke
- `smolder` - slower reveal with long smoke
- `flash` - short, bright ignition
- `ritual` - warmer fire with a slightly theatrical smoke profile
- `psycho` - saturated color, heavy turbulence, and long colored smoke

## Masks

Images and canvas elements can use pixel data automatically. Generic DOM elements use their bounds, which means any element can be burned into view without extra dependencies.

```ts
burn(imageElement, {
  mask: {
    source: "alpha",
    alphaThreshold: 150,
    stepPx: 3
  }
});
```

Supported mask sources:

- `auto`
- `alpha`
- `luminance`
- `bounds`

## Browser Notes

- The effect requires Canvas 2D and `requestAnimationFrame`.
- Reading pixels from cross-origin images needs valid CORS headers.
- For accessibility, applications should avoid autoplaying heavy effects when `prefers-reduced-motion` is active.

## Local Development

```bash
npm install
npm run dev
npm test
npm run build
```

The demo runs through Vite on port `5177`.

## Publishing Checklist

Before the first npm release:

1. Confirm the public package name: `@gogospace/burn-in`.
2. Run `npm test`, `npm run build`, `npm run build:demo`, and `npm run pack:dry`.
3. Publish with `npm publish --access public` after npm authentication is working.
4. Prefer npm Trusted Publishing from GitHub Actions for later releases.

## License

MIT
