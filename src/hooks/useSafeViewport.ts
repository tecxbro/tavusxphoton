import { useEffect, useRef, useState } from "react";

export interface SafeViewport {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
}

function readViewport(): SafeViewport {
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    offsetTop: vv?.offsetTop ?? 0,
    offsetLeft: vv?.offsetLeft ?? 0,
  };
}

export function useSafeViewport() {
  const [viewport, setViewport] = useState<SafeViewport>(() =>
    typeof window === "undefined"
      ? { width: 393, height: 852, offsetTop: 0, offsetLeft: 0 }
      : readViewport(),
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
          current.offsetLeft === next.offsetLeft
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
