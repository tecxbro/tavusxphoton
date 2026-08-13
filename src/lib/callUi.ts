/** Shared FaceTime call UI layout and motion — single source of truth for TS + CSS. */

/** Self-view layout mode driven by call phase and chrome visibility. */
export type LocalCameraMode = "fullscreen" | "expanded" | "compact";

export const SELF_VIEW_LAYOUT = {
  leftInset: 18,
  rightInset: 20,
  expandedTopOffset: 68,
  compactTopOffset: 18,
  expandedAspect: 0.47,
  compactAspect: 0.46,
} as const;

export const CALL_MOTION = {
  connectingMinMs: 400,
  joinMs: 200,
  controlMs: 180,
} as const;

export const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** CSS custom properties derived from layout/motion constants for `.call-screen`. */
export function callScreenCssVars(
  safeInsets: SafeInsets,
): Record<string, string> {
  return {
    "--safe-top": `${safeInsets.top}px`,
    "--safe-right": `${safeInsets.right}px`,
    "--safe-bottom": `${safeInsets.bottom}px`,
    "--safe-left": `${safeInsets.left}px`,
    "--self-left-inset": `${SELF_VIEW_LAYOUT.leftInset}px`,
    "--self-right-inset": `${SELF_VIEW_LAYOUT.rightInset}px`,
    "--self-expanded-top-offset": `${SELF_VIEW_LAYOUT.expandedTopOffset}px`,
    "--self-compact-top-offset": `${SELF_VIEW_LAYOUT.compactTopOffset}px`,
    "--self-expanded-aspect": String(SELF_VIEW_LAYOUT.expandedAspect),
    "--self-compact-aspect": String(SELF_VIEW_LAYOUT.compactAspect),
    "--motion-join": `${CALL_MOTION.joinMs}ms`,
    "--motion-chrome": `${CALL_MOTION.controlMs}ms`,
    "--motion-self": `${CALL_MOTION.controlMs}ms`,
  };
}
