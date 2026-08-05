import {
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import { EASE_OUT_EXPO } from "../lib/callUi";

export interface LayoutMorphOptions {
  activeKey: string | number;
  durationMs: number;
  followers?: RefObject<HTMLElement | null>[];
  onStart?: () => void;
  onFrame?: () => void;
  onFinish?: () => void;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isValidRect(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0;
}

/**
 * FLIP-morphs a primary element (and optional followers) when `activeKey`
 * changes. CallScreen owns the self-view morph: local camera is primary,
 * Flip overlay is a follower — one shared transform / timeline.
 */
export function useLayoutMorph(
  primaryRef: RefObject<HTMLElement | null>,
  options: LayoutMorphOptions,
): void {
  const { activeKey, durationMs, followers, onStart, onFrame, onFinish } =
    options;

  const onStartRef = useRef(onStart);
  const onFrameRef = useRef(onFrame);
  const onFinishRef = useRef(onFinish);
  onStartRef.current = onStart;
  onFrameRef.current = onFrame;
  onFinishRef.current = onFinish;

  const followersRef = useRef(followers);
  followersRef.current = followers;

  const previousKeyRef = useRef(activeKey);
  const previousRectRef = useRef<DOMRect | null>(null);
  const generationRef = useRef(0);
  const animationsRef = useRef<Animation[]>([]);
  const rafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const primary = primaryRef.current;
    if (!primary) {
      previousRectRef.current = null;
      return;
    }

    const currentRect = primary.getBoundingClientRect();
    const previousRect = previousRectRef.current;
    const keyChanged = previousKeyRef.current !== activeKey;
    previousKeyRef.current = activeKey;

    // Always store the committed primary rectangle — drag updates the next
    // morph origin without starting a mode-transition animation.
    if (isValidRect(currentRect)) {
      previousRectRef.current = currentRect;
    }

    if (!keyChanged || !previousRect || !isValidRect(currentRect)) {
      return;
    }

    const dx = previousRect.left - currentRect.left;
    const dy = previousRect.top - currentRect.top;
    const sx = previousRect.width / Math.max(currentRect.width, 1);
    const sy = previousRect.height / Math.max(currentRect.height, 1);

    if (
      Math.abs(dx) < 0.5 &&
      Math.abs(dy) < 0.5 &&
      Math.abs(sx - 1) < 0.01 &&
      Math.abs(sy - 1) < 0.01
    ) {
      return;
    }

    // Supersede any in-flight generation before starting a new one.
    const generation = ++generationRef.current;
    for (const animation of animationsRef.current) {
      animation.cancel();
    }
    animationsRef.current = [];
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    let finished = false;
    const finishOnce = () => {
      if (generationRef.current !== generation || finished) return;
      finished = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      animationsRef.current = [];
      onFinishRef.current?.();
    };

    if (prefersReducedMotion()) {
      onStartRef.current?.();
      onFrameRef.current?.();
      finishOnce();
      return;
    }

    const keyframes: Keyframe[] = [
      {
        transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
        transformOrigin: "top left",
      },
      {
        transform: "translate(0px, 0px) scale(1, 1)",
        transformOrigin: "top left",
      },
    ];
    const timing: KeyframeEffectOptions = {
      duration: durationMs,
      easing: EASE_OUT_EXPO,
      fill: "both",
    };

    const targets: HTMLElement[] = [primary];
    for (const follower of followersRef.current ?? []) {
      const node = follower.current;
      if (node) targets.push(node);
    }

    // Construct every effect/animation before starting any of them.
    const animations = targets.map(
      (el) =>
        new Animation(new KeyframeEffect(el, keyframes, timing), document.timeline),
    );
    animationsRef.current = animations;

    onStartRef.current?.();

    const startTime = document.timeline.currentTime ?? 0;
    for (const animation of animations) {
      animation.startTime = startTime;
    }

    const tick = () => {
      if (generationRef.current !== generation) return;
      onFrameRef.current?.();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    void Promise.all(animations.map((animation) => animation.finished))
      .then(() => {
        finishOnce();
      })
      .catch(() => {
        // Cancelled / superseded — do not call onFinish for this generation.
      });

    return () => {
      if (generationRef.current === generation) {
        generationRef.current += 1;
      }
      finished = true;
      for (const animation of animations) {
        animation.cancel();
      }
      if (animationsRef.current === animations) {
        animationsRef.current = [];
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [activeKey, durationMs, primaryRef]);
}
