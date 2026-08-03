import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLiquidGlassController,
  getFullLiquidGlassOptionConstraints,
  LIQUID_GL_PACKAGE_VERSION,
  LIQUID_GL_SNAPSHOT,
  LIQUID_GL_TARGET,
} from "../../lib/liquidGlass";

const liquidGLMock = vi.fn();

vi.mock("liquid-gl", () => ({
  default: (...args: unknown[]) => liquidGLMock(...args),
}));

describe("liquidGlass", () => {
  beforeEach(() => {
    liquidGLMock.mockReset();
    document.body.innerHTML = `
      <div id="liquid-gl-snapshot"></div>
      <button class="liquidGL"><span class="content">A</span></button>
      <button class="liquidGL"><span class="content">B</span></button>
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
  });

  it("exposes full-mode constraints required by the PRD", () => {
    const options = getFullLiquidGlassOptionConstraints();
    expect(options.snapshot).toBe(LIQUID_GL_SNAPSHOT);
    expect(options.target).toBe(LIQUID_GL_TARGET);
    expect(options.refraction).toBe(0.018);
    expect(options.aberration).toBe(0.004);
    expect(options.bevelDepth).toBe(0.085);
    expect(options.bevelWidth).toBe(0.17);
    expect(options.magnify).toBe(1.012);
    expect(options.frost).toBe(0.25);
    expect(options.specular).toBe(true);
    expect(LIQUID_GL_PACKAGE_VERSION).toBe("2.0.1");
  });

  it("calls liquidGL with snapshot/target and activates on init", () => {
    liquidGLMock.mockImplementation((options: { on?: { init?: (i: unknown) => void } }) => {
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
    expect(options.refraction).toBe(0.018);
    expect(options.aberration).toBe(0.004);
    expect(options.bevelDepth).toBe(0.085);
    expect(options.bevelWidth).toBe(0.17);
    expect(options.magnify).toBe(1.012);
    expect(options.frost).toBe(0.25);
    expect(options.specular).toBe(true);
    expect(controller.mode).toBe("active");
    expect(document.documentElement.dataset.liquidGl).toBe("active");
    controller.destroy();
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

    liquidGLMock.mockImplementation((options: { on?: { init?: (i: unknown) => void } }) => {
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
    liquidGLMock.mockImplementation((options: { on?: { init?: (i: unknown) => void } }) => {
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
});
