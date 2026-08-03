import liquidGL from "liquid-gl";
import type { LiquidGLInstance } from "liquid-gl";

export type LiquidGlassMode =
  | "initializing"
  | "active"
  | "reduced"
  | "fallback"
  | "error";

export interface LiquidGlassController {
  mode: LiquidGlassMode;
  refresh(): void;
  destroy(): void;
}

export interface LiquidGlassDebugState {
  packageVersion: "2.0.1";
  mode: LiquidGlassMode;
  initialized: boolean;
  targetCount: number;
  canvasCount: number;
  snapshotFound: boolean;
  lastError: string | null;
  webglAvailable: boolean;
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
    __miniPhoLiquidGlassDebug__?: LiquidGlassDebugState;
  }
}

export const LIQUID_GL_PACKAGE_VERSION = "2.0.1" as const;
export const LIQUID_GL_SNAPSHOT = "#liquid-gl-snapshot";
export const LIQUID_GL_TARGET = ".liquidGL";

const REFRESH_DEBOUNCE_MS = 80;

function isMobileViewport(): boolean {
  return window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;
}

function prefersReducedTransparency(): boolean {
  return window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
}

export function hasWebGLSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

function countLiquidCanvases(): number {
  return Array.from(document.querySelectorAll("canvas")).filter((node) => {
    const canvas = node as HTMLCanvasElement;
    if (canvas.hasAttribute("data-liquid-ignore")) return true;
    try {
      return Boolean(
        canvas.getContext("webgl") || canvas.getContext("webgl2"),
      );
    } catch {
      return false;
    }
  }).length;
}

function collectInstances(
  value: LiquidGLInstance | LiquidGLInstance[] | undefined,
): LiquidGLInstance[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
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

function assertSingleCanvasDev(): void {
  if (!import.meta.env.DEV) return;
  const canvases = document.querySelectorAll(
    'canvas[data-liquid-ignore], canvas',
  );
  const liquidCanvases = Array.from(canvases).filter((node) => {
    const el = node as HTMLCanvasElement;
    return (
      el.hasAttribute("data-liquid-ignore") ||
      Boolean(window.__liquidGLRenderer__?.canvas === el)
    );
  });
  if (liquidCanvases.length > 1) {
    throw new Error(
      `Expected at most one LiquidGL canvas, found ${liquidCanvases.length}`,
    );
  }
}

function buildOptions(
  mode: "active" | "reduced",
  onInit: (instance: LiquidGLInstance) => void,
) {
  const reduced = mode === "reduced";
  const mobile = isMobileViewport();
  return {
    snapshot: LIQUID_GL_SNAPSHOT,
    target: LIQUID_GL_TARGET,
    resolution: reduced ? 1.0 : mobile ? 1.25 : 1.5,
    refraction: 0.018,
    aberration: 0.004,
    bevelDepth: 0.085,
    bevelWidth: 0.17,
    frost: 0.25,
    shadow: true,
    specular: !reduced,
    reveal: "none" as const,
    tilt: false,
    magnify: 1.012,
    on: {
      init: onInit,
    },
  };
}

export function createLiquidGlassController(): LiquidGlassController {
  let mode: LiquidGlassMode = "initializing";
  let instances: LiquidGLInstance[] = [];
  let lastError: string | null = null;
  let initialized = false;
  let destroyed = false;
  let refreshTimer: number | null = null;
  let initGeneration = 0;

  const publishDebug = () => {
    if (typeof window === "undefined") return;
    window.__miniPhoLiquidGlassDebug__ = {
      packageVersion: LIQUID_GL_PACKAGE_VERSION,
      mode,
      initialized,
      targetCount: document.querySelectorAll(LIQUID_GL_TARGET).length,
      canvasCount: countLiquidCanvases(),
      snapshotFound: Boolean(document.querySelector(LIQUID_GL_SNAPSHOT)),
      lastError,
      webglAvailable: hasWebGLSupport(),
    };
  };

  const setMode = (next: LiquidGlassMode) => {
    mode = next;
    document.documentElement.dataset.liquidGl = next;
    publishDebug();
  };

  const mount = (nextMode: "active" | "reduced") => {
    const snapshot = document.querySelector(LIQUID_GL_SNAPSHOT);
    const targets = document.querySelectorAll(LIQUID_GL_TARGET);
    if (!snapshot || targets.length === 0) {
      lastError = "Snapshot or targets missing";
      setMode("fallback");
      return;
    }

    const generation = ++initGeneration;
    setMode("initializing");
    clearRenderer();
    instances = [];
    initialized = false;

    try {
      const created = liquidGL(
        buildOptions(nextMode, () => {
          if (destroyed || generation !== initGeneration) return;
          initialized = true;
          setMode(nextMode === "reduced" ? "reduced" : "active");
          assertSingleCanvasDev();
        }),
      );
      instances = collectInstances(created);
      if (instances.length === 0 && !initialized) {
        // init may fire synchronously; if not and no instances, fall back.
        if (mode === "initializing") {
          lastError = "LiquidGL returned no instances";
          setMode("fallback");
          clearRenderer();
        }
      }
    } catch (error) {
      lastError =
        error instanceof Error ? error.message.slice(0, 160) : "Init failed";
      setMode("error");
      clearRenderer();
      instances = [];
    }
  };

  const shouldFallback = (): boolean => {
    if (window.__miniPhoForceGlassFallback__ === true) return true;
    if (prefersReducedTransparency()) return true;
    if (!hasWebGLSupport()) return true;
    return false;
  };

  if (shouldFallback()) {
    lastError = prefersReducedTransparency()
      ? "Reduced transparency"
      : "WebGL unavailable";
    setMode("fallback");
  } else {
    mount("active");
  }

  publishDebug();

  return {
    get mode() {
      return mode;
    },
    refresh() {
      if (destroyed) return;
      if (mode === "fallback" || mode === "error") return;
      if (refreshTimer != null) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        if (destroyed) return;
        if (instances.length === 0 && mode !== "fallback" && mode !== "error") {
          mount(mode === "reduced" ? "reduced" : "active");
          return;
        }
        for (const instance of instances) {
          instance.updateMetrics?.();
        }
        publishDebug();
        assertSingleCanvasDev();
      }, REFRESH_DEBOUNCE_MS);
    },
    destroy() {
      destroyed = true;
      initGeneration += 1;
      if (refreshTimer != null) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      clearRenderer();
      instances = [];
      initialized = false;
      delete document.documentElement.dataset.liquidGl;
      if (window.__miniPhoLiquidGlassDebug__) {
        window.__miniPhoLiquidGlassDebug__ = {
          ...window.__miniPhoLiquidGlassDebug__,
          mode: "fallback",
          initialized: false,
          canvasCount: 0,
        };
      }
    },
  };
}

/** Test helper: expose option builder constraints without mounting WebGL. */
export function getFullLiquidGlassOptionConstraints() {
  return {
    snapshot: LIQUID_GL_SNAPSHOT,
    target: LIQUID_GL_TARGET,
    refraction: 0.018,
    bevelDepth: 0.085,
    bevelWidth: 0.17,
    magnify: 1.012,
    specular: true,
    frost: 0.25,
    tilt: false,
  };
}
