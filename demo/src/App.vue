<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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

type FeatureCard = {
  title: string;
  description: string;
};

type ExampleCard = {
  title: string;
  description: string;
};

type CopyStatus = "idle" | "copied" | "failed";

const githubLink = "https://github.com/gogoSpace/burn-in.js";
const npmPackageLink = "https://www.npmjs.com/package/@gogospace/burn-in";
const installCommand = "npm install @gogospace/burn-in";
const initialDelayMs = 840;
const replayDelayMs = 420;

const presets: DemoPreset[] = [
  {
    label: "Default",
    value: "soft",
    fireIntensity: 0.5,
    smokeIntensity: 0.33,
    burnDurationMs: 1000,
    smokeDurationMs: 3000,
  },
  {
    label: "Wildfire",
    value: "wildfire",
    fireIntensity: 1.55,
    smokeIntensity: 1.08,
    burnDurationMs: 1120,
    smokeDurationMs: 2400,
  },
  {
    label: "Smolder",
    value: "smolder",
    fireIntensity: 0.44,
    smokeIntensity: 1.35,
    burnDurationMs: 720,
    smokeDurationMs: 3600,
  },
  {
    label: "Flash",
    value: "flash",
    fireIntensity: 1.85,
    smokeIntensity: 0.22,
    burnDurationMs: 360,
    smokeDurationMs: 520,
  },
  {
    label: "Ritual",
    value: "ritual",
    fireIntensity: 1.1,
    smokeIntensity: 0.9,
    burnDurationMs: 1180,
    smokeDurationMs: 2600,
  },
  {
    label: "Psycho",
    value: "psycho",
    fireIntensity: 1.75,
    smokeIntensity: 1.3,
    burnDurationMs: 980,
    smokeDurationMs: 4200,
  },
];

const featureCards: FeatureCard[] = [
  {
    title: "Real DOM targets",
    description: "Reveal headings, inline text, images, canvas elements, and Vue slots without replacing the final content.",
  },
  {
    title: "Mask-driven particles",
    description: "Use text, alpha, luminance, or bounds masks so fire and smoke follow the visible shape.",
  },
  {
    title: "Deterministic replays",
    description: "Set a seed for repeatable captures, demos, tests, and social launch videos.",
  },
];

const exampleCards: ExampleCard[] = [
  {
    title: "Launch pages",
    description: "Burn in a logo, wordmark, or product heading when a campaign needs one memorable moment.",
  },
  {
    title: "Game and event screens",
    description: "Use theatrical fire, smoke, and timing presets for title cards, posters, and reveal moments.",
  },
  {
    title: "Vue demos",
    description: "Wrap real component output, replay effects with a key, and target a descendant inside the slot.",
  },
];

const selectedPreset = ref<BurnPresetName>("soft");
const replayKey = ref(0);
const burnDelayMs = ref(initialDelayMs);
const isActive = ref(false);
const fireIntensity = ref(0.5);
const smokeIntensity = ref(0.33);
const smokeDurationMs = ref(3000);
const burnDurationMs = ref(1000);
const seed = ref("gogospace");
const prefersReducedMotion = ref(false);
const copyStatus = ref<CopyStatus>("idle");
let reducedMotionMediaQuery: MediaQueryList | null = null;
let copyStatusTimer: number | undefined;

const burnOptions = computed<BurnOptions>(() => ({
  preset: selectedPreset.value,
  seed: seed.value,
  timing: {
    delayMs: burnDelayMs.value,
    burnMs: burnDurationMs.value,
    smokeMs: smokeDurationMs.value,
  },
  fire: {
    intensity: fireIntensity.value,
  },
  smoke: {
    intensity: smokeIntensity.value,
  },
  reveal: {
    startsAt: "burn",
  },
  mask: {
    source: "text",
    alphaThreshold: 32,
    stepPx: 2,
    padding: {
      x: 0.36,
      top: 0.82,
      bottom: 0.24,
    },
    offset: {
      y: 6,
    },
  },
}));

function replay(): void {
  burnDelayMs.value = replayDelayMs;
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

function applyReducedMotionPreference(isReducedMotion: boolean): void {
  prefersReducedMotion.value = isReducedMotion;

  if (isReducedMotion) {
    isActive.value = false;
    return;
  }

  if (replayKey.value === 0) {
    isActive.value = true;
  }
}

function handleReducedMotionChange(event: MediaQueryListEvent): void {
  applyReducedMotionPreference(event.matches);
}

function copyTextWithFallback(text: string): boolean {
  const textAreaElement = document.createElement("textarea");
  textAreaElement.value = text;
  textAreaElement.setAttribute("readonly", "");
  textAreaElement.style.position = "fixed";
  textAreaElement.style.top = "0";
  textAreaElement.style.left = "-9999px";
  document.body.appendChild(textAreaElement);
  textAreaElement.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textAreaElement);
  }
}

async function copyInstallCommand(): Promise<void> {
  if (copyStatusTimer) {
    window.clearTimeout(copyStatusTimer);
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(installCommand);
    } else if (!copyTextWithFallback(installCommand)) {
      throw new Error("Copy command was not accepted.");
    }

    copyStatus.value = "copied";
  } catch {
    copyStatus.value = "failed";
  }

  copyStatusTimer = window.setTimeout(() => {
    copyStatus.value = "idle";
  }, 2200);
}

onMounted(() => {
  reducedMotionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  applyReducedMotionPreference(reducedMotionMediaQuery.matches);
  reducedMotionMediaQuery.addEventListener("change", handleReducedMotionChange);
});

onBeforeUnmount(() => {
  reducedMotionMediaQuery?.removeEventListener("change", handleReducedMotionChange);

  if (copyStatusTimer) {
    window.clearTimeout(copyStatusTimer);
  }
});
</script>

<template>
  <main class="demo-shell">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="brand">TypeScript canvas effect</p>
        <h1 id="hero-title">Burn-In.js</h1>
        <p class="lead">
          Canvas fire and smoke reveal effects for DOM elements, text, images,
          canvas, and Vue components.
        </p>

        <div class="install-card" aria-label="Install Burn-In.js">
          <code>{{ installCommand }}</code>
          <button class="copy-action" type="button" @click="copyInstallCommand">
            {{ copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy" }}
          </button>
        </div>

        <div class="actions">
          <a class="primary-action" :href="npmPackageLink">npm package</a>
          <a class="secondary-action" :href="githubLink">GitHub</a>
          <button class="tertiary-action" type="button" @click="replay">
            Replay effect
          </button>
        </div>

        <p v-if="prefersReducedMotion" class="motion-note">
          Motion is paused by your system preference. Use replay to preview it once.
        </p>
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
            <div class="artifact-burn-target" aria-label="Burn In">
              <span class="artifact-kicker">gogoSpace</span>
              <strong>Burn In</strong>
              <small>fire + smoke + timing</small>
            </div>
          </div>
        </BurnIn>
      </div>
    </section>

    <section class="control-surface" aria-labelledby="controls-title">
      <div class="section-heading">
        <p class="section-kicker">Playground</p>
        <h2 id="controls-title">Tune the burn in real time.</h2>
      </div>

      <div class="preset-row" role="group" aria-label="Burn preset">
        <button
          v-for="preset in presets"
          :key="preset.value"
          class="preset-button"
          :class="{ selected: selectedPreset === preset.value }"
          type="button"
          :aria-pressed="selectedPreset === preset.value"
          @click="selectPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="controls-grid">
        <label>
          <span>Fire intensity</span>
          <input
            v-model.number="fireIntensity"
            type="range"
            min="0"
            max="2.4"
            step="0.05"
            @change="replay"
          />
        </label>
        <label>
          <span>Smoke intensity</span>
          <input
            v-model.number="smokeIntensity"
            type="range"
            min="0"
            max="2.4"
            step="0.05"
            @change="replay"
          />
        </label>
        <label>
          <span>Burn timing</span>
          <input
            v-model.number="burnDurationMs"
            type="range"
            min="160"
            max="2200"
            step="20"
            @change="replay"
          />
        </label>
        <label>
          <span>Smoke timing</span>
          <input
            v-model.number="smokeDurationMs"
            type="range"
            min="0"
            max="5200"
            step="50"
            @change="replay"
          />
        </label>
        <label class="seed-field">
          <span>Seed</span>
          <input v-model="seed" type="text" @change="replay" />
        </label>
      </div>
    </section>

    <section class="feature-surface" aria-labelledby="features-title">
      <div class="section-heading">
        <p class="section-kicker">Why it is useful</p>
        <h2 id="features-title">Focused reveal effects without a broad animation stack.</h2>
      </div>

      <div class="feature-grid">
        <article v-for="featureCard in featureCards" :key="featureCard.title" class="feature-card">
          <h3>{{ featureCard.title }}</h3>
          <p>{{ featureCard.description }}</p>
        </article>
      </div>
    </section>

    <section class="code-surface" aria-labelledby="code-title">
      <div class="section-heading">
        <p class="section-kicker">Drop-in API</p>
        <h2 id="code-title">Start with one call, then tune masks and particles.</h2>
      </div>

      <pre class="code-block"><code>import { burn } from "@gogospace/burn-in";

const titleElement = document.querySelector(".title");

if (titleElement instanceof HTMLElement) {
  burn(titleElement, {
    preset: "ritual",
    seed: "launch",
    mask: { source: "text" }
  });
}</code></pre>
    </section>

    <section class="example-surface" aria-labelledby="examples-title">
      <div class="section-heading">
        <p class="section-kicker">Use cases</p>
        <h2 id="examples-title">Built for theatrical moments in real interfaces.</h2>
      </div>

      <div class="example-grid">
        <article v-for="exampleCard in exampleCards" :key="exampleCard.title" class="example-card">
          <h3>{{ exampleCard.title }}</h3>
          <p>{{ exampleCard.description }}</p>
        </article>
      </div>
    </section>
  </main>
</template>
