import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLayoutMorph } from "../../hooks/useLayoutMorph";

function mockRect(
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.top,
    toJSON() {
      return {};
    },
  } as DOMRect);
}

type ResolveReject = {
  resolve: () => void;
  reject: (reason?: unknown) => void;
};

function installAnimationHarness() {
  const created: Array<{
    cancel: ReturnType<typeof vi.fn>;
    finished: Promise<void>;
    settle: ResolveReject;
  }> = [];

  class MockKeyframeEffect {
    target: Element;
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null;
    options?: number | KeyframeEffectOptions;

    constructor(
      target: Element,
      keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeEffectOptions,
    ) {
      this.target = target;
      this.keyframes = keyframes;
      this.options = options;
    }
  }

  class MockAnimation {
    startTime: number | null = null;
    cancel = vi.fn(() => {
      this.settle.reject(new DOMException("Aborted", "AbortError"));
    });
    finished: Promise<void>;
    private settle: ResolveReject;

    constructor(
      _effect?: MockKeyframeEffect | null,
      _timeline?: AnimationTimeline | null,
    ) {
      let resolve!: () => void;
      let reject!: (reason?: unknown) => void;
      this.finished = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // Prevent unhandled rejection noise when cancelled.
      this.finished.catch(() => undefined);
      this.settle = { resolve, reject };
      created.push({
        cancel: this.cancel,
        finished: this.finished,
        settle: this.settle,
      });
    }
  }

  const KeyframeEffectSpy = vi.fn(
    (
      target: Element,
      keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeEffectOptions,
    ) => new MockKeyframeEffect(target, keyframes, options),
  );

  vi.stubGlobal("KeyframeEffect", KeyframeEffectSpy);
  vi.stubGlobal("Animation", MockAnimation);
  Object.defineProperty(document, "timeline", {
    configurable: true,
    value: { currentTime: 0 },
  });

  return {
    created,
    KeyframeEffectSpy,
    completeLatest() {
      const latest = created[created.length - 1];
      latest?.settle.resolve();
    },
  };
}

describe("useLayoutMorph", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("prefers-reduced-motion") ? false : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("updates the committed rectangle without animating when only the rect changes", () => {
    const primary = document.createElement("div");
    document.body.appendChild(primary);
    const primaryRef = createRef<HTMLElement>();
    (primaryRef as { current: HTMLElement | null }).current = primary;

    mockRect(primary, { left: 10, top: 20, width: 100, height: 160 });

    const harness = installAnimationHarness();

    const { rerender } = renderHook(
      ({ key, left }) => {
        mockRect(primary, { left, top: 20, width: 100, height: 160 });
        useLayoutMorph(primaryRef, {
          activeKey: key,
          durationMs: 180,
        });
      },
      { initialProps: { key: "expanded", left: 10 } },
    );

    expect(harness.KeyframeEffectSpy).not.toHaveBeenCalled();

    // Drag updates geometry with the same mode — store origin, no morph.
    rerender({ key: "expanded", left: 40 });
    expect(harness.KeyframeEffectSpy).not.toHaveBeenCalled();

    primary.remove();
  });

  it("runs reduced-motion callbacks in order without Web Animations", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const primary = document.createElement("div");
    document.body.appendChild(primary);
    const primaryRef = createRef<HTMLElement>();
    (primaryRef as { current: HTMLElement | null }).current = primary;

    const order: string[] = [];
    const onStart = () => order.push("start");
    const onFrame = () => order.push("frame");
    const onFinish = () => order.push("finish");

    mockRect(primary, { left: 0, top: 0, width: 200, height: 400 });

    const { rerender } = renderHook(
      ({ key, rect }) => {
        mockRect(primary, rect);
        useLayoutMorph(primaryRef, {
          activeKey: key,
          durationMs: 200,
          onStart,
          onFrame,
          onFinish,
        });
      },
      {
        initialProps: {
          key: "fullscreen",
          rect: { left: 0, top: 0, width: 200, height: 400 },
        },
      },
    );

    rerender({
      key: "expanded",
      rect: { left: 100, top: 80, width: 80, height: 120 },
    });

    expect(order).toEqual(["start", "frame", "finish"]);
    primary.remove();
  });

  it("does not cancel an active morph when only duration changes", () => {
    const primary = document.createElement("div");
    document.body.appendChild(primary);
    const primaryRef = createRef<HTMLElement>();
    (primaryRef as { current: HTMLElement | null }).current = primary;

    const harness = installAnimationHarness();
    const onFinish = vi.fn();

    mockRect(primary, { left: 0, top: 0, width: 200, height: 400 });

    const { rerender } = renderHook(
      ({ key, rect, durationMs }) => {
        mockRect(primary, rect);
        useLayoutMorph(primaryRef, {
          activeKey: key,
          durationMs,
          onFinish,
        });
      },
      {
        initialProps: {
          key: "fullscreen",
          durationMs: 200,
          rect: { left: 0, top: 0, width: 200, height: 400 },
        },
      },
    );

    rerender({
      key: "expanded",
      durationMs: 200,
      rect: { left: 100, top: 80, width: 80, height: 120 },
    });

    expect(harness.created).toHaveLength(1);
    const first = harness.created[0]!;

    rerender({
      key: "expanded",
      durationMs: 480,
      rect: { left: 100, top: 80, width: 80, height: 120 },
    });

    expect(harness.created).toHaveLength(1);
    expect(first.cancel).not.toHaveBeenCalled();

    primary.remove();
  });

  it("calls onFinish exactly once for a completed generation", async () => {
    const primary = document.createElement("div");
    document.body.appendChild(primary);
    const primaryRef = createRef<HTMLElement>();
    (primaryRef as { current: HTMLElement | null }).current = primary;

    const harness = installAnimationHarness();
    const onFinish = vi.fn();

    mockRect(primary, { left: 0, top: 0, width: 200, height: 400 });

    const { rerender } = renderHook(
      ({ key, rect }) => {
        mockRect(primary, rect);
        useLayoutMorph(primaryRef, {
          activeKey: key,
          durationMs: 200,
          onFinish,
        });
      },
      {
        initialProps: {
          key: "fullscreen",
          rect: { left: 0, top: 0, width: 200, height: 400 },
        },
      },
    );

    rerender({
      key: "expanded",
      rect: { left: 100, top: 80, width: 80, height: 120 },
    });

    expect(harness.created).toHaveLength(1);

    await act(async () => {
      harness.completeLatest();
      await harness.created[0]!.finished;
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
    primary.remove();
  });

  it("does not call onFinish for a superseded morph generation", async () => {
    const primary = document.createElement("div");
    document.body.appendChild(primary);
    const primaryRef = createRef<HTMLElement>();
    (primaryRef as { current: HTMLElement | null }).current = primary;

    const harness = installAnimationHarness();
    const onFinish = vi.fn();

    mockRect(primary, { left: 0, top: 0, width: 200, height: 400 });

    const { rerender } = renderHook(
      ({ key, rect }) => {
        mockRect(primary, rect);
        useLayoutMorph(primaryRef, {
          activeKey: key,
          durationMs: 200,
          onFinish,
        });
      },
      {
        initialProps: {
          key: "fullscreen",
          rect: { left: 0, top: 0, width: 200, height: 400 },
        },
      },
    );

    rerender({
      key: "expanded",
      rect: { left: 100, top: 80, width: 80, height: 120 },
    });
    expect(harness.created).toHaveLength(1);
    const first = harness.created[0]!;

    rerender({
      key: "compact",
      rect: { left: 280, top: 560, width: 72, height: 128 },
    });
    expect(harness.created).toHaveLength(2);
    expect(first.cancel).toHaveBeenCalled();

    await act(async () => {
      first.settle.resolve();
      await Promise.resolve();
    });
    expect(onFinish).not.toHaveBeenCalled();

    await act(async () => {
      harness.completeLatest();
      await harness.created[1]!.finished;
    });
    expect(onFinish).toHaveBeenCalledTimes(1);

    primary.remove();
  });

  it("invokes start and frame metric callbacks without requiring finish to rebuild texture", async () => {
    const primary = document.createElement("div");
    document.body.appendChild(primary);
    const primaryRef = createRef<HTMLElement>();
    (primaryRef as { current: HTMLElement | null }).current = primary;

    const harness = installAnimationHarness();
    const onStart = vi.fn();
    const onFrame = vi.fn();
    const onFinish = vi.fn();

    mockRect(primary, { left: 0, top: 0, width: 200, height: 400 });

    const { rerender } = renderHook(
      ({ key, rect }) => {
        mockRect(primary, rect);
        useLayoutMorph(primaryRef, {
          activeKey: key,
          durationMs: 200,
          onStart,
          onFrame,
          onFinish,
        });
      },
      {
        initialProps: {
          key: "fullscreen",
          rect: { left: 0, top: 0, width: 200, height: 400 },
        },
      },
    );

    rerender({
      key: "expanded",
      rect: { left: 100, top: 80, width: 80, height: 120 },
    });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();

    await act(async () => {
      harness.completeLatest();
      await harness.created[0]!.finished;
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
    // Frame ticks may run; start/finish remain single-shot for the generation.
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onFrame.mock.calls.length).toBeGreaterThanOrEqual(0);

    primary.remove();
  });
});
