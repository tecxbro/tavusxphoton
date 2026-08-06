import type { CSSProperties } from "react";
import cameraOnSvg from "../assets/home-symbols/camera-on.svg?raw";
import menuSvg from "../assets/home-symbols/menu.svg?raw";
import callOutgoingSvg from "../assets/home-symbols/call-outgoing.svg?raw";
import checkSvg from "../assets/home-symbols/check.svg?raw";

export type HomeSymbolName = "camera-on" | "menu" | "call-outgoing" | "check";

interface HomeSymbolMetric {
  width: number;
  height: number;
}

const HOME_SYMBOL_ASSETS: Record<HomeSymbolName, string> = {
  "camera-on": cameraOnSvg,
  menu: menuSvg,
  "call-outgoing": callOutgoingSvg,
  check: checkSvg,
};

const HOME_SYMBOL_METRICS: Record<HomeSymbolName, HomeSymbolMetric> = {
  "camera-on": { width: 24, height: 16 },
  menu: { width: 18, height: 18 },
  "call-outgoing": { width: 12, height: 12 },
  check: { width: 14, height: 14 },
};

interface HomeSymbolIconProps {
  name: HomeSymbolName;
  /** Optional optical height override; width scales with the symbol aspect. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function HomeSymbolIcon({
  name,
  size,
  className,
  style,
}: HomeSymbolIconProps) {
  const asset = HOME_SYMBOL_ASSETS[name];
  const metric = HOME_SYMBOL_METRICS[name];
  const scale = size !== undefined ? size / metric.height : 1;
  const width = Math.round(metric.width * scale * 100) / 100;
  const height = Math.round(metric.height * scale * 100) / 100;

  return (
    <span
      aria-hidden="true"
      className={`home-symbol-icon ${className ?? ""}`.trim()}
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
