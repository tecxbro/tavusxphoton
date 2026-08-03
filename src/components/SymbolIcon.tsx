import type { CSSProperties, ReactElement, ReactNode, SVGProps } from "react";
import arrowTriangle2CirclepathCameraUrl from "../assets/sf-symbols/arrow.triangle.2.circlepath.camera.svg?url";
import chevronRightUrl from "../assets/sf-symbols/chevron.right.svg?url";
import ellipsisUrl from "../assets/sf-symbols/ellipsis.svg?url";
import micFillUrl from "../assets/sf-symbols/mic.fill.svg?url";
import micSlashFillUrl from "../assets/sf-symbols/mic.slash.fill.svg?url";
import videoFillUrl from "../assets/sf-symbols/video.fill.svg?url";
import videoSlashFillUrl from "../assets/sf-symbols/video.slash.fill.svg?url";
import xmarkUrl from "../assets/sf-symbols/xmark.svg?url";

export type SymbolName =
  | "video.fill"
  | "video.slash.fill"
  | "mic.fill"
  | "mic.slash.fill"
  | "ellipsis"
  | "xmark"
  | "arrow.triangle.2.circlepath.camera"
  | "chevron.right"
  | "person.badge.plus"
  | "airpodspro"
  | "captions.bubble.fill"
  | "translate"
  | "screen.sharing"
  | "shareplay";

type IconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

function Svg({
  children,
  viewBox = "0 0 24 24",
  title,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

const MASKED_SYMBOLS: Partial<Record<SymbolName, string>> = {
  "video.fill": videoFillUrl,
  "video.slash.fill": videoSlashFillUrl,
  "mic.fill": micFillUrl,
  "mic.slash.fill": micSlashFillUrl,
  ellipsis: ellipsisUrl,
  xmark: xmarkUrl,
  "arrow.triangle.2.circlepath.camera": arrowTriangle2CirclepathCameraUrl,
  "chevron.right": chevronRightUrl,
};

const icons: Partial<Record<SymbolName, (props: IconProps) => ReactElement>> = {
  "person.badge.plus": (props) => (
    <Svg viewBox="0 0 24 24" {...props}>
      <path d="M9.5 3.75a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Z" />
      <path d="M3.5 18.1c0-2.85 2.65-5.1 6-5.1s6 2.25 6 5.1v.4c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 0 1 3.5 18.5v-.4Z" />
      <path d="M18.25 9.5a.75.75 0 0 1 .75.75v1.75H20.75a.75.75 0 0 1 0 1.5H19v1.75a.75.75 0 0 1-1.5 0V13.5h-1.75a.75.75 0 0 1 0-1.5h1.75V10.25a.75.75 0 0 1 .75-.75Z" />
    </Svg>
  ),
  airpodspro: (props) => (
    <Svg viewBox="0 0 24 24" {...props}>
      <path d="M8.2 4.5c2.2 0 3.8 1.55 3.8 3.7v5.05c0 .55-.45 1-1 1h-.35c-.55 0-1-.45-1-1V9.8c0-.9-.7-1.55-1.55-1.55S6.55 8.9 6.55 9.8v8.45c0 .9.7 1.55 1.55 1.55s1.55-.65 1.55-1.55v-1.7c0-.55.45-1 1-1h.35c.55 0 1 .45 1 1v1.85c0 2.15-1.7 3.6-3.9 3.6S4.3 20.85 4.3 18.7V9.8c0-2.85 1.7-5.3 3.9-5.3Z" />
      <path d="M15.8 4.5c2.2 0 3.9 2.45 3.9 5.3v8.9c0 2.15-1.7 3.6-3.9 3.6s-3.9-1.45-3.9-3.6v-1.85c0-.55.45-1 1-1h.35c.55 0 1 .45 1 1v1.7c0 .9.7 1.55 1.55 1.55s1.55-.65 1.55-1.55V9.8c0-.9-.7-1.55-1.55-1.55S14.45 8.9 14.45 9.8v3.45c0 .55-.45 1-1 1h-.35c-.55 0-1-.45-1-1V8.2c0-2.15 1.6-3.7 3.7-3.7Z" />
    </Svg>
  ),
  "captions.bubble.fill": (props) => (
    <Svg viewBox="0 0 24 24" {...props}>
      <path d="M12 3.5c5.1 0 9 3.35 9 7.75 0 2.7-1.5 5.1-3.85 6.55-.2.12-.35.32-.35.55v1.35c0 .7-.75 1.15-1.35.8l-2.45-1.4c-.2-.12-.42-.18-.65-.18H12c-5.1 0-9-3.35-9-7.67C3 6.85 6.9 3.5 12 3.5Z" />
      <circle cx="8.2" cy="11.1" r="1.05" fill="#111" />
      <circle cx="12" cy="11.1" r="1.05" fill="#111" />
      <circle cx="15.8" cy="11.1" r="1.05" fill="#111" />
    </Svg>
  ),
  translate: (props) => (
    <Svg viewBox="0 0 24 24" {...props}>
      <path d="M4.5 6.25h6.25a.75.75 0 0 1 0 1.5H8.9c.45 1.55 1.35 2.95 2.55 4.1a.75.75 0 1 1-1.05 1.07A12.4 12.4 0 0 1 7.7 9.55c-.55 1.15-1.35 2.2-2.35 3.05a.75.75 0 1 1-.95-1.16 10.7 10.7 0 0 0 2.05-2.69H4.5a.75.75 0 0 1 0-1.5Z" />
      <path d="M13.5 8.5h6a.75.75 0 0 1 .65 1.1l-3.35 6.35a.75.75 0 0 1-1.32 0L12.85 9.6a.75.75 0 0 1 .65-1.1Zm3 2.05-1.55 2.95-1.55-2.95h3.1Z" />
      <path d="M5.5 17.25h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1 0-1.5Z" />
    </Svg>
  ),
  "screen.sharing": (props) => (
    <Svg viewBox="0 0 24 24" {...props}>
      <path d="M5.75 5.5A2.75 2.75 0 0 0 3 8.25v5.5A2.75 2.75 0 0 0 5.75 16.5h5.5A2.75 2.75 0 0 0 14 13.75v-5.5A2.75 2.75 0 0 0 11.25 5.5h-5.5Z" />
      <path
        d="M10.75 10.5A2.75 2.75 0 0 0 8 13.25v5.5A2.75 2.75 0 0 0 10.75 21.5h7.5A2.75 2.75 0 0 0 21 18.75v-5.5A2.75 2.75 0 0 0 18.25 10.5h-7.5Z"
        opacity="0.92"
      />
    </Svg>
  ),
  shareplay: (props) => (
    <Svg viewBox="0 0 24 24" {...props}>
      <path d="M12 4.25a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
      <path d="M7.2 16.4c0-2.15 2.15-3.9 4.8-3.9s4.8 1.75 4.8 3.9v.35c0 .69-.56 1.25-1.25 1.25H8.45c-.69 0-1.25-.56-1.25-1.25v-.35Z" />
      <path d="M4.6 9.2a.75.75 0 0 1 1.06 0c.95.95 1.45 2.1 1.45 3.3 0 1.2-.5 2.35-1.45 3.3a.75.75 0 1 1-1.06-1.06c.68-.68 1.01-1.45 1.01-2.24s-.33-1.56-1.01-2.24a.75.75 0 0 1 0-1.06Z" />
      <path d="M19.4 9.2a.75.75 0 0 1 0 1.06c-.68.68-1.01 1.45-1.01 2.24s.33 1.56 1.01 2.24a.75.75 0 1 1-1.06 1.06c-.95-.95-1.45-2.1-1.45-3.3 0-1.2.5-2.35 1.45-3.3a.75.75 0 0 1 1.06 0Z" />
    </Svg>
  ),
};

interface SymbolIconProps extends IconProps {
  name: SymbolName;
  size?: number | string;
  className?: string;
}

export function SymbolIcon({
  name,
  size = "1em",
  style,
  className,
  ...props
}: SymbolIconProps) {
  const asset = MASKED_SYMBOLS[name];
  if (asset) {
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

  const Icon = icons[name];
  if (!Icon) return null;
  return (
    <Icon
      className={className}
      style={{ width: size, height: size, display: "block", ...style }}
      {...props}
    />
  );
}
