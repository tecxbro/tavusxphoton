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
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function SymbolIcon({
  name,
  size = "1em",
  className,
  style,
}: SymbolIconProps) {
  const asset = SYMBOL_ASSETS[name];
  return (
    <span
      aria-hidden="true"
      className={`symbol-icon ${className ?? ""}`.trim()}
      style={{
        width: size,
        height: size,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: asset }}
    />
  );
}
