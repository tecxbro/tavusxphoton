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

const SNAPSHOT = "#video-stage";
const CONTROL_TARGET = ".liquidGL";
const PANEL_TARGET = ".liquidGL-panel";

function controlOptions(mode: PerformanceMode): LiquidGLOptions {
  const reduced = mode === "reduced";
  return {
    snapshot: SNAPSHOT,
    target: CONTROL_TARGET,
    resolution: reduced ? 1 : 1.35,
    refraction: 0.024,
    aberration: 0,
    bevelDepth: 0.1,
    bevelWidth: 0.14,
    frost: 0.55,
    shadow: true,
    specular: !reduced,
    reveal: "none",
    tilt: false,
    magnify: 1.02,
  };
}

function panelOptions(mode: PerformanceMode): LiquidGLOptions {
  const reduced = mode === "reduced";
  return {
    snapshot: SNAPSHOT,
    target: PANEL_TARGET,
    resolution: reduced ? 1 : 1.15,
    refraction: 0.012,
    aberration: 0,
    bevelDepth: 0.06,
    bevelWidth: 0.2,
    frost: 1.15,
    shadow: true,
    specular: false,
    reveal: "none",
    tilt: false,
    magnify: 1.0,
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
  if (window.__miniPhoForceGlassFallback__ === true) return true;
  if (prefersReducedTransparency()) return true;
  if (!hasWebGLSupport()) return true;
  return false;
}

function collectInstances(
  value: LiquidGLInstance | LiquidGLInstance[] | undefined,
): LiquidGLInstance[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function mountGlass(mode: PerformanceMode): LiquidGLInstance[] {
  const controls = document.querySelectorAll(CONTROL_TARGET);
  const panels = document.querySelectorAll(PANEL_TARGET);
  const instances: LiquidGLInstance[] = [];

  if (controls.length > 0) {
    instances.push(...collectInstances(liquidGL(controlOptions(mode))));
  }
  if (panels.length > 0) {
    instances.push(...collectInstances(liquidGL(panelOptions(mode))));
  }
  return instances;
}

export function initLiquidGlass(
  mode: PerformanceMode = "full",
  forceFallback = false,
): GlassController {
  const useFallback = shouldUseFallback(forceFallback || mode === "fallback");
  let currentMode: PerformanceMode = useFallback ? "fallback" : mode;
  let instances: LiquidGLInstance[] = [];

  document.documentElement.classList.toggle("glass-fallback-mode", useFallback);

  if (!useFallback) {
    try {
      clearRenderer();
      instances = mountGlass(currentMode);
      if (instances.length === 0 && document.querySelector(CONTROL_TARGET)) {
        // Targets may not be mounted yet; keep mode and retry via refresh callers.
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
      if (instances.length === 0) {
        try {
          instances = mountGlass(currentMode);
        } catch {
          return;
        }
      }
      for (const instance of instances) {
        instance.updateMetrics?.();
      }
    },
    destroy() {
      clearRenderer();
      instances = [];
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
        instances = mountGlass(next);
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
