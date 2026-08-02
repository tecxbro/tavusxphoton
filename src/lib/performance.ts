export type PerformanceMode = "full" | "reduced" | "fallback";

export interface PerformanceSample {
  fps: number;
  averageFps: number;
  droppedFrames: number;
  mode: PerformanceMode;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  liquidEnabled: boolean;
}

export interface PerformancePolicy {
  mode: PerformanceMode;
  resolution: number;
  specular: boolean;
  useCssFallback: boolean;
}

const LOW_FPS_THRESHOLD = 45;
const LOW_FPS_WINDOW_MS = 3000;

export function selectPerformancePolicy(
  averageFps: number,
  lowFpsDurationMs: number,
  current: PerformanceMode,
  forceFallback = false,
): PerformancePolicy {
  if (forceFallback) {
    return {
      mode: "fallback",
      resolution: 1,
      specular: false,
      useCssFallback: true,
    };
  }

  if (
    averageFps < LOW_FPS_THRESHOLD &&
    lowFpsDurationMs >= LOW_FPS_WINDOW_MS
  ) {
    if (current === "full") {
      return {
        mode: "reduced",
        resolution: 1,
        specular: false,
        useCssFallback: false,
      };
    }
    return {
      mode: "fallback",
      resolution: 1,
      specular: false,
      useCssFallback: true,
    };
  }

  if (current === "reduced") {
    return {
      mode: "reduced",
      resolution: 1,
      specular: false,
      useCssFallback: false,
    };
  }

  if (current === "fallback") {
    return {
      mode: "fallback",
      resolution: 1,
      specular: false,
      useCssFallback: true,
    };
  }

  return {
    mode: "full",
    resolution: 1.25,
    specular: true,
    useCssFallback: false,
  };
}

export function prefersReducedTransparency(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
}

export function hasWebGLSupport(): boolean {
  if (typeof document === "undefined") return false;
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

export function createFpsTracker() {
  let frames = 0;
  let last = performance.now();
  let fps = 60;
  let averageFps = 60;
  let samples = 0;
  let droppedFrames = 0;
  let lowSince: number | null = null;

  return {
    tick(now = performance.now()) {
      frames += 1;
      const elapsed = now - last;
      if (elapsed >= 1000) {
        fps = Math.round((frames * 1000) / elapsed);
        samples += 1;
        averageFps = Math.round(
          (averageFps * (samples - 1) + fps) / samples,
        );
        const expected = Math.round(elapsed / (1000 / 60));
        droppedFrames += Math.max(0, expected - frames);
        frames = 0;
        last = now;

        if (averageFps < LOW_FPS_THRESHOLD) {
          if (lowSince === null) lowSince = now;
        } else {
          lowSince = null;
        }
      }
      return {
        fps,
        averageFps,
        droppedFrames,
        lowFpsDurationMs: lowSince ? now - lowSince : 0,
      };
    },
    reset() {
      frames = 0;
      last = performance.now();
      fps = 60;
      averageFps = 60;
      samples = 0;
      droppedFrames = 0;
      lowSince = null;
    },
  };
}
