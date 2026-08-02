/// <reference types="vite/client" />

declare module "liquid-gl" {
  export interface LiquidGLOptions {
    target?: string;
    snapshot?: string;
    resolution?: number;
    refraction?: number;
    aberration?: number;
    bevelDepth?: number;
    bevelWidth?: number;
    frost?: number;
    shadow?: boolean;
    specular?: boolean;
    reveal?: "none" | "fade";
    tilt?: boolean;
    tiltFactor?: number;
    tiltEase?: number;
    magnify?: number;
    on?: {
      init?: (instance: LiquidGLInstance) => void;
    };
  }

  export interface LiquidGLInstance {
    updateMetrics?: () => void;
    el?: HTMLElement;
  }

  interface LiquidGLFn {
    (options?: LiquidGLOptions): LiquidGLInstance | LiquidGLInstance[] | undefined;
    registerDynamic?: (elements: string | Element | Element[]) => void;
    syncWith?: (config?: Record<string, unknown>) => unknown;
  }

  const liquidGL: LiquidGLFn;
  export default liquidGL;
}
