import { afterEach, describe, expect, it, vi } from "vitest";
import { burn } from "../src/core/effect";

function createRectangle(left: number, top: number, width: number, height: number): DOMRect {
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

class FakeCanvasRenderingContext {
  public fillStyle: unknown = "";
  public globalAlpha = 1;
  public globalCompositeOperation: GlobalCompositeOperation = "source-over";

  public clearRect = vi.fn();
  public drawImage = vi.fn();
  public fillRect = vi.fn();
  public setTransform = vi.fn();

  public createRadialGradient(): CanvasGradient {
    return {
      addColorStop: vi.fn()
    } as unknown as CanvasGradient;
  }
}

class FakeDocument {
  public readonly body: FakeElement;
  public defaultView: Window | null = null;

  public constructor() {
    this.body = new FakeElement(this);
  }

  public createElement(tagName: string): FakeElement {
    if (tagName === "canvas") {
      return new FakeCanvasElement(this);
    }

    return new FakeElement(this);
  }
}

class FakeElement {
  public readonly children: FakeElement[] = [];
  public readonly ownerDocument: FakeDocument;
  public className = "";
  public parentElement: FakeElement | null = null;
  public rectangle = createRectangle(0, 0, 0, 0);
  public readonly style = {} as CSSStyleDeclaration;

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

class FakeCanvasElement extends FakeElement {
  public height = 0;
  public width = 0;

  public getContext(): CanvasRenderingContext2D {
    return new FakeCanvasRenderingContext() as unknown as CanvasRenderingContext2D;
  }
}

class FakeImageElement extends FakeElement {}

function installFakeDom() {
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

describe("BurnInEffect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the canvas fixed to the viewport instead of expanding document overflow", () => {
    const {
      fakeDocument,
      visualViewportAddEventListener,
      visualViewportRemoveEventListener,
      windowAddEventListener,
      windowRemoveEventListener
    } = installFakeDom();
    const target = new FakeElement(fakeDocument);

    target.rectangle = createRectangle(24, 30, 100, 80);

    const controller = burn(target as unknown as HTMLElement, {
      canvas: {
        pixelRatio: 1
      },
      fire: {
        enabled: false
      },
      mask: {
        padding: {
          bottom: 0,
          top: 0,
          x: 0
        },
        source: "bounds"
      },
      smoke: {
        enabled: false
      },
      timing: {
        delayMs: 1000
      }
    });

    const canvas = fakeDocument.body.children[0] as FakeCanvasElement;

    expect(canvas).toBeInstanceOf(FakeCanvasElement);
    expect(canvas.style.position).toBe("fixed");
    expect(canvas.style.left).toBe("24px");
    expect(canvas.style.top).toBe("30px");
    expect(canvas.style.width).toBe("100px");
    expect(canvas.style.height).toBe("80px");
    expect(windowAddEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });
    expect(visualViewportAddEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });

    const scrollListener = windowAddEventListener.mock.calls.find(([eventName]) => eventName === "scroll")?.[1] as () => void;
    target.rectangle = createRectangle(12, 14, 100, 80);
    scrollListener();

    expect(canvas.style.left).toBe("12px");
    expect(canvas.style.top).toBe("14px");

    controller.cancel();

    expect(fakeDocument.body.children).toHaveLength(0);
    expect(windowRemoveEventListener).toHaveBeenCalledWith("scroll", scrollListener);
    expect(visualViewportRemoveEventListener).toHaveBeenCalledWith("scroll", scrollListener);
  });

  it("expands the fixed canvas before large particles hit its edges", () => {
    const { fakeDocument, runNextAnimationFrame } = installFakeDom();
    const target = new FakeElement(fakeDocument);

    target.rectangle = createRectangle(50, 60, 100, 80);

    const controller = burn(target as unknown as HTMLElement, {
      canvas: {
        pixelRatio: 1
      },
      fire: {
        enabled: false
      },
      mask: {
        padding: {
          bottom: 0,
          top: 0,
          x: 0
        },
        source: "bounds",
        stepPx: 100
      },
      seed: "particle-bounds",
      smoke: {
        enabled: true,
        expansion: 0,
        intensity: 1,
        lift: 0,
        maxParticles: 1,
        particleLife: 20,
        particlesPerPixel: 0.001,
        particleSize: 200,
        spread: 0,
        turbulence: 0
      },
      timing: {
        delayMs: 0,
        igniteMs: 1,
        smokeMs: 1000
      }
    });

    const canvas = fakeDocument.body.children[0] as FakeCanvasElement;
    const initialLeft = Number.parseFloat(canvas.style.left);
    const initialTop = Number.parseFloat(canvas.style.top);
    const initialWidth = Number.parseFloat(canvas.style.width);
    const initialHeight = Number.parseFloat(canvas.style.height);

    runNextAnimationFrame(0);
    runNextAnimationFrame(10);

    expect(Number.parseFloat(canvas.style.left)).toBeLessThan(initialLeft);
    expect(Number.parseFloat(canvas.style.top)).toBeLessThan(initialTop);
    expect(Number.parseFloat(canvas.style.width)).toBeGreaterThan(initialWidth);
    expect(Number.parseFloat(canvas.style.height)).toBeGreaterThan(initialHeight);

    controller.cancel();
  });
});
