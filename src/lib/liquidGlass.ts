import liquidGL from "liquid-gl";
import type { LiquidGLInstance, LiquidGLOptions } from "liquid-gl";
import {
  hasWebGLSupport,
  prefersReducedTransparency,
  type PerformanceMode,
} from "./performance";

export interface GlassController {
  enabled: boolean;
  mode: PerformanceMode;
  refresh: () => void;
  destroy: () => void;
  setMode: (mode: PerformanceMode) => void;
}

interface RendererLike {
  _rafId?: number | null;
  canvas?: HTMLCanvasElement | null;
  lenses?: unknown[];
}

declare global {
  interface Window {
    __liquidGLRenderer__?: RendererLike;
    __miniPhoForceGlassFallback__?: boolean;
  }
}

const TARGET = ".liquidGL";
const SNAPSHOT = "#video-stage";

function baseOptions(
  mode: PerformanceMode,
): LiquidGLOptions {
  const reduced = mode === "reduced";
  return {
    snapshot: SNAPSHOT,
    target: TARGET,
    resolution: reduced ? 1 : 1.25,
    refraction: 0.018,
    aberration: 0,
    bevelDepth: 0.085,
    bevelWidth: 0.17,
    frost: 0.8,
    shadow: true,
    specular: !reduced,
    reveal: "none",
    tilt: false,
    magnify: 1.01,
  };
}

function clearRenderer(): void {
  const renderer = window.__liquidGLRenderer__;
  if (!renderer) return;
  if (renderer._rafId) {
    cancelAnimationFrame(renderer._rafId);
    renderer._rafId = null;
  }
  renderer.canvas?.remove();
  renderer.lenses = [];
  delete window.__liquidGLRenderer__;
}

function shouldUseFallback(forceFallback: boolean): boolean {
  if (forceFallback) return true;
  if (window.__miniPhoForceGlassFallback__) return true;
  if (prefersReducedTransparency()) return true;
  if (!hasWebGLSupport()) return true;
  return false;
}

export function initLiquidGlass(
  mode: PerformanceMode = "full",
  forceFallback = false,
): GlassController {
  const useFallback = shouldUseFallback(forceFallback || mode === "fallback");
  let currentMode: PerformanceMode = useFallback ? "fallback" : mode;
  let instances: LiquidGLInstance | LiquidGLInstance[] | undefined;

  document.documentElement.classList.toggle("glass-fallback-mode", useFallback);

  if (!useFallback) {
    try {
      clearRenderer();
      instances = liquidGL(baseOptions(currentMode));
      if (!instances) {
        currentMode = "fallback";
        document.documentElement.classList.add("glass-fallback-mode");
      }
    } catch {
      currentMode = "fallback";
      document.documentElement.classList.add("glass-fallback-mode");
      clearRenderer();
    }
  }

  return {
    get enabled() {
      return currentMode !== "fallback";
    },
    get mode() {
      return currentMode;
    },
    refresh() {
      if (currentMode === "fallback") return;
      const list = Array.isArray(instances)
        ? instances
        : instances
          ? [instances]
          : [];
      for (const instance of list) {
        instance.updateMetrics?.();
      }
    },
    destroy() {
      clearRenderer();
      document.documentElement.classList.remove("glass-fallback-mode");
    },
    setMode(next: PerformanceMode) {
      if (next === currentMode) return;
      currentMode = next;
      this.destroy();
      if (next === "fallback") {
        document.documentElement.classList.add("glass-fallback-mode");
        return;
      }
      document.documentElement.classList.remove("glass-fallback-mode");
      try {
        instances = liquidGL(baseOptions(next));
        if (!instances) {
          currentMode = "fallback";
          document.documentElement.classList.add("glass-fallback-mode");
        }
      } catch {
        currentMode = "fallback";
        document.documentElement.classList.add("glass-fallback-mode");
      }
    },
  };
}

export function hapticTap(): void {
  try {
    navigator.vibrate?.(10);
  } catch {
    // Vibration is optional feedback only.
  }
}
