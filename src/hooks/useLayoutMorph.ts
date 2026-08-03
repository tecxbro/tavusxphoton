import { useLayoutEffect, useRef, type RefObject } from "react";
import { EASE_OUT_EXPO, JOIN_MORPH_MS } from "../lib/callState";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * FLIP-morphs an element when `activeKey` changes.
 * Useful for the fullscreen → expanded local-camera transition.
 */
export function useLayoutMorph(
  nodeRef: RefObject<HTMLElement | null>,
  activeKey: string,
  durationMs = JOIN_MORPH_MS,
): void {
  const previousKey = useRef(activeKey);
  const previousRect = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const lastRect = node.getBoundingClientRect();
    const firstRect = previousRect.current;
    const keyChanged = previousKey.current !== activeKey;
    previousKey.current = activeKey;
    previousRect.current = lastRect;

    if (!keyChanged || !firstRect || prefersReducedMotion()) return;

    const dx = firstRect.left - lastRect.left;
    const dy = firstRect.top - lastRect.top;
    const sx = firstRect.width / Math.max(lastRect.width, 1);
    const sy = firstRect.height / Math.max(lastRect.height, 1);

    if (
      Math.abs(dx) < 0.5 &&
      Math.abs(dy) < 0.5 &&
      Math.abs(sx - 1) < 0.01 &&
      Math.abs(sy - 1) < 0.01
    ) {
      return;
    }

    const animation = node.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          transformOrigin: "top left",
        },
        {
          transform: "translate(0, 0) scale(1, 1)",
          transformOrigin: "top left",
        },
      ],
      {
        duration: durationMs,
        easing: EASE_OUT_EXPO,
        fill: "both",
      },
    );

    return () => {
      animation.cancel();
    };
  }, [activeKey, durationMs, nodeRef]);
}
