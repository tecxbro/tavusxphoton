import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CallPhase } from "../lib/callState";
import type { LocalCameraMode } from "../components/LocalCameraSurface";
import {
  createLiquidGlassController,
  type LiquidGlassController,
  type LiquidGlassMode,
} from "../lib/liquidGlass";

export interface UseLiquidGlassInput {
  enabled: boolean;
  backgroundReady: boolean;
  phase: CallPhase;
  controlsVisible: boolean;
  layoutMode: LocalCameraMode;
  videoEnabled: boolean;
}

export interface UseLiquidGlassResult {
  mode: LiquidGlassMode;
  error: string | null;
  refresh: () => void;
  refreshImmediate: () => void;
  /** Immediate video + lens sync after a committed layout change. */
  syncVideoLayout: () => void;
}

export function useLiquidGlass({
  enabled,
  backgroundReady,
  phase,
  controlsVisible,
  layoutMode,
  videoEnabled,
}: UseLiquidGlassInput): UseLiquidGlassResult {
  const [mode, setMode] = useState<LiquidGlassMode>("initializing");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<LiquidGlassController | null>(null);
  // Strict Mode and rapid enable/disable must not apply late init to a
  // destroyed controller — bump on each mount effect run.
  const generationRef = useRef(0);

  useEffect(() => {
    if (!enabled || !backgroundReady) {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      document.documentElement.dataset.liquidGl = "fallback";
      setMode("fallback");
      return;
    }

    if (document.visibilityState === "hidden") {
      return;
    }

    const generation = ++generationRef.current;
    const controller = createLiquidGlassController();
    controllerRef.current = controller;
    setMode(controller.mode);
    setError(window.__miniPhoLiquidGlassDebug__?.lastError ?? null);

    const syncMode = () => {
      if (generation !== generationRef.current) return;
      setMode(controller.mode);
      setError(window.__miniPhoLiquidGlassDebug__?.lastError ?? null);
    };

    const modePoll = window.setInterval(syncMode, 200);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        controller.refresh();
        controller.recapture();
        syncMode();
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
      window.clearInterval(modePoll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("orientationchange", onOrientation);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("resize", onResize);
      if (controllerRef.current === controller) {
        controller.destroy();
        controllerRef.current = null;
      } else {
        controller.destroy();
      }
    };
  }, [enabled, backgroundReady]);

  // After committed phase / layout / camera DOM changes: immediate video sync
  // + one lens-metric pass. Do not follow with refreshImmediate().
  useLayoutEffect(() => {
    controllerRef.current?.syncVideoLayout();
  }, [phase, layoutMode, videoEnabled]);

  // Lens metric updates for chrome fade (syncVideoLayout already covers
  // phase / layoutMode / videoEnabled).
  useEffect(() => {
    controllerRef.current?.refresh();
  }, [controlsVisible]);

  // Debounced recapture for settled static DOM changes (phase + camera off
  // placeholder). syncVideoLayout does not wait for this timer.
  useEffect(() => {
    controllerRef.current?.recapture();
  }, [phase, videoEnabled]);

  // Keep the glass canvas visibility in sync with the chrome fade.
  useEffect(() => {
    controllerRef.current?.setChromeVisible(controlsVisible);
  }, [controlsVisible]);

  const refresh = useCallback(() => {
    controllerRef.current?.refresh();
  }, []);

  const refreshImmediate = useCallback(() => {
    controllerRef.current?.refreshImmediate();
  }, []);

  const syncVideoLayout = useCallback(() => {
    controllerRef.current?.syncVideoLayout();
  }, []);

  return {
    mode,
    error,
    refresh,
    refreshImmediate,
    syncVideoLayout,
  };
}
