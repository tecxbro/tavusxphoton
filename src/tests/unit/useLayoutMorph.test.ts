import { renderHook } from "@testing-library/react";
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
  });

  it("updates the committed rectangle without animating when only the rect changes", () => {
    const primary = document.createElement("div");
    document.body.appendChild(primary);
    const primaryRef = createRef<HTMLElement>();
    (primaryRef as { current: HTMLElement | null }).current = primary;

    mockRect(primary, { left: 10, top: 20, width: 100, height: 160 });

    const KeyframeEffectSpy = vi.fn(
      (...args: ConstructorParameters<typeof KeyframeEffect>) =>
        new KeyframeEffect(...args),
    );
    vi.stubGlobal("KeyframeEffect", KeyframeEffectSpy);

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

    expect(KeyframeEffectSpy).not.toHaveBeenCalled();

    // Drag updates geometry with the same mode — store origin, no morph.
    rerender({ key: "expanded", left: 40 });
    expect(KeyframeEffectSpy).not.toHaveBeenCalled();

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
});
