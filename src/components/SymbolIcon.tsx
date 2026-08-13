import type { CSSProperties } from "react";
import cameraOnSvg from "../assets/call-symbols/camera-on.svg?raw";
import cameraOffSvg from "../assets/call-symbols/camera-off.svg?raw";
import microphoneOnSvg from "../assets/call-symbols/microphone-on.svg?raw";
import microphoneOffSvg from "../assets/call-symbols/microphone-off.svg?raw";
import endCallSvg from "../assets/call-symbols/end-call.svg?raw";
import flipCameraSvg from "../assets/call-symbols/flip-camera.svg?raw";
import effectsSvg from "../assets/call-symbols/effects.svg?raw";
import contactChevronSvg from "../assets/call-symbols/contact-chevron.svg?raw";
import moreSvg from "../assets/call-symbols/more.svg?raw";

import { SYMBOL_METRICS, type SymbolName } from "../lib/symbolMetrics";

export type { SymbolName } from "../lib/symbolMetrics";

// Local Apple-exported SVG files are rendered inline so they do not depend on CSS masks.
const SYMBOL_ASSETS: Record<SymbolName, string> = {
  "camera-on": cameraOnSvg,
  "camera-off": cameraOffSvg,
  "microphone-on": microphoneOnSvg,
  "microphone-off": microphoneOffSvg,
  "end-call": endCallSvg,
  "flip-camera": flipCameraSvg,
  effects: effectsSvg,
  "contact-chevron": contactChevronSvg,
  more: moreSvg,
};

interface SymbolIconProps {
  name: SymbolName;
  /** Optional optical height override; width scales with the symbol aspect. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Inline Apple-exported call-symbol SVG. Metrics come from {@link SYMBOL_METRICS}
 * so glyphs keep comparable optical weight on the control rail.
 *
 * @param props.name - Symbol asset key.
 * @param props.size - Optional optical height override (width scales with aspect).
 */
export function SymbolIcon({ name, size, className, style }: SymbolIconProps) {
  const asset = SYMBOL_ASSETS[name];
  const metric = SYMBOL_METRICS[name];
  const scale = size !== undefined ? size / metric.height : 1;
  const width = Math.round(metric.width * scale * 100) / 100;
  const height = Math.round(metric.height * scale * 100) / 100;

  return (
    <span
      aria-hidden="true"
      className={`symbol-icon ${className ?? ""}`.trim()}
      data-symbol={name}
      style={{
        width,
        height,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: asset }}
    />
  );
}
