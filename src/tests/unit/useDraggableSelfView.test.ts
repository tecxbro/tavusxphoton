import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useDraggableSelfView } from "../../hooks/useDraggableSelfView";
import { SELF_VIEW_LAYOUT, type SafeInsets } from "../../lib/callUi";

const SAFE: SafeInsets = { top: 47, right: 0, bottom: 34, left: 0 };

function mockNode(
  container: HTMLElement,
  size: { width: number; height: number },
  position: { left: number; top: number },
) {
  const node = document.createElement("div");
  Object.defineProperty(node, "offsetWidth", {
    configurable: true,
    value: size.width,
  });
  Object.defineProperty(node, "offsetHeight", {
    configurable: true,
    value: size.height,
  });
  node.getBoundingClientRect = () =>
    ({
      left: position.left,
      top: position.top,
      right: position.left + size.width,
      bottom: position.top + size.height,
      width: size.width,
      height: size.height,
      x: position.left,
      y: position.top,
      toJSON: () => ({}),
    }) as DOMRect;
  container.appendChild(node);
  return node;
}

describe("useDraggableSelfView", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 390,
        bottom: 844,
        width: 390,
        height: 844,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(container);
    sessionStorage.clear();
  });

  afterEach(() => {
    container.remove();
    sessionStorage.clear();
  });

  it("recalculates saved corners when compact mode changes while active", async () => {
    sessionStorage.setItem("mini-pho-self-view", JSON.stringify("top-right"));
    const containerRef = { current: container };

    const { result, rerender } = renderHook(
      ({ compact }) =>
        useDraggableSelfView(containerRef, {
          active: true,
          draggable: false,
          compact,
          safeInsets: SAFE,
        }),
      { initialProps: { compact: false } },
    );

    const node = mockNode(
      container,
      { width: 120, height: 255 },
      { left: 200, top: 100 },
    );
    (
      result.current as { nodeRef: { current: HTMLDivElement | null } }
    ).nodeRef.current = node;

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.position?.top).toBe(
      SELF_VIEW_LAYOUT.expandedTopOffset + SAFE.top,
    );
    expect(result.current.position?.left).toBe(
      390 - 120 - (SELF_VIEW_LAYOUT.rightInset + SAFE.right),
    );

    rerender({ compact: true });
    Object.defineProperty(node, "offsetWidth", {
      configurable: true,
      value: 90,
    });
    Object.defineProperty(node, "offsetHeight", {
      configurable: true,
      value: 196,
    });

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.position?.top).toBe(
      SELF_VIEW_LAYOUT.compactTopOffset + SAFE.top,
    );
    expect(result.current.position?.left).toBe(
      390 - 90 - (SELF_VIEW_LAYOUT.rightInset + SAFE.right),
    );
  });

  it("clamps pointer movement to safe-area boundaries", async () => {
    const containerRef = { current: container };
    const { result } = renderHook(() =>
      useDraggableSelfView(containerRef, {
        active: true,
        draggable: true,
        compact: false,
        safeInsets: SAFE,
      }),
    );

    const width = 120;
    const height = 255;
    const node = mockNode(
      container,
      { width, height },
      {
        left: SELF_VIEW_LAYOUT.leftInset + SAFE.left,
        top: SELF_VIEW_LAYOUT.expandedTopOffset + SAFE.top,
      },
    );
    result.current.nodeRef.current = node;

    const downEvent = {
      preventDefault: vi.fn(),
      currentTarget: { setPointerCapture: vi.fn() },
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    } as unknown as ReactPointerEvent<HTMLDivElement>;

    act(() => {
      result.current.onPointerDown(downEvent);
    });
    expect(result.current.dragging).toBe(true);

    const moveEvent = {
      clientX: -500,
      clientY: -500,
    } as unknown as ReactPointerEvent<HTMLDivElement>;

    act(() => {
      result.current.onPointerMove(moveEvent);
    });

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    expect(node.style.transform).toContain("translate3d");
    const match = /translate3d\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px/.exec(
      node.style.transform,
    );
    expect(match).not.toBeNull();
  });

  it("does not start dragging when draggable is false", () => {
    const containerRef = { current: container };
    const { result } = renderHook(() =>
      useDraggableSelfView(containerRef, {
        active: true,
        draggable: false,
        compact: false,
        safeInsets: SAFE,
      }),
    );

    const node = mockNode(
      container,
      { width: 120, height: 255 },
      { left: 200, top: 100 },
    );
    result.current.nodeRef.current = node;

    act(() => {
      result.current.onPointerDown({
        preventDefault: vi.fn(),
        currentTarget: { setPointerCapture: vi.fn() },
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      } as unknown as ReactPointerEvent<HTMLDivElement>);
    });

    expect(result.current.dragging).toBe(false);
  });
});
