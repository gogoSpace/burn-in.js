<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { BurnIn } from "../../src/vue";
import type { BurnOptions, BurnPresetName } from "../../src";

type DemoPreset = {
  label: string;
  value: BurnPresetName;
  fireIntensity: number;
  smokeIntensity: number;
  burnDurationMs: number;
  smokeDurationMs: number;
};

const presets: DemoPreset[] = [
  { label: "Default", value: "soft", fireIntensity: 0.5, smokeIntensity: 0.33, burnDurationMs: 1000, smokeDurationMs: 3000 },
  { label: "Wildfire", value: "wildfire", fireIntensity: 1.55, smokeIntensity: 1.08, burnDurationMs: 1120, smokeDurationMs: 2400 },
  { label: "Smolder", value: "smolder", fireIntensity: 0.44, smokeIntensity: 1.35, burnDurationMs: 720, smokeDurationMs: 3600 },
  { label: "Flash", value: "flash", fireIntensity: 1.85, smokeIntensity: 0.22, burnDurationMs: 360, smokeDurationMs: 520 },
  { label: "Ritual", value: "ritual", fireIntensity: 1.1, smokeIntensity: 0.9, burnDurationMs: 1180, smokeDurationMs: 2600 },
  { label: "Psycho", value: "psycho", fireIntensity: 1.75, smokeIntensity: 1.3, burnDurationMs: 980, smokeDurationMs: 4200 }
];

const selectedPreset = ref<BurnPresetName>("soft");
const replayKey = ref(0);
const isActive = ref(false);
const fireIntensity = ref(0.5);
const smokeIntensity = ref(0.33);
const smokeDurationMs = ref(3000);
const burnDurationMs = ref(1000);
const seed = ref("gogospace");
const artifactTextCanvas = ref<HTMLCanvasElement | null>(null);
let artifactResizeObserver: ResizeObserver | null = null;

const burnOptions = computed<BurnOptions>(() => ({
  preset: selectedPreset.value,
  seed: seed.value,
  timing: {
    burnMs: burnDurationMs.value,
    smokeMs: smokeDurationMs.value
  },
  fire: {
    intensity: fireIntensity.value
  },
  smoke: {
    intensity: smokeIntensity.value
  },
  reveal: {
    startsAt: "burn"
  },
  mask: {
    source: "alpha",
    alphaThreshold: 48,
    stepPx: 2,
    padding: {
      x: 0.36,
      top: 0.82,
      bottom: 0.24
    }
  }
}));

function buildArtifactFont(weight: number, fontSize: number): string {
  return `${weight} ${fontSize}px Inter, system-ui, sans-serif`;
}

function fitFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  weight: number,
  preferredFontSize: number,
  minimumFontSize: number,
  maximumTextWidth: number
): number {
  let fontSize = preferredFontSize;

  while (fontSize > minimumFontSize) {
    context.font = buildArtifactFont(weight, fontSize);

    if (context.measureText(text).width <= maximumTextWidth) {
      return fontSize;
    }

    fontSize -= 2;
  }

  return minimumFontSize;
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  text: string,
  yPosition: number,
  weight: number,
  preferredFontSize: number,
  minimumFontSize: number,
  maximumTextWidth: number,
  fillStyle: string
): void {
  context.font = buildArtifactFont(
    weight,
    fitFontSize(context, text, weight, preferredFontSize, minimumFontSize, maximumTextWidth)
  );
  context.fillStyle = fillStyle;
  context.fillText(text, 0, yPosition);
}

function drawArtifactText(): void {
  const canvas = artifactTextCanvas.value;

  if (!canvas) {
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const canvasWidth = Math.max(1, Math.round(canvasRect.width));
  const canvasHeight = Math.max(1, Math.round(canvasRect.height));
  const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = Math.round(canvasWidth * pixelRatio);
  canvas.height = Math.round(canvasHeight * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.translate(canvasWidth / 2, 0);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(62, 27, 8, 0.42)";
  context.shadowBlur = Math.max(4, canvasWidth * 0.018);
  context.shadowOffsetY = Math.max(1, canvasWidth * 0.006);
  const maximumTextWidth = canvasWidth * 0.96;

  drawCenteredText(
    context,
    "gogoSpace",
    canvasHeight * 0.2,
    800,
    Math.round(canvasWidth * 0.09),
    20,
    maximumTextWidth,
    "rgba(62, 27, 8, 0.76)"
  );
  drawCenteredText(
    context,
    "Burn In",
    canvasHeight * 0.5,
    900,
    Math.round(canvasWidth * 0.29),
    72,
    maximumTextWidth,
    "rgba(42, 18, 6, 0.92)"
  );
  drawCenteredText(
    context,
    "fire + smoke + timing",
    canvasHeight * 0.78,
    700,
    Math.round(canvasWidth * 0.06),
    18,
    maximumTextWidth,
    "rgba(56, 25, 9, 0.68)"
  );
}

function replay(): void {
  drawArtifactText();
  isActive.value = false;
  requestAnimationFrame(() => {
    replayKey.value += 1;
    isActive.value = true;
  });
}

function selectPreset(preset: BurnPresetName): void {
  selectedPreset.value = preset;
  const presetSettings = presets.find((presetOption) => presetOption.value === preset);

  if (presetSettings) {
    fireIntensity.value = presetSettings.fireIntensity;
    smokeIntensity.value = presetSettings.smokeIntensity;
    burnDurationMs.value = presetSettings.burnDurationMs;
    smokeDurationMs.value = presetSettings.smokeDurationMs;
  }

  replay();
}

onMounted(async () => {
  await nextTick();
  drawArtifactText();

  if (artifactTextCanvas.value) {
    artifactResizeObserver = new ResizeObserver(() => {
      drawArtifactText();
    });
    artifactResizeObserver.observe(artifactTextCanvas.value);
  }

  requestAnimationFrame(() => {
    replayKey.value += 1;
    isActive.value = true;
  });
});

onBeforeUnmount(() => {
  artifactResizeObserver?.disconnect();
});
</script>

<template>
  <main class="demo-shell">
    <section class="hero">
      <div class="hero-copy">
        <p class="brand">Burn-In.js</p>
        <h1>Burn any web element into view.</h1>
        <p class="lead">
          A small canvas engine for configurable fire, smoke, timing, masks, and Vue wrappers.
        </p>
        <div class="actions">
          <button class="primary-action" type="button" @click="replay">Replay burn</button>
          <a class="secondary-action" href="https://github.com/gogoSpace/burn-in.js">GitHub</a>
        </div>
      </div>

      <div class="stage" aria-label="Burn-In.js live preview">
        <BurnIn
          as="div"
          :active="isActive"
          :replay-key="replayKey"
          target-selector=".artifact-burn-target"
          :options="burnOptions"
          content-class="burn-content"
        >
          <div class="artifact">
            <canvas ref="artifactTextCanvas" class="artifact-burn-target" aria-label="Burn In" />
          </div>
        </BurnIn>
      </div>
    </section>

    <section class="control-surface" aria-label="Burn-In.js controls">
      <div class="preset-row">
        <button
          v-for="preset in presets"
          :key="preset.value"
          class="preset-button"
          :class="{ selected: selectedPreset === preset.value }"
          type="button"
          @click="selectPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="controls-grid">
        <label>
          <span>Fire intensity</span>
          <input v-model.number="fireIntensity" type="range" min="0" max="2.4" step="0.05" @change="replay" />
        </label>
        <label>
          <span>Smoke intensity</span>
          <input v-model.number="smokeIntensity" type="range" min="0" max="2.4" step="0.05" @change="replay" />
        </label>
        <label>
          <span>Burn timing</span>
          <input v-model.number="burnDurationMs" type="range" min="160" max="2200" step="20" @change="replay" />
        </label>
        <label>
          <span>Smoke timing</span>
          <input v-model.number="smokeDurationMs" type="range" min="0" max="5200" step="50" @change="replay" />
        </label>
        <label class="seed-field">
          <span>Seed</span>
          <input v-model="seed" type="text" @change="replay" />
        </label>
      </div>
    </section>
  </main>
</template>
