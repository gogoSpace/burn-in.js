import type { BurnEmitter, BurnSource, ResolvedBurnMaskOptions } from "./types";

type TextLine = {
  text: string;
  x: number;
  y: number;
  height: number;
  style: CSSStyleDeclaration;
};

type TextLineRange = {
  startIndex: number;
  endIndex: number;
  left: number;
  top: number;
  bottom: number;
  lastRight: number;
};

type TextSegment = {
  text: string;
  startIndex: number;
  endIndex: number;
};

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

function buildCanvasFont(style: CSSStyleDeclaration): string {
  if (style.font) {
    return style.font;
  }

  const lineHeight = style.lineHeight && style.lineHeight !== "normal" ? `/${style.lineHeight}` : "";

  return `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize}${lineHeight} ${style.fontFamily}`;
}

function applyCanvasTextSpacing(context: CanvasRenderingContext2D, style: CSSStyleDeclaration): void {
  const spacedContext = context as unknown as Record<string, string>;

  spacedContext.fontKerning = style.fontKerning;
  spacedContext.fontStretch = style.fontStretch.endsWith("%") ? "normal" : style.fontStretch;
  spacedContext.fontVariantCaps = style.fontVariantCaps;
  spacedContext.letterSpacing = style.letterSpacing;
  spacedContext.wordSpacing = style.wordSpacing;
}

function applyTextTransform(text: string, style: CSSStyleDeclaration): string {
  if (style.textTransform === "uppercase") {
    return text.toLocaleUpperCase();
  }

  if (style.textTransform === "lowercase") {
    return text.toLocaleLowerCase();
  }

  if (style.textTransform === "capitalize") {
    return text.replace(/\p{L}+/gu, (word) => word.charAt(0).toLocaleUpperCase() + word.slice(1));
  }

  return text;
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

function applyMaskOffset(source: BurnSource, maskOptions: ResolvedBurnMaskOptions): BurnSource {
  const offsetX = maskOptions.offset.x;
  const offsetY = maskOptions.offset.y;

  if (offsetX === 0 && offsetY === 0) {
    return source;
  }

  return {
    ...source,
    emitters: source.emitters.map((emitter) => ({
      ...emitter,
      x: emitter.x + offsetX,
      y: emitter.y + offsetY
    }))
  };
}

function buildImageDataSource(
  imageData: ImageData,
  displayWidth: number,
  displayHeight: number,
  maskOptions: ResolvedBurnMaskOptions,
  useLuminance: boolean
): BurnSource {
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

      if ((useLuminance && passesLuminance) || (!useLuminance && passesAlpha)) {
        emitters.push({
          x: xPosition,
          y: yPosition,
          weight: useLuminance ? Math.max(0.12, luminance / 255) : Math.max(0.12, alpha / 255)
        });
      }
    }
  }

  return { width: displayWidth, height: displayHeight, emitters };
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

  return buildImageDataSource(imageData, displayWidth, displayHeight, maskOptions, maskOptions.source === "luminance");
}

function splitTextSegments(text: string): TextSegment[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

    return Array.from(segmenter.segment(text), (segment) => ({
      text: segment.segment,
      startIndex: segment.index,
      endIndex: segment.index + segment.segment.length
    }));
  }

  const segments: TextSegment[] = [];
  let currentIndex = 0;

  for (const textSegment of Array.from(text)) {
    const nextIndex = currentIndex + textSegment.length;
    segments.push({
      text: textSegment,
      startIndex: currentIndex,
      endIndex: nextIndex
    });
    currentIndex = nextIndex;
  }

  return segments;
}

function isVisibleTextParent(element: HTMLElement): boolean {
  const style = getComputedStyle(element);

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) !== 0 &&
    Number.parseFloat(style.fontSize) > 0
  );
}

function collectTextNodes(target: HTMLElement): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode instanceof Text && currentNode.data.trim() && currentNode.parentElement && isVisibleTextParent(currentNode.parentElement)) {
      textNodes.push(currentNode);
    }

    currentNode = walker.nextNode();
  }

  return textNodes;
}

function collectTextLines(textNode: Text, targetRect: DOMRect): TextLine[] {
  const parentElement = textNode.parentElement;

  if (!parentElement) {
    return [];
  }

  const style = getComputedStyle(parentElement);
  const textLines: TextLine[] = [];
  const segments = splitTextSegments(textNode.data);
  let currentLineRange: TextLineRange | null = null;

  const flushCurrentLine = () => {
    if (!currentLineRange) {
      return;
    }

    const text = applyTextTransform(textNode.data.slice(currentLineRange.startIndex, currentLineRange.endIndex), style);

    if (text.trim()) {
      textLines.push({
        text,
        x: currentLineRange.left,
        y: currentLineRange.top,
        height: currentLineRange.bottom - currentLineRange.top,
        style
      });
    }

    currentLineRange = null;
  };

  for (const segment of segments) {
    if (/[\r\n]/u.test(segment.text)) {
      flushCurrentLine();
      continue;
    }

    const range = document.createRange();
    range.setStart(textNode, segment.startIndex);
    range.setEnd(textNode, segment.endIndex);
    const rect = Array.from(range.getClientRects()).find((clientRect) => clientRect.width > 0 && clientRect.height > 0);
    range.detach();

    if (!rect) {
      continue;
    }

    const top = rect.top - targetRect.top;
    const bottom = rect.bottom - targetRect.top;
    const left = rect.left - targetRect.left;
    const right = rect.right - targetRect.left;
    const startsNewLine =
      !currentLineRange || Math.abs(top - currentLineRange.top) > 2 || right < currentLineRange.lastRight || left < currentLineRange.lastRight - 1;

    if (startsNewLine) {
      flushCurrentLine();
      currentLineRange = {
        startIndex: segment.startIndex,
        endIndex: segment.endIndex,
        left,
        top,
        bottom,
        lastRight: right
      };
      continue;
    }

    if (currentLineRange) {
      currentLineRange.endIndex = segment.endIndex;
      currentLineRange.top = Math.min(currentLineRange.top, top);
      currentLineRange.bottom = Math.max(currentLineRange.bottom, bottom);
      currentLineRange.lastRight = right;
    }
  }

  flushCurrentLine();

  return textLines;
}

function resolveTextBaselineY(context: CanvasRenderingContext2D, textLine: TextLine): number {
  const metrics = context.measureText(textLine.text);
  const fontSize = Number.parseFloat(textLine.style.fontSize) || textLine.height;
  const ascent = metrics.actualBoundingBoxAscent || metrics.fontBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent || metrics.fontBoundingBoxDescent || fontSize * 0.2;
  const textHeight = ascent + descent;
  const leading = Math.max(0, textLine.height - textHeight);

  return textLine.y + leading / 2 + ascent;
}

function drawTextLines(context: CanvasRenderingContext2D, textLines: TextLine[]): void {
  context.fillStyle = "rgb(0, 0, 0)";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";

  for (const textLine of textLines) {
    context.font = buildCanvasFont(textLine.style);
    context.direction = textLine.style.direction as CanvasDirection;
    applyCanvasTextSpacing(context, textLine.style);
    context.fillText(textLine.text, textLine.x, resolveTextBaselineY(context, textLine));
  }
}

function buildTextSource(
  target: HTMLElement,
  displayWidth: number,
  displayHeight: number,
  maskOptions: ResolvedBurnMaskOptions
): BurnSource | null {
  const textLines = collectTextNodes(target).flatMap((textNode) => collectTextLines(textNode, target.getBoundingClientRect()));

  if (textLines.length === 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = displayWidth;
  canvas.height = displayHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  drawTextLines(context, textLines);

  return buildImageDataSource(context.getImageData(0, 0, displayWidth, displayHeight), displayWidth, displayHeight, maskOptions, false);
}

export function buildBurnSource(target: HTMLElement, maskOptions: ResolvedBurnMaskOptions): BurnSource {
  const rect = target.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const stepPx = Math.max(1, Math.round(maskOptions.stepPx));
  const canSamplePixels = isImageElement(target) || isCanvasElement(target);
  const shouldSamplePixels =
    canSamplePixels && (maskOptions.source === "auto" || maskOptions.source === "alpha" || maskOptions.source === "luminance");

  if (maskOptions.source === "text") {
    const textSource = buildTextSource(target, width, height, maskOptions);

    if (textSource && textSource.emitters.length > 0) {
      return applyMaskOffset(textSource, maskOptions);
    }
  }

  if (shouldSamplePixels) {
    const imageSource = buildImageSource(target, width, height, maskOptions);

    if (imageSource && imageSource.emitters.length > 0) {
      return applyMaskOffset(imageSource, maskOptions);
    }
  }

  return applyMaskOffset(buildBoundsSource(width, height, stepPx), maskOptions);
}
