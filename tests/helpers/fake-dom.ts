import { vi } from "vitest";

export function createRectangle(left: number, top: number, width: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({})
  } as DOMRect;
}

export class FakeCanvasRenderingContext {
  public fillStyle: unknown = "";
  public font = "";
  public globalAlpha = 1;
  public globalCompositeOperation: GlobalCompositeOperation = "source-over";

  public clearRect = vi.fn();
  public drawImage = vi.fn<(sprite: CanvasImageSource, xPosition: number, yPosition: number, width: number, height: number) => void>();
  public fillRect = vi.fn();
  public setTransform = vi.fn();
  public fillText = vi.fn();
  public measureText = () => ({ actualBoundingBoxAscent: 24, actualBoundingBoxDescent: 6 });
  public getImageData = vi.fn((_left: number, _top: number, width: number, height: number) => {
    const data = new Uint8ClampedArray(width * height * 4);

    // A nonuniform mask with transparent, dim, and bright regions exercises
    // thresholding, emitter positions, and luminance/alpha weights.
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const offset = (row * width + column) * 4;
        const brightness = column < width / 2 ? 220 : 40;
        data.set([brightness, brightness, brightness, row < height * 0.75 ? 255 : 0], offset);
      }
    }

    return { width, height, data } as ImageData;
  });

  public createRadialGradient(): CanvasGradient {
    return {
      addColorStop: vi.fn()
    } as unknown as CanvasGradient;
  }
}

export class FakeDocument {
  public readonly body: FakeElement;
  public defaultView: Window | null = null;
  public readonly canvases: FakeCanvasElement[] = [];

  public constructor() {
    this.body = new FakeElement(this);
  }

  public createElement(tagName: string): FakeElement {
    if (tagName === "canvas") {
      const canvas = new FakeCanvasElement(this);
      this.canvases.push(canvas);

      return canvas;
    }

    return new FakeElement(this);
  }

  public createTreeWalker(target: FakeElement) {
    const textNodes = [...target.textNodes];

    return { nextNode: () => textNodes.shift() ?? null };
  }

  public createRange() {
    let textNode: FakeText;
    let startIndex = 0;
    let endIndex = 0;

    return {
      setStart: (node: FakeText, index: number) => { textNode = node; startIndex = index; },
      setEnd: (_node: FakeText, index: number) => { endIndex = index; },
      getClientRects: () => {
        const rectangle = textNode.parentElement.rectangle;
        const characterWidth = rectangle.width / textNode.data.length;

        return [createRectangle(rectangle.left + startIndex * characterWidth, rectangle.top, (endIndex - startIndex) * characterWidth, rectangle.height)];
      },
      detach: () => {}
    };
  }
}

export class FakeText {
  public constructor(public data: string, public parentElement: FakeElement) {}
}

export class FakeElement {
  public readonly children: FakeElement[] = [];
  public readonly ownerDocument: FakeDocument;
  public className = "";
  public parentElement: FakeElement | null = null;
  public rectangle = createRectangle(0, 0, 0, 0);
  public readonly style = {} as CSSStyleDeclaration;
  public readonly textNodes: FakeText[] = [];

  public constructor(ownerDocument: FakeDocument) {
    this.ownerDocument = ownerDocument;
  }

  public appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    child.parentElement = this;

    return child;
  }

  public getBoundingClientRect(): DOMRect {
    return this.rectangle;
  }

  public remove(): void {
    if (!this.parentElement) {
      return;
    }

    const childIndex = this.parentElement.children.indexOf(this);

    if (childIndex >= 0) {
      this.parentElement.children.splice(childIndex, 1);
    }

    this.parentElement = null;
  }
}

export class FakeCanvasElement extends FakeElement {
  public readonly context = new FakeCanvasRenderingContext();
  public height = 0;
  public width = 0;

  public getContext(): CanvasRenderingContext2D {
    return this.context as unknown as CanvasRenderingContext2D;
  }
}

export class FakeImageElement extends FakeElement {
  public naturalWidth = 120;
  public naturalHeight = 60;
}

export function installFakeDom() {
  const fakeDocument = new FakeDocument();
  const animationFrameCallbacks: FrameRequestCallback[] = [];
  const windowAddEventListener = vi.fn();
  const windowCancelAnimationFrame = vi.fn();
  const windowRemoveEventListener = vi.fn();
  const windowRequestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    animationFrameCallbacks.push(callback);

    return animationFrameCallbacks.length;
  });
  const windowSetTimeout = vi.fn((callback: TimerHandler) => {
    if (typeof callback === "function") {
      callback();
    }

    return 0;
  });
  const visualViewportAddEventListener = vi.fn();
  const visualViewportRemoveEventListener = vi.fn();
  const fakeWindow = {
    addEventListener: windowAddEventListener,
    cancelAnimationFrame: windowCancelAnimationFrame,
    devicePixelRatio: 1,
    removeEventListener: windowRemoveEventListener,
    requestAnimationFrame: windowRequestAnimationFrame,
    setTimeout: windowSetTimeout,
    visualViewport: {
      addEventListener: visualViewportAddEventListener,
      removeEventListener: visualViewportRemoveEventListener
    }
  } as unknown as Window;

  fakeDocument.defaultView = fakeWindow;
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("HTMLCanvasElement", FakeCanvasElement);
  vi.stubGlobal("HTMLImageElement", FakeImageElement);
  vi.stubGlobal("Text", FakeText);
  vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
  vi.stubGlobal("getComputedStyle", (element: FakeElement) => ({
    display: "block",
    visibility: "visible",
    opacity: element.style.opacity || "1",
    fontSize: `${element.rectangle.height}px`,
    font: `${element.rectangle.height}px sans-serif`,
    fontFamily: "sans-serif",
    fontStyle: "normal",
    fontVariant: "normal",
    fontWeight: "400",
    fontStretch: "normal",
    letterSpacing: "0px",
    wordSpacing: "0px",
    direction: "ltr",
    textTransform: "none"
  }));

  return {
    fakeDocument,
    fakeWindow,
    runNextAnimationFrame: (timeStamp: number) => {
      const callback = animationFrameCallbacks.shift();

      if (!callback) {
        throw new Error("Expected an animation frame callback.");
      }

      callback(timeStamp);
    },
    visualViewportAddEventListener,
    visualViewportRemoveEventListener,
    windowAddEventListener,
    windowRemoveEventListener
  };
}
