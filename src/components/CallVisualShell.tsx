import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import type { LiquidGlassMode } from "../lib/liquidGlass";

export interface CallVisualShellProps {
  screenRef?: RefObject<HTMLElement | null>;
  testId: string;
  phase: string;
  liquidMode: LiquidGlassMode;
  cameraOn: boolean;
  style: CSSProperties;
  /** Optional `data-chrome` for live chrome visibility. */
  chromeAttr?: "visible" | "hidden";
  /** Extra `data-*` attributes (e.g. agent id on busy). */
  dataAttrs?: Record<string, string | undefined>;
  /** Contents of `#video-stage` (remote wrap + overlay). */
  stage: ReactNode;
  /** Local camera surface when shown. */
  localCamera?: ReactNode;
  /** Overlays above the canvas (flip pill, tap catcher). */
  overlays?: ReactNode;
  /** FaceTime chrome when shown. */
  chrome?: ReactNode;
  /** Error screens, toasts, debug panels. */
  children?: ReactNode;
}

/**
 * Shared call presentation: snapshot stage, canvas layer, chrome slots.
 * Does not own Tavus, phase machines, or busy timers.
 */
export function CallVisualShell({
  screenRef,
  testId,
  phase,
  liquidMode,
  cameraOn,
  style,
  chromeAttr,
  dataAttrs,
  stage,
  localCamera,
  overlays,
  chrome,
  children,
}: CallVisualShellProps) {
  return (
    <main
      ref={screenRef}
      className="call-screen"
      data-testid={testId}
      data-phase={phase}
      data-chrome={chromeAttr}
      data-camera={cameraOn ? "on" : "off"}
      data-liquid-mode={liquidMode}
      style={style}
      {...Object.fromEntries(
        Object.entries(dataAttrs ?? {}).flatMap(([key, value]) =>
          value === undefined
            ? []
            : [[key.startsWith("data-") ? key : `data-${key}`, value]],
        ),
      )}
    >
      <div id="liquid-gl-snapshot" className="call-visual-stage">
        <div id="video-stage">{stage}</div>
        {localCamera}
      </div>

      <div className="liquid-canvas-layer" aria-hidden="true" />

      {overlays}
      {chrome}
      {children}
    </main>
  );
}
