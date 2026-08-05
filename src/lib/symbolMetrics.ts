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
  "camera-on": { width: 24, height: 16 },
  "camera-off": { width: 19.5, height: 16 },
  "microphone-on": { width: 13.5, height: 20 },
  "microphone-off": { width: 16.5, height: 20 },
  more: { width: 21, height: 4.25 },
  "end-call": { width: 16.5, height: 16.5 },
  "flip-camera": { width: 21, height: 17.25 },
  effects: { width: 13.5, height: 18 },
  "contact-chevron": { width: 5, height: 17 },
};
