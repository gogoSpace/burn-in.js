import type { BurnEasingName } from "./types";

export const burnEasings: Record<BurnEasingName, (progress: number) => number> = {
  linear: (progress) => progress,
  easeInQuad: (progress) => progress * progress,
  easeInCubic: (progress) => progress * progress * progress,
  easeOutCubic: (progress) => 1 - Math.pow(1 - progress, 3),
  easeInOutCubic: (progress) =>
    progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2,
  easeOutQuart: (progress) => 1 - Math.pow(1 - progress, 4)
};

export function ease(name: BurnEasingName, progress: number): number {
  const boundedProgress = Math.min(1, Math.max(0, progress));

  return burnEasings[name](boundedProgress);
}
