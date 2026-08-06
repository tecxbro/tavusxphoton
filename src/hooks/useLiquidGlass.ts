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
  /** Post-snapshot video-texture rebuild (not for morph frames). */
  rebuildVideoTexture: () => void;
  /** Debounced background recapture for settled static DOM changes. */
  recapture: () => void;
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

  // Phase / layout / camera commits: lens metrics only. Video eligibility is
  // rescanned by the renderer RAF loop; settled snapshots come from morph
  // finish / camera-off / visibility — never a mid-morph full texture wipe.
  useLayoutEffect(() => {
    controllerRef.current?.refreshImmediate();
  }, [phase, layoutMode, videoEnabled]);

  // Lens metric updates for chrome fade.
  useEffect(() => {
    controllerRef.current?.refresh();
  }, [controlsVisible]);

  // Recapture only the camera-off static state. Do not recapture on joining/
  // live — pickup morph onFinish owns that settled snapshot.
  useEffect(() => {
    if (!videoEnabled) {
      controllerRef.current?.recapture();
    }
  }, [videoEnabled]);

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

  const rebuildVideoTexture = useCallback(() => {
    controllerRef.current?.rebuildVideoTexture();
  }, []);

  const recapture = useCallback(() => {
    controllerRef.current?.recapture();
  }, []);

  return {
    mode,
    error,
    refresh,
    refreshImmediate,
    rebuildVideoTexture,
    recapture,
  };
}
