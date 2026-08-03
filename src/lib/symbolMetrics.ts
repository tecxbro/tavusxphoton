export type SymbolName =
  | "camera-on"
  | "camera-off"
  | "microphone-on"
  | "microphone-off"
  | "end-call"
  | "flip-camera"
  | "effects"
  | "contact-chevron"
  | "more";

export interface SymbolMetric {
  width: number;
  height: number;
}

/**
 * Per-symbol optical box, tuned against the FaceTime reference so every glyph
 * carries comparable visual weight on the 56px rail buttons. Box aspect always
 * matches the asset viewBox aspect, so the glyph fills its box without
 * distortion or letterboxing.
 */
export const SYMBOL_METRICS: Record<SymbolName, SymbolMetric> = {
  "camera-on": { width: 30, height: 20 },
  "camera-off": { width: 24.5, height: 20 },
  "microphone-on": { width: 15, height: 22 },
  "microphone-off": { width: 18, height: 22 },
  more: { width: 32, height: 6.5 },
  "end-call": { width: 26, height: 26 },
  "flip-camera": { width: 24, height: 20 },
  effects: { width: 19, height: 26 },
  "contact-chevron": { width: 5, height: 17 },
};
