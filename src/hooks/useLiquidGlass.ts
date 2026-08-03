import { useEffect, useRef, useState } from "react";
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
}

export interface UseLiquidGlassResult {
  mode: LiquidGlassMode;
  error: string | null;
  refresh: () => void;
}

export function useLiquidGlass({
  enabled,
  backgroundReady,
  phase,
  controlsVisible,
  layoutMode,
}: UseLiquidGlassInput): UseLiquidGlassResult {
  const [mode, setMode] = useState<LiquidGlassMode>("initializing");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<LiquidGlassController | null>(null);
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
        syncMode();
      }
    };
    const onOrientation = () => controller.refresh();
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

  useEffect(() => {
    controllerRef.current?.refresh();
  }, [phase, controlsVisible, layoutMode]);

  return {
    mode,
    error,
    refresh: () => controllerRef.current?.refresh(),
  };
}
