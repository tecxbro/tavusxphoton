import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from "react";
import {
  createLiquidGlassController,
  type LiquidGlassController,
  type LiquidGlassMode,
} from "../lib/liquidGlass";

const SCROLL_RECAPTURE_MIN_MS = 96;
const SCROLL_IDLE_RECAPTURE_MS = 140;

export interface UseHomeLiquidGlassInput {
  /** Directory scroll scroller inside `#liquid-gl-snapshot`. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Skip scroll captures while the menu FLIP morph is running. */
  menuMorphing: boolean;
}

export interface UseHomeLiquidGlassResult {
  mode: LiquidGlassMode;
  refreshImmediate: () => void;
  recapture: () => void;
  recaptureImmediate: () => void;
  /** Tear down the Home renderer before a call route mounts. */
  destroy: () => void;
}

/**
 * Home-owned LiquidGL lifecycle. Creates one controller for Edit / menu /
 * Hire me targets and destroys it on unmount (or explicit `destroy()` before
 * navigate) so the call renderer never shares a canvas. Does not reuse the
 * call-phase `useLiquidGlass` hook.
 */
export function useHomeLiquidGlass({
  scrollRef,
  menuMorphing,
}: UseHomeLiquidGlassInput): UseHomeLiquidGlassResult {
  const controllerRef = useRef<LiquidGlassController | null>(null);
  const menuMorphingRef = useRef(menuMorphing);
  menuMorphingRef.current = menuMorphing;

  const destroy = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.destroy();
    controllerRef.current = null;
  }, []);

  const refreshImmediate = useCallback(() => {
    controllerRef.current?.refreshImmediate();
  }, []);

  const recapture = useCallback(() => {
    controllerRef.current?.recapture();
  }, []);

  const recaptureImmediate = useCallback(() => {
    controllerRef.current?.recaptureImmediate();
  }, []);

  useEffect(() => {
    const controller = createLiquidGlassController();
    controllerRef.current = controller;

    const settle = window.setTimeout(() => {
      controller.recapture();
    }, 120);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        controller.refresh();
        controller.recapture();
      }
    };
    const onOrientation = () => {
      controller.refresh();
      controller.recapture();
    };
    const onResize = () => controller.refresh();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("orientationchange", onOrientation);
    window.visualViewport?.addEventListener("resize", onResize);
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(settle);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("orientationchange", onOrientation);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("resize", onResize);
      // Idempotent with explicit destroy() before navigate.
      if (controllerRef.current === controller) {
        controller.destroy();
        controllerRef.current = null;
      }
    };
  }, []);

  // Scroll: rAF-coalesced immediate recapture (≤1 / 96ms), skip while morphing,
  // debounced settled recapture after 140ms idle. No React state on scroll.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    let rafId: number | null = null;
    let idleTimer: number | null = null;
    let lastImmediateAt = 0;

    const clearIdle = () => {
      if (idleTimer != null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const runScrollWork = () => {
      rafId = null;
      if (menuMorphingRef.current) return;

      const now = performance.now();
      if (now - lastImmediateAt >= SCROLL_RECAPTURE_MIN_MS) {
        lastImmediateAt = now;
        controllerRef.current?.recaptureImmediate();
      }

      clearIdle();
      idleTimer = window.setTimeout(() => {
        idleTimer = null;
        if (menuMorphingRef.current) return;
        controllerRef.current?.recapture();
      }, SCROLL_IDLE_RECAPTURE_MS);
    };

    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(runScrollWork);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
      clearIdle();
    };
  }, [scrollRef]);

  return {
    mode: controllerRef.current?.mode ?? "initializing",
    refreshImmediate,
    recapture,
    recaptureImmediate,
    destroy,
  };
}
