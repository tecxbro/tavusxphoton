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
  /** Debounced lens metric refresh — never recreates the renderer. */
  refresh(): void;
  /** Immediate lens metric update after a DOM commit (e.g. contact label). */
  refreshImmediate(): void;
  /** Debounced background recapture for non-video state changes. */
  recapture(): void;
  /** Immediately drop stale video frames baked into the glass texture. */
  syncVideoRegions(): void;
  /** Fade the shared glass canvas with the call chrome. */
  setChromeVisible(visible: boolean): void;
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

interface LiquidLensLike {
  el?: HTMLElement | null;
  _shadowEl?: HTMLElement | null;
  _mirror?: HTMLCanvasElement | null;
  _sizeObs?: ResizeObserver | null;
  _unbindTiltHandlers?: () => void;
}

interface RendererLike {
  _rafId?: number | null;
  canvas?: HTMLCanvasElement | null;
  lenses?: LiquidLensLike[];
  captureSnapshot?: () => Promise<void> | void;
  gl?: WebGLRenderingContext | WebGL2RenderingContext | null;
  texture?: WebGLTexture | null;
  staticSnapshotCanvas?: HTMLCanvasElement | null;
  snapshotTarget?: HTMLElement | null;
  scaleFactor?: number;
  _videoNodes?: HTMLVideoElement[];
  _videoFrameState?: WeakMap<HTMLVideoElement, unknown>;
  _isIgnored?: (el: HTMLElement) => boolean;
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
export const LIQUID_GL_CANVAS_LAYER = ".liquid-canvas-layer";

const REFRESH_DEBOUNCE_MS = 80;
const RECAPTURE_DEBOUNCE_MS = 260;
const INIT_WATCHDOG_MS = 3000;

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
  const canvas = window.__liquidGLRenderer__?.canvas;
  return canvas?.isConnected ? 1 : 0;
}

function collectInstances(
  value: LiquidGLInstance | LiquidGLInstance[] | undefined,
): LiquidGLInstance[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * The lens constructor forces `pointer-events: none` and `opacity: 0` on every
 * target. Interactive controls must stay clickable, so pointer events are
 * restored once the lens exists; opacity is restored by LiquidGL on reveal.
 */
function restoreTargetInteractivity(instances: LiquidGLInstance[]): void {
  for (const instance of instances) {
    const el = instance.el;
    if (!el) continue;
    if (el.style.pointerEvents === "none") {
      el.style.pointerEvents = "";
    }
  }
}

function restoreTargetStyles(instances: LiquidGLInstance[]): void {
  for (const instance of instances) {
    const el = instance.el;
    if (!el) continue;
    el.style.pointerEvents = "";
    el.style.opacity = "";
    el.style.transition = "";
  }
}

/**
 * Move the shared WebGL canvas (and lens shadow elements) from document.body
 * into the call screen layer so glass participates in one stacking hierarchy:
 * video < LiquidGL canvas < controls < content < sheets.
 * Without adoption, body-level canvas paints above sheets / under wrong z-order.
 */
function adoptRendererCanvas(): void {
  const renderer = window.__liquidGLRenderer__;
  const canvas = renderer?.canvas;
  if (!renderer || !canvas) return;

  const layer =
    document.querySelector<HTMLElement>(LIQUID_GL_CANVAS_LAYER) ??
    document.querySelector<HTMLElement>(".call-screen");
  if (!layer) return;

  if (canvas.parentElement !== layer) {
    layer.appendChild(canvas);
  }
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";

  for (const lens of renderer.lenses ?? []) {
    const shadow = lens._shadowEl;
    if (shadow && shadow.parentElement !== layer) {
      layer.appendChild(shadow);
      shadow.style.position = "absolute";
    }
  }
}

/**
 * liquid-gl blits live video frames into the shared texture every frame, but
 * when a video becomes ignored (camera off) it simply stops blitting — leaving
 * the last frame frozen inside the glass long after the DOM has cross-faded to
 * the camera-off placeholder. Re-upload those regions from the static snapshot
 * (same erase technique the renderer uses for dynamic nodes) so the glass
 * drops the stale frame in the same commit as the DOM; the debounced recapture
 * then lands the settled placeholder. Version-locked to liquid-gl@2.0.1.
 */
function eraseStaleVideoRegions(): void {
  const renderer = window.__liquidGLRenderer__;
  if (!renderer) return;
  const { gl, texture, staticSnapshotCanvas, snapshotTarget } = renderer;
  if (!gl || !texture || !staticSnapshotCanvas || !snapshotTarget) return;

  const isIgnored = (el: HTMLVideoElement): boolean =>
    renderer._isIgnored?.(el) ?? Boolean(el.closest("[data-liquid-ignore]"));

  // Re-scan so videos ignored or added since construction stay tracked; the
  // renderer's per-frame ignore check still gates its live blits.
  const videos = Array.from(snapshotTarget.querySelectorAll("video"));
  renderer._videoNodes = videos;

  const snapRect = snapshotTarget.getBoundingClientRect();
  const scale = renderer.scaleFactor ?? 1;
  const maxW = staticSnapshotCanvas.width;
  const maxH = staticSnapshotCanvas.height;
  if (maxW <= 0 || maxH <= 0) return;

  let tmp: HTMLCanvasElement | null = null;
  let tmpCtx: CanvasRenderingContext2D | null = null;

  for (const vid of videos) {
    if (!isIgnored(vid) && vid.readyState >= 2) continue;

    const rect = vid.getBoundingClientRect();
    // Texture pixels map 1:1 onto the static snapshot canvas.
    const x0 = Math.max(0, (rect.left - snapRect.left) * scale);
    const y0 = Math.max(0, (rect.top - snapRect.top) * scale);
    const x1 = Math.min(maxW, (rect.right - snapRect.left) * scale);
    const y1 = Math.min(maxH, (rect.bottom - snapRect.top) * scale);
    const w = Math.round(x1 - x0);
    const h = Math.round(y1 - y0);
    if (w <= 0 || h <= 0) continue;

    if (!tmp || !tmpCtx) {
      tmp = document.createElement("canvas");
      tmpCtx = tmp.getContext("2d");
      if (!tmpCtx) return;
    }
    tmp.width = w;
    tmp.height = h;
    tmpCtx.drawImage(staticSnapshotCanvas, x0, y0, w, h, 0, 0, w, h);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      Math.round(x0),
      Math.round(y0),
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      tmp,
    );
    // Force a live redraw when the video becomes visible again.
    renderer._videoFrameState?.delete(vid);
  }
}

// Private renderer fields below are version-locked to liquid-gl@2.0.1
// (see patches/liquid-gl+2.0.1.patch). Do not upgrade without re-auditing.
function clearRenderer(): void {
  const renderer = window.__liquidGLRenderer__;
  if (!renderer) return;
  if (renderer._rafId) {
    cancelAnimationFrame(renderer._rafId);
    renderer._rafId = null;
  }

  for (const lens of renderer.lenses ?? []) {
    lens._unbindTiltHandlers?.();
    lens._sizeObs?.disconnect();
    lens._shadowEl?.remove();
    lens._mirror?.remove();
  }

  renderer.lenses = [];
  renderer.canvas?.remove();
  document.getElementById("liquid-gl-dynamic-styles")?.remove();
  delete window.__liquidGLRenderer__;
}

function assertSingleCanvasDev(): void {
  if (!import.meta.env.DEV) return;
  const canvas = window.__liquidGLRenderer__?.canvas;
  if (!canvas) return;
  const connected = Array.from(
    document.querySelectorAll("canvas[data-liquid-ignore]"),
  ).filter((node) => node instanceof HTMLCanvasElement && node.isConnected);
  if (connected.length > 1) {
    throw new Error(
      `Expected at most one LiquidGL canvas, found ${connected.length}`,
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
    // Active mode must retain nonzero refraction and low frost (not a frosted overlay).
    refraction: reduced ? 0.014 : 0.024,
    aberration: reduced ? 0.002 : 0.005,
    bevelDepth: 0.12,
    bevelWidth: 0.22,
    frost: reduced ? 0.32 : 0.16,
    shadow: true,
    specular: !reduced,
    reveal: "none" as const,
    tilt: false,
    magnify: reduced ? 1.01 : 1.02,
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
  let recaptureTimer: number | null = null;
  let watchdogTimer: number | null = null;
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

  const clearWatchdog = () => {
    if (watchdogTimer != null) {
      window.clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
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
    // Tear down any prior singleton before constructing — liquid-gl keeps one
    // global renderer; remount without clear duplicates canvases.
    clearRenderer();
    instances = [];
    initialized = false;

    try {
      const created = liquidGL(
        buildOptions(nextMode, () => {
          if (destroyed || generation !== initGeneration) return;
          initialized = true;
          clearWatchdog();
          adoptRendererCanvas();
          restoreTargetInteractivity(instances);
          setMode(nextMode === "reduced" ? "reduced" : "active");
          assertSingleCanvasDev();
        }),
      );
      instances = collectInstances(created);
      // Lenses are constructed synchronously; restore interactivity right away
      // so controls never swallow clicks even if reveal is delayed.
      restoreTargetInteractivity(instances);
      adoptRendererCanvas();

      if (instances.length === 0 && !initialized) {
        if (mode === "initializing") {
          lastError = "LiquidGL returned no instances";
          setMode("fallback");
          clearRenderer();
        }
        return;
      }

      clearWatchdog();
      watchdogTimer = window.setTimeout(() => {
        watchdogTimer = null;
        if (destroyed || initialized || generation !== initGeneration) return;
        lastError = "LiquidGL reveal timed out";
        restoreTargetStyles(instances);
        setMode("fallback");
        clearRenderer();
        instances = [];
      }, INIT_WATCHDOG_MS);
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
        adoptRendererCanvas();
        publishDebug();
        assertSingleCanvasDev();
      }, REFRESH_DEBOUNCE_MS);
    },
    refreshImmediate() {
      if (destroyed) return;
      if (mode === "fallback" || mode === "error") return;
      if (refreshTimer != null) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      if (instances.length === 0) return;
      for (const instance of instances) {
        instance.updateMetrics?.();
      }
      adoptRendererCanvas();
      publishDebug();
      assertSingleCanvasDev();
    },
    recapture() {
      if (destroyed) return;
      if (mode === "fallback" || mode === "error") return;
      if (recaptureTimer != null) {
        window.clearTimeout(recaptureTimer);
      }
      recaptureTimer = window.setTimeout(() => {
        recaptureTimer = null;
        if (destroyed) return;
        if (!initialized) return;
        const renderer = window.__liquidGLRenderer__;
        try {
          void renderer?.captureSnapshot?.();
        } catch (error) {
          lastError =
            error instanceof Error
              ? error.message.slice(0, 160)
              : "Recapture failed";
        }
        for (const instance of instances) {
          instance.updateMetrics?.();
        }
        publishDebug();
      }, RECAPTURE_DEBOUNCE_MS);
    },
    syncVideoRegions() {
      if (destroyed) return;
      if (mode === "fallback" || mode === "error") return;
      if (!initialized) return;
      eraseStaleVideoRegions();
    },
    setChromeVisible(visible: boolean) {
      if (destroyed) return;
      document.documentElement.dataset.liquidChrome = visible
        ? "visible"
        : "hidden";
    },
    destroy() {
      destroyed = true;
      initGeneration += 1;
      if (refreshTimer != null) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      if (recaptureTimer != null) {
        window.clearTimeout(recaptureTimer);
        recaptureTimer = null;
      }
      clearWatchdog();
      clearRenderer();
      instances = [];
      initialized = false;
      delete document.documentElement.dataset.liquidGl;
      delete document.documentElement.dataset.liquidChrome;
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
    refraction: 0.024,
    aberration: 0.005,
    bevelDepth: 0.12,
    bevelWidth: 0.22,
    magnify: 1.02,
    specular: true,
    frost: 0.16,
    tilt: false,
  };
}
