import { useEffect, useRef, useState } from "react";
import type { SafeInsets } from "../lib/callUi";

export interface SafeViewport {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  /** Raw env(safe-area-inset-*) values from the host. */
  nativeInsets: SafeInsets;
  /** Native insets with the Spectrum/iPhone top fallback when needed. */
  safeInsets: SafeInsets;
}

const ZERO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const IPHONE_TOP_FALLBACK_PX = 47;

function parseCssPx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readNativeInsets(): SafeInsets {
  if (typeof document === "undefined") return ZERO_INSETS;

  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:fixed",
    "visibility:hidden",
    "pointer-events:none",
    "padding-top:env(safe-area-inset-top, 0px)",
    "padding-right:env(safe-area-inset-right, 0px)",
    "padding-bottom:env(safe-area-inset-bottom, 0px)",
    "padding-left:env(safe-area-inset-left, 0px)",
  ].join(";");
  document.documentElement.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets: SafeInsets = {
    top: parseCssPx(style.paddingTop),
    right: parseCssPx(style.paddingRight),
    bottom: parseCssPx(style.paddingBottom),
    left: parseCssPx(style.paddingLeft),
  };
  probe.remove();
  return insets;
}

/**
 * Spectrum/iMessage hosts on iPhone often report 0 for safe-area-inset-top in
 * fullscreen webviews. Prefer native insets; only apply the 47px fallback in
 * that known portrait phone host mode — never on desktop or in landscape.
 */
export function shouldApplyIphoneTopFallback(
  nativeTop: number,
  options: {
    userAgent: string;
    coarsePointer: boolean;
    landscape: boolean;
  } = {
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    coarsePointer:
      typeof window === "undefined"
        ? false
        : window.matchMedia("(pointer: coarse)").matches,
    landscape:
      typeof window === "undefined"
        ? false
        : window.matchMedia("(orientation: landscape)").matches,
  },
): boolean {
  if (nativeTop > 0) return false;
  if (options.landscape) return false;
  if (!options.coarsePointer) return false;
  // iPhone/iPod only — do not treat desktop Safari or iPad as this host mode.
  return /iPhone|iPod/.test(options.userAgent);
}

export function effectiveSafeInsets(native: SafeInsets): SafeInsets {
  if (!shouldApplyIphoneTopFallback(native.top)) {
    return native;
  }
  return { ...native, top: IPHONE_TOP_FALLBACK_PX };
}

function readViewport(): SafeViewport {
  const vv = window.visualViewport;
  const nativeInsets = readNativeInsets();
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    offsetTop: vv?.offsetTop ?? 0,
    offsetLeft: vv?.offsetLeft ?? 0,
    nativeInsets,
    safeInsets: effectiveSafeInsets(nativeInsets),
  };
}

function insetsEqual(a: SafeInsets, b: SafeInsets): boolean {
  return (
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom &&
    a.left === b.left
  );
}

function applySafeInsetCss(insets: SafeInsets): void {
  const root = document.documentElement.style;
  root.setProperty("--safe-top", `${insets.top}px`);
  root.setProperty("--safe-right", `${insets.right}px`);
  root.setProperty("--safe-bottom", `${insets.bottom}px`);
  root.setProperty("--safe-left", `${insets.left}px`);
}

const SSR_VIEWPORT: SafeViewport = {
  width: 393,
  height: 852,
  offsetTop: 0,
  offsetLeft: 0,
  nativeInsets: ZERO_INSETS,
  safeInsets: { ...ZERO_INSETS, top: IPHONE_TOP_FALLBACK_PX },
};

export function useSafeViewport() {
  const [viewport, setViewport] = useState<SafeViewport>(() =>
    typeof window === "undefined" ? SSR_VIEWPORT : readViewport(),
  );
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const schedule = () => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const next = readViewport();
        setViewport((current) =>
          current.width === next.width &&
          current.height === next.height &&
          current.offsetTop === next.offsetTop &&
          current.offsetLeft === next.offsetLeft &&
          insetsEqual(current.nativeInsets, next.nativeInsets) &&
          insetsEqual(current.safeInsets, next.safeInsets)
            ? current
            : next,
        );
        document.documentElement.style.setProperty(
          "--vv-width",
          `${next.width}px`,
        );
        document.documentElement.style.setProperty(
          "--vv-height",
          `${next.height}px`,
        );
        applySafeInsetCss(next.safeInsets);
      });
    };

    schedule();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, []);

  return viewport;
}
