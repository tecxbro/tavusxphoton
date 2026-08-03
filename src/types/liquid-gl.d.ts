declare module "liquid-gl" {
  export interface LiquidGLOptions {
    snapshot?: string;
    target?: string;
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
    magnify?: number;
    on?: {
      init?: (instance: LiquidGLInstance) => void;
    };
  }

  export interface LiquidGLInstance {
    updateMetrics?: () => void;
    el?: HTMLElement;
    options?: LiquidGLOptions;
  }

  export default function liquidGL(
    options?: LiquidGLOptions,
  ): LiquidGLInstance | LiquidGLInstance[] | undefined;
}

export {};
