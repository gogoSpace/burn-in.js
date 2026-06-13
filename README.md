# Burn-In.js

[![npm version](https://img.shields.io/npm/v/@gogospace/burn-in.svg)](https://www.npmjs.com/package/@gogospace/burn-in)
[![CI](https://github.com/gogoSpace/burn-in.js/actions/workflows/ci.yml/badge.svg)](https://github.com/gogoSpace/burn-in.js/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@gogospace/burn-in.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/@gogospace/burn-in.svg)](https://www.npmjs.com/package/@gogospace/burn-in)

Canvas fire-and-smoke reveal effects for real DOM text, images, canvas, and Vue components.

[Live playground](https://burn-in.gogospace.cz/) · [npm](https://www.npmjs.com/package/@gogospace/burn-in) · [GitHub](https://github.com/gogoSpace/burn-in.js)

![Burn-In.js preview](https://raw.githubusercontent.com/gogoSpace/burn-in.js/main/demo/public/og-image.png)

Burn-In.js adds a dramatic fire-and-smoke reveal to real web content. Point it at a DOM element, image, canvas, or Vue slot, then choose a preset or tune the masks, particles, timing, and seed. The original content stays in the document after the reveal, so text can remain selectable and accessible.

## Features

- Burn real DOM text while keeping it selectable and accessible after reveal.
- Use alpha, luminance, text, or bounds masks for different source types.
- Pick from six presets: `soft`, `wildfire`, `smolder`, `flash`, `ritual`, and `psycho`.
- Replay deterministic particle patterns with `seed`.
- Use the framework-neutral TypeScript core or the optional Vue 3 component.
- Cancel effects and wait for completion with a typed controller.

## Installation

```bash
npm install @gogospace/burn-in
```

```bash
pnpm add @gogospace/burn-in
```

```bash
yarn add @gogospace/burn-in
```

Vue is an optional peer dependency. Install Vue only when you use the `@gogospace/burn-in/vue` adapter.

## Quick Start

```ts
import { burn } from "@gogospace/burn-in";

const logoElement = document.querySelector(".logo");

if (logoElement instanceof HTMLElement) {
  const controller = burn(logoElement, {
    preset: "ritual",
    fire: { intensity: 1.2 },
    smoke: { intensity: 0.8 },
    seed: "launch"
  });

  await controller.done;
}
```

## Vue

```vue
<script setup lang="ts">
import { ref } from "vue";
import { BurnIn } from "@gogospace/burn-in/vue";

const replayKey = ref(0);
</script>

<template>
  <button type="button" @click="replayKey++">Replay</button>

  <BurnIn
    active
    :replay-key="replayKey"
    :options="{ preset: 'smolder', mask: { source: 'text' }, smoke: { intensity: 1.4 } }"
  >
    <strong>Burn me in</strong>
  </BurnIn>

  <BurnIn
    active
    target-selector="img"
    :replay-key="replayKey"
    :options="{ mask: { source: 'alpha' } }"
  >
    <img src="/logo.png" alt="Logo" />
  </BurnIn>
</template>
```

### Vue Props and Events

| Prop | Description |
| --- | --- |
| `active` | Starts the effect when true and cancels it when false. |
| `options` | A `BurnOptions` object passed to `burn()`. |
| `as` | Host element tag name. Defaults to `span`. |
| `replayKey` | Change this value to replay the effect while `active` is true. |
| `contentClass` | Class applied to the wrapped slot target. |
| `targetSelector` | Selector for a concrete descendant to burn instead of the wrapper. |

| Event | Description |
| --- | --- |
| `start` | Emitted before a new effect starts. |
| `done` | Emitted when the effect finishes. |
| `cancel` | Emitted when a running effect is cancelled. |

The component also exposes `play()` and `cancel()` for imperative control.

## Configuration

Burn-In.js keeps the easy path short and the expert path deep. Start with a preset and override only what you need.

```ts
import { burn } from "@gogospace/burn-in";

burn(headingElement, {
  preset: "wildfire",
  seed: "same-effect-every-time",
  timing: {
    delayMs: 420,
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
      { at: 0, color: "rgba(255, 255, 230, 0.42)" },
      { at: 0.24, color: "rgba(255, 180, 50, 0.28)" },
      { at: 0.62, color: "rgba(255, 60, 10, 0.14)" },
      { at: 1, color: "rgba(0, 0, 0, 0)" }
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

`seed` controls the random particle pattern. Use a stable string or number when you want the same element and options to replay with the same fire and smoke behavior. Omit it when every burn should feel slightly different.

## Presets

| Preset | Best for |
| --- | --- |
| `soft` | Default profile with balanced timing and density. |
| `wildfire` | Stronger fire and dense smoke. |
| `smolder` | Slower reveal with long smoke. |
| `flash` | Short, bright ignition. |
| `ritual` | Warm theatrical fire with expressive smoke. |
| `psycho` | Saturated color, heavy turbulence, and long colored smoke. |

## Masks

Images and canvas elements can use pixel data automatically. Text elements can use a generated alpha mask while staying real selectable DOM text. Generic DOM elements use their bounds, which means any element can be burned into view without extra dependencies.

```ts
burn(imageElement, {
  mask: {
    source: "alpha",
    alphaThreshold: 150,
    stepPx: 3
  }
});
```

```ts
burn(headingElement, {
  mask: {
    source: "text",
    offset: {
      y: 6
    }
  }
});
```

Text masks are useful for headings, spans, paragraphs, and other real DOM text. The effect uses an internal alpha mask for the fire and smoke, while the original text remains selectable and accessible after reveal.

Use `mask.offset.x` and `mask.offset.y` to fine-tune emitter alignment. Positive `y` moves the burn mask downward, which can make rising fire and smoke feel more natural over text.

Supported mask sources:

- `auto`
- `alpha`
- `luminance`
- `bounds`
- `text`

## API

| Export | Description |
| --- | --- |
| `burn(target, options)` | Starts the effect and returns a `BurnController`. |
| `BurnInEffect` | Class API for direct construction when needed. |
| `BurnController` | `{ cancel(): void; done: Promise<void> }`. |
| `BurnOptions` | Typed configuration for presets, timing, particles, masks, reveal, canvas, and hooks. |
| `burnPresets` | Preset option map used by the resolver. |
| `resolveBurnOptions(options)` | Resolves partial options into complete internal options. |

### Option Groups

| Group | Controls |
| --- | --- |
| `timing` | Delay, ignition, burn, fade, ember, smoke, and easing durations. |
| `fire` | Fire particle density, colors, lift, spread, turbulence, size, lifetime, and blending. |
| `smoke` | Smoke particle density, colors, drift, expansion, size, lifetime, and blending. |
| `mask` | Source, thresholds, sampling step, padding, offset, and edge bias. |
| `reveal` | Target opacity, reveal phase, duration, and easing. |
| `canvas` | Overlay class, z-index, pixel ratio, and pointer events. |
| `hooks` | `onStart`, `onIgnite`, `onReveal`, `onDone`, and `onCancel`. |

## Accessibility and Motion

Avoid autoplaying heavy effects when `prefers-reduced-motion` is active. Keep the underlying content meaningful without the animation, then start Burn-In.js only when motion is allowed or explicitly requested.

```ts
import { burn, type BurnOptions } from "@gogospace/burn-in";

const titleElement = document.querySelector(".title");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const burnOptions: BurnOptions = {
  preset: "ritual",
  seed: "launch",
  mask: { source: "text" }
};

if (titleElement instanceof HTMLElement && !prefersReducedMotion) {
  const controller = burn(titleElement, burnOptions);

  controller.done.then(() => {
    // Continue after the reveal finishes.
  });
}
```

## Browser Notes

- The effect requires Canvas 2D and `requestAnimationFrame`.
- Reading pixels from cross-origin images needs valid CORS headers.
- Text masks are generated from DOM text and preserve the final real text in the page.
- Server-rendered apps should start the effect only after the target element exists in the browser.

## Use Cases

- Dramatic logo, wordmark, or heading reveals on launch pages and product microsites.
- Game, horror, fantasy, metal, event, or campaign title cards.
- Image, badge, poster, or canvas artwork reveals using alpha or luminance masks.
- Vue component reveals with replay controls for onboarding, demos, easter eggs, or state transitions.
- Deterministic visual demos, Storybook examples, or recorded UI captures using `seed`.

## Local Development

```bash
npm install
npm run dev
npm test
npm run build
```

The demo runs through Vite on port `5177`.

For release checks, run the build before `npm run pack:dry` so the generated `dist` files are present.

## License

MIT
