/// <reference types="vite/client" />

interface MiniPhoLiquidGlassDebug {
  packageVersion: "2.0.1";
  mode: string;
  initialized: boolean;
  targetCount: number;
  canvasCount: number;
  snapshotFound: boolean;
  lastError: string | null;
  webglAvailable: boolean;
}

interface Window {
  __miniPhoLiquidGlassDebug__?: MiniPhoLiquidGlassDebug;
  __miniPhoForceGlassFallback__?: boolean;
  __liquidGLRenderer__?: {
    _rafId?: number | null;
    canvas?: HTMLCanvasElement | null;
    lenses?: unknown[];
  };
}

export {};
