import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLiquidGlassController,
  getFullLiquidGlassOptionConstraints,
  LIQUID_GL_CANVAS_LAYER,
  LIQUID_GL_PACKAGE_VERSION,
  LIQUID_GL_SNAPSHOT,
  LIQUID_GL_TARGET,
} from "../../lib/liquidGlass";

const liquidGLMock = vi.fn();

vi.mock("liquid-gl", () => ({
  default: (...args: unknown[]) => liquidGLMock(...args),
}));

interface MockOptions {
  on?: { init?: (i: unknown) => void };
}

/** Simulate liquid-gl@2.0.1 lens side effects on every .liquidGL target. */
function simulateLensSideEffects(instances: Array<{ el: HTMLElement }>) {
  for (const instance of instances) {
    instance.el.style.pointerEvents = "none";
    instance.el.style.opacity = "0";
  }
}

function mockActiveRenderer() {
  liquidGLMock.mockImplementation((options: MockOptions) => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(LIQUID_GL_TARGET),
    );
    const instances = els.map((el) => ({ el, updateMetrics: vi.fn() }));
    simulateLensSideEffects(instances);
    const canvas = document.createElement("canvas");
    canvas.setAttribute("data-liquid-ignore", "");
    document.body.appendChild(canvas);
    window.__liquidGLRenderer__ = {
      canvas,
      lenses: [],
      captureSnapshot: vi.fn(),
    };
    options.on?.init?.(instances[0]);
    return instances;
  });
}

describe("liquidGlass", () => {
  beforeEach(() => {
    liquidGLMock.mockReset();
    document.body.innerHTML = `
      <main class="call-screen">
        <div id="liquid-gl-snapshot" class="call-visual-stage"></div>
        <div class="liquid-canvas-layer" aria-hidden="true"></div>
        <button class="liquidGL"><span class="content">A</span></button>
        <button class="liquidGL"><span class="content">B</span></button>
      </main>
    `;
    document.documentElement.dataset.liquidGl = "";
    delete window.__liquidGLRenderer__;
    delete window.__miniPhoForceGlassFallback__;
    delete window.__miniPhoLiquidGlassDebug__;

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      ((type: string) => {
        if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
          return {} as WebGLRenderingContext;
        }
        return null;
      }) as typeof HTMLCanvasElement.prototype.getContext,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.liquidChrome;
  });

  it("exposes full-mode constraints required by the PRD", () => {
    const options = getFullLiquidGlassOptionConstraints();
    expect(options.snapshot).toBe(LIQUID_GL_SNAPSHOT);
    expect(options.target).toBe(LIQUID_GL_TARGET);
    expect(options.refraction).toBe(0.024);
    expect(options.aberration).toBe(0.005);
    expect(options.bevelDepth).toBe(0.12);
    expect(options.bevelWidth).toBe(0.22);
    expect(options.magnify).toBe(1.02);
    expect(options.frost).toBe(0.16);
    expect(options.specular).toBe(true);
    expect(LIQUID_GL_PACKAGE_VERSION).toBe("2.0.1");
    expect(LIQUID_GL_CANVAS_LAYER).toBe(".liquid-canvas-layer");
  });

  it("calls liquidGL with snapshot/target and activates on init", () => {
    liquidGLMock.mockImplementation((options: MockOptions) => {
      options.on?.init?.({});
      return { updateMetrics: vi.fn() };
    });

    const controller = createLiquidGlassController();
    expect(liquidGLMock).toHaveBeenCalledTimes(1);
    const options = liquidGLMock.mock.calls[0]?.[0] as {
      snapshot: string;
      target: string;
      refraction: number;
      aberration: number;
      bevelDepth: number;
      bevelWidth: number;
      magnify: number;
      frost: number;
      specular: boolean;
    };
    expect(options.snapshot).toBe("#liquid-gl-snapshot");
    expect(options.target).toBe(".liquidGL");
    expect(options.refraction).toBe(0.024);
    expect(options.aberration).toBe(0.005);
    expect(options.bevelDepth).toBe(0.12);
    expect(options.bevelWidth).toBe(0.22);
    expect(options.magnify).toBe(1.02);
    expect(options.frost).toBe(0.16);
    expect(options.specular).toBe(true);
    expect(controller.mode).toBe("active");
    expect(document.documentElement.dataset.liquidGl).toBe("active");
    controller.destroy();
  });

  it("restores pointer events stripped by the lens constructor", () => {
    mockActiveRenderer();
    createLiquidGlassController();
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(LIQUID_GL_TARGET),
    );
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target.style.pointerEvents).not.toBe("none");
    }
  });

  it("moves the shared canvas into the call screen layer", () => {
    mockActiveRenderer();
    createLiquidGlassController();
    const layer = document.querySelector(LIQUID_GL_CANVAS_LAYER);
    const canvas = window.__liquidGLRenderer__?.canvas;
    expect(canvas).toBeTruthy();
    expect(canvas?.parentElement).toBe(layer);
    expect(canvas?.style.position).toBe("absolute");
    expect(canvas?.style.pointerEvents).toBe("none");
  });

  it("enters error/fallback when liquidGL throws", () => {
    liquidGLMock.mockImplementation(() => {
      throw new Error("boom");
    });
    const controller = createLiquidGlassController();
    expect(controller.mode === "error" || controller.mode === "fallback").toBe(
      true,
    );
    controller.destroy();
  });

  it("uses fallback when forced", () => {
    window.__miniPhoForceGlassFallback__ = true;
    const controller = createLiquidGlassController();
    expect(controller.mode).toBe("fallback");
    expect(liquidGLMock).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("falls back and restores target styles when reveal never fires", () => {
    vi.useFakeTimers();
    liquidGLMock.mockImplementation(() => {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>(LIQUID_GL_TARGET),
      );
      const instances = els.map((el) => ({ el, updateMetrics: vi.fn() }));
      simulateLensSideEffects(instances);
      return instances;
    });

    const controller = createLiquidGlassController();
    expect(controller.mode).toBe("initializing");
    vi.advanceTimersByTime(3100);
    expect(controller.mode).toBe("fallback");
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(LIQUID_GL_TARGET),
    );
    for (const target of targets) {
      expect(target.style.pointerEvents).not.toBe("none");
      expect(target.style.opacity).not.toBe("0");
    }
    controller.destroy();
    vi.useRealTimers();
  });

  it("destroys renderer canvas and cancels animation frames", () => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("data-liquid-ignore", "");
    document.body.appendChild(canvas);
    const raf = 42;
    window.__liquidGLRenderer__ = {
      _rafId: raf,
      canvas,
      lenses: [{}],
    };
    const cancelSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    liquidGLMock.mockImplementation((options: MockOptions) => {
      options.on?.init?.({});
      return { updateMetrics: vi.fn() };
    });

    const controller = createLiquidGlassController();
    controller.destroy();
    expect(cancelSpy).toHaveBeenCalled();
    expect(document.body.contains(canvas)).toBe(false);
    expect(window.__liquidGLRenderer__).toBeUndefined();
  });

  it("debounces refresh and does not remount on repeated refresh", () => {
    vi.useFakeTimers();
    const updateMetrics = vi.fn();
    liquidGLMock.mockImplementation((options: MockOptions) => {
      options.on?.init?.({});
      return { updateMetrics };
    });

    const controller = createLiquidGlassController();
    expect(liquidGLMock).toHaveBeenCalledTimes(1);
    controller.refresh();
    controller.refresh();
    controller.refresh();
    vi.advanceTimersByTime(100);
    expect(updateMetrics).toHaveBeenCalledTimes(1);
    expect(liquidGLMock).toHaveBeenCalledTimes(1);
    controller.destroy();
    vi.useRealTimers();
  });

  it("refreshImmediate updates metrics without waiting for the debounce", () => {
    vi.useFakeTimers();
    const updateMetrics = vi.fn();
    liquidGLMock.mockImplementation((options: MockOptions) => {
      options.on?.init?.({});
      return { updateMetrics };
    });

    const controller = createLiquidGlassController();
    controller.refresh();
    controller.refreshImmediate();
    expect(updateMetrics).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    // Debounced refresh was cancelled by the immediate call.
    expect(updateMetrics).toHaveBeenCalledTimes(1);
    controller.destroy();
    vi.useRealTimers();
  });

  it("recaptures the background without recreating the renderer", () => {
    vi.useFakeTimers();
    mockActiveRenderer();
    const controller = createLiquidGlassController();
    const renderer = window.__liquidGLRenderer__;
    expect(liquidGLMock).toHaveBeenCalledTimes(1);

    controller.recapture();
    controller.recapture();
    controller.recapture();
    vi.advanceTimersByTime(300);
    expect(renderer?.captureSnapshot).toHaveBeenCalledTimes(1);
    expect(liquidGLMock).toHaveBeenCalledTimes(1);
    controller.destroy();
    vi.useRealTimers();
  });

  it("forces renderer dynamic-video sync and one lens-metric pass without a snapshot", () => {
    mockActiveRenderer();
    const controller = createLiquidGlassController();

    const sync = vi.fn();
    const renderer = window.__liquidGLRenderer__;
    expect(renderer).toBeTruthy();
    renderer!._syncDynamicVideos = sync;

    const instances = liquidGLMock.mock.results[0]?.value as Array<{
      updateMetrics: ReturnType<typeof vi.fn>;
    }>;
    const updateMetrics = instances?.[0]?.updateMetrics;
    expect(updateMetrics).toBeTruthy();
    updateMetrics!.mockClear();

    controller.syncVideoLayout();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(updateMetrics).toHaveBeenCalledTimes(1);
    expect(renderer?.captureSnapshot).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("tracks chrome visibility and cleans up the canvas on destroy", () => {
    mockActiveRenderer();
    const controller = createLiquidGlassController();
    controller.setChromeVisible(false);
    expect(document.documentElement.dataset.liquidChrome).toBe("hidden");
    controller.setChromeVisible(true);
    expect(document.documentElement.dataset.liquidChrome).toBe("visible");

    controller.destroy();
    expect(document.documentElement.dataset.liquidChrome).toBeUndefined();
    expect(window.__liquidGLRenderer__).toBeUndefined();
    expect(
      document.querySelectorAll("canvas[data-liquid-ignore]").length,
    ).toBe(0);
  });

  it("keeps exactly one canvas across repeated state changes", () => {
    vi.useFakeTimers();
    mockActiveRenderer();
    const controller = createLiquidGlassController();
    for (let i = 0; i < 5; i += 1) {
      controller.refresh();
      controller.recapture();
      vi.advanceTimersByTime(300);
    }
    expect(liquidGLMock).toHaveBeenCalledTimes(1);
    expect(
      document.querySelectorAll("canvas[data-liquid-ignore]").length,
    ).toBe(1);
    controller.destroy();
    vi.useRealTimers();
  });
});
