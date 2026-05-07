import type { BurnEmitter, BurnSource, ResolvedBurnMaskOptions } from "./types";

function isImageElement(target: HTMLElement): target is HTMLImageElement {
  return target instanceof HTMLImageElement;
}

function isCanvasElement(target: HTMLElement): target is HTMLCanvasElement {
  return target instanceof HTMLCanvasElement;
}

function sampleImageData(target: HTMLImageElement | HTMLCanvasElement): ImageData | null {
  const width = isImageElement(target) ? target.naturalWidth : target.width;
  const height = isImageElement(target) ? target.naturalHeight : target.height;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  try {
    context.drawImage(target, 0, 0, width, height);

    return context.getImageData(0, 0, width, height);
  } catch {
    return null;
  }
}

function pixelLuminance(red: number, green: number, blue: number): number {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function buildBoundsSource(width: number, height: number, stepPx: number): BurnSource {
  const emitters: BurnEmitter[] = [];

  for (let yPosition = 0; yPosition <= height; yPosition += stepPx) {
    for (let xPosition = 0; xPosition <= width; xPosition += stepPx) {
      emitters.push({
        x: xPosition,
        y: yPosition,
        weight: 1
      });
    }
  }

  return { width, height, emitters };
}

function buildImageSource(
  target: HTMLImageElement | HTMLCanvasElement,
  displayWidth: number,
  displayHeight: number,
  maskOptions: ResolvedBurnMaskOptions
): BurnSource | null {
  const imageData = sampleImageData(target);

  if (!imageData) {
    return null;
  }

  const emitters: BurnEmitter[] = [];
  const stepPx = Math.max(1, Math.round(maskOptions.stepPx));
  const sourceWidth = imageData.width;
  const sourceHeight = imageData.height;
  const data = imageData.data;

  for (let yPosition = 0; yPosition <= displayHeight; yPosition += stepPx) {
    const sourceY = Math.min(sourceHeight - 1, Math.max(0, Math.round((yPosition / displayHeight) * sourceHeight)));

    for (let xPosition = 0; xPosition <= displayWidth; xPosition += stepPx) {
      const sourceX = Math.min(sourceWidth - 1, Math.max(0, Math.round((xPosition / displayWidth) * sourceWidth)));
      const offset = (sourceY * sourceWidth + sourceX) * 4;
      const alpha = data[offset + 3];
      const luminance = pixelLuminance(data[offset], data[offset + 1], data[offset + 2]);
      const passesAlpha = alpha >= maskOptions.alphaThreshold;
      const passesLuminance = luminance >= maskOptions.luminanceThreshold && alpha > 0;
      const shouldUseLuminance = maskOptions.source === "luminance";

      if ((shouldUseLuminance && passesLuminance) || (!shouldUseLuminance && passesAlpha)) {
        emitters.push({
          x: xPosition,
          y: yPosition,
          weight: shouldUseLuminance ? Math.max(0.12, luminance / 255) : Math.max(0.12, alpha / 255)
        });
      }
    }
  }

  return { width: displayWidth, height: displayHeight, emitters };
}

export function buildBurnSource(target: HTMLElement, maskOptions: ResolvedBurnMaskOptions): BurnSource {
  const rect = target.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const stepPx = Math.max(1, Math.round(maskOptions.stepPx));
  const canSamplePixels = isImageElement(target) || isCanvasElement(target);
  const shouldSamplePixels =
    canSamplePixels && (maskOptions.source === "auto" || maskOptions.source === "alpha" || maskOptions.source === "luminance");

  if (shouldSamplePixels) {
    const imageSource = buildImageSource(target, width, height, maskOptions);

    if (imageSource && imageSource.emitters.length > 0) {
      return imageSource;
    }
  }

  return buildBoundsSource(width, height, stepPx);
}
