import type { CSSProperties } from "react";
import cameraOnUrl from "../assets/call-symbols/camera-on.svg?url";
import cameraOffUrl from "../assets/call-symbols/camera-off.svg?url";
import microphoneOnUrl from "../assets/call-symbols/microphone-on.svg?url";
import microphoneOffUrl from "../assets/call-symbols/microphone-off.svg?url";
import endCallUrl from "../assets/call-symbols/end-call.svg?url";
import flipCameraUrl from "../assets/call-symbols/flip-camera.svg?url";
import effectsUrl from "../assets/call-symbols/effects.svg?url";
import contactChevronUrl from "../assets/call-symbols/contact-chevron.svg?url";
import moreUrl from "../assets/call-symbols/more.svg?url";

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

const SYMBOL_ASSETS: Record<SymbolName, string> = {
  "camera-on": cameraOnUrl,
  "camera-off": cameraOffUrl,
  "microphone-on": microphoneOnUrl,
  "microphone-off": microphoneOffUrl,
  "end-call": endCallUrl,
  "flip-camera": flipCameraUrl,
  effects: effectsUrl,
  "contact-chevron": contactChevronUrl,
  more: moreUrl,
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
      style={
        {
          width: size,
          height: size,
          "--symbol-mask": `url("${asset}")`,
          ...style,
        } as CSSProperties
      }
    />
  );
}
