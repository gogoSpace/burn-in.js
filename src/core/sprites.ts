import type { BurnColorStop } from "./types";

export function createRadialSprite(radius: number, colorStops: BurnColorStop[]): HTMLCanvasElement {
  const safeRadius = Math.max(1, Math.round(radius));
  const sprite = document.createElement("canvas");
  sprite.width = safeRadius * 2;
  sprite.height = safeRadius * 2;

  const context = sprite.getContext("2d");

  if (!context) {
    throw new Error("Burn-In.js: Canvas 2D context is not available.");
  }

  const gradient = context.createRadialGradient(
    safeRadius,
    safeRadius,
    0,
    safeRadius,
    safeRadius,
    safeRadius
  );

  colorStops
    .slice()
    .sort((firstStop, secondStop) => firstStop.at - secondStop.at)
    .forEach((colorStop) => {
      gradient.addColorStop(Math.min(1, Math.max(0, colorStop.at)), colorStop.color);
    });

  context.fillStyle = gradient;
  context.fillRect(0, 0, sprite.width, sprite.height);

  return sprite;
}
