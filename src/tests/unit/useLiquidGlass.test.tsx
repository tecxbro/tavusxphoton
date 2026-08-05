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

  it("syncs video layout immediately on camera off without waiting for recapture", () => {
    vi.useFakeTimers();
    mockActiveRenderer();
    const { rerender, result } = renderHook((input: HookInput) =>
      useLiquidGlass(input),
    { initialProps: baseInput({ backgroundReady: true }) });

    const sync = vi.fn();
    const renderer = window.__liquidGLRenderer__;
    expect(renderer).toBeTruthy();
    renderer!._syncDynamicVideos = sync;

    rerender(baseInput({ backgroundReady: true, videoEnabled: false }));

    // useLayoutEffect sync runs synchronously on the toggle — before the
    // debounced placeholder recapture.
    expect(sync).toHaveBeenCalledTimes(1);
    expect(renderer?.captureSnapshot).not.toHaveBeenCalled();
    expect(typeof result.current.syncVideoLayout).toBe("function");

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(renderer?.captureSnapshot).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("syncs video layout on phase and layoutMode commits", () => {
    mockActiveRenderer();
    const { rerender } = renderHook((input: HookInput) =>
      useLiquidGlass(input),
    { initialProps: baseInput({ backgroundReady: true }) });

    const sync = vi.fn();
    const renderer = window.__liquidGLRenderer__;
    expect(renderer).toBeTruthy();
    renderer!._syncDynamicVideos = sync;

    rerender(
      baseInput({
        backgroundReady: true,
        phase: "joining",
        layoutMode: "compact",
      }),
    );

    // phase + layoutMode both changed in one commit → one layout effect pass
    expect(sync).toHaveBeenCalledTimes(1);
    expect(renderer?.captureSnapshot).not.toHaveBeenCalled();
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
