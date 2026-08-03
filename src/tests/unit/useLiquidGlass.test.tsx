import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiquidGlass } from "../../hooks/useLiquidGlass";
import type { CallPhase } from "../../lib/callState";
import type { LocalCameraMode } from "../../components/LocalCameraSurface";

const liquidGLMock = vi.fn();

vi.mock("liquid-gl", () => ({
  default: (...args: unknown[]) => liquidGLMock(...args),
}));

interface MockOptions {
  on?: { init?: (i: unknown) => void };
}

interface HookInput {
  enabled: boolean;
  backgroundReady: boolean;
  phase: CallPhase;
  controlsVisible: boolean;
  layoutMode: LocalCameraMode;
  videoEnabled: boolean;
}

function baseInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    enabled: true,
    backgroundReady: false,
    phase: "ringing",
    controlsVisible: true,
    layoutMode: "fullscreen",
    videoEnabled: true,
    ...overrides,
  };
}

function mockActiveRenderer() {
  liquidGLMock.mockImplementation((options: MockOptions) => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".liquidGL"),
    );
    const instances = els.map((el) => ({ el, updateMetrics: vi.fn() }));
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

describe("useLiquidGlass", () => {
  beforeEach(() => {
    liquidGLMock.mockReset();
    document.body.innerHTML = `
      <main class="call-screen">
        <div id="liquid-gl-snapshot" class="call-visual-stage"></div>
        <div class="liquid-canvas-layer" aria-hidden="true"></div>
        <button class="liquidGL"><span class="content">A</span></button>
      </main>
    `;
    delete window.__liquidGLRenderer__;
    delete window.__miniPhoLiquidGlassDebug__;

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      ((type: string) => {
        if (
          type === "webgl" ||
          type === "webgl2" ||
          type === "experimental-webgl"
        ) {
          return {} as WebGLRenderingContext;
        }
        return null;
      }) as typeof HTMLCanvasElement.prototype.getContext,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.liquidChrome;
    delete document.documentElement.dataset.liquidGl;
  });

  it("delays LiquidGL initialization until the first real visual content", () => {
    mockActiveRenderer();
    const { result, rerender } = renderHook((input: HookInput) =>
      useLiquidGlass(input),
    { initialProps: baseInput() });

    expect(liquidGLMock).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("fallback");

    rerender(baseInput({ backgroundReady: true }));
    expect(liquidGLMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the glass canvas visibility in sync with the chrome", () => {
    mockActiveRenderer();
    const { rerender } = renderHook((input: HookInput) =>
      useLiquidGlass(input),
    { initialProps: baseInput({ backgroundReady: true }) });

    expect(document.documentElement.dataset.liquidChrome).toBe("visible");
    rerender(
      baseInput({ backgroundReady: true, controlsVisible: false }),
    );
    expect(document.documentElement.dataset.liquidChrome).toBe("hidden");
  });

  it("recaptures the background on camera toggles without a new renderer", async () => {
    vi.useFakeTimers();
    mockActiveRenderer();
    const { rerender } = renderHook((input: HookInput) =>
      useLiquidGlass(input),
    { initialProps: baseInput({ backgroundReady: true }) });

    const renderer = window.__liquidGLRenderer__;
    expect(renderer).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(renderer?.captureSnapshot).toHaveBeenCalledTimes(1);

    rerender(baseInput({ backgroundReady: true, videoEnabled: false }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(renderer?.captureSnapshot).toHaveBeenCalledTimes(2);
    expect(liquidGLMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("erases the stale camera frame from the glass texture immediately on camera off", () => {
    vi.useFakeTimers();
    mockActiveRenderer();
    const { rerender } = renderHook((input: HookInput) =>
      useLiquidGlass(input),
    { initialProps: baseInput({ backgroundReady: true }) });

    const stage = document.querySelector<HTMLElement>("#liquid-gl-snapshot");
    expect(stage).toBeTruthy();
    const off = document.createElement("video");
    off.setAttribute("data-liquid-ignore", "");
    stage!.append(off);
    Object.defineProperty(off, "readyState", { value: 4, configurable: true });

    const stageRect = {
      left: 0,
      top: 0,
      right: 390,
      bottom: 844,
      width: 390,
      height: 844,
    } as DOMRect;
    vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue(stageRect);
    vi.spyOn(off, "getBoundingClientRect").mockReturnValue({
      left: 250,
      top: 600,
      right: 370,
      bottom: 800,
      width: 120,
      height: 200,
    } as DOMRect);

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      ((type: string) => {
        if (type === "2d") {
          return {
            drawImage: vi.fn(),
          } as unknown as CanvasRenderingContext2D;
        }
        if (
          type === "webgl" ||
          type === "webgl2" ||
          type === "experimental-webgl"
        ) {
          return {} as WebGLRenderingContext;
        }
        return null;
      }) as typeof HTMLCanvasElement.prototype.getContext,
    );

    const texSubImage2D = vi.fn();
    const renderer = window.__liquidGLRenderer__;
    expect(renderer).toBeTruthy();
    renderer!.gl = {
      bindTexture: vi.fn(),
      texSubImage2D,
      TEXTURE_2D: 0x0de1,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
    } as unknown as WebGLRenderingContext;
    renderer!.texture = {} as WebGLTexture;
    const staticSnapshotCanvas = document.createElement("canvas");
    staticSnapshotCanvas.width = 780;
    staticSnapshotCanvas.height = 1688;
    renderer!.staticSnapshotCanvas = staticSnapshotCanvas;
    renderer!.snapshotTarget = stage!;
    renderer!.scaleFactor = 2;

    rerender(baseInput({ backgroundReady: true, videoEnabled: false }));

    // The stale frame is erased synchronously on the toggle — before the
    // debounced placeholder recapture runs.
    expect(texSubImage2D).toHaveBeenCalledTimes(1);
    expect(renderer?.captureSnapshot).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(renderer?.captureSnapshot).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("removes the canvas and renderer when the call screen unmounts", () => {
    mockActiveRenderer();
    const { unmount } = renderHook((input: HookInput) =>
      useLiquidGlass(input),
    { initialProps: baseInput({ backgroundReady: true }) });

    expect(
      document.querySelectorAll("canvas[data-liquid-ignore]").length,
    ).toBe(1);
    unmount();
    expect(window.__liquidGLRenderer__).toBeUndefined();
    expect(
      document.querySelectorAll("canvas[data-liquid-ignore]").length,
    ).toBe(0);
  });
});
