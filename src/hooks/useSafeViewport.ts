import { useEffect, useState } from "react";

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

  useEffect(() => {
    const apply = () => {
      const next = readViewport();
      setViewport(next);
      document.documentElement.style.setProperty(
        "--vv-width",
        `${next.width}px`,
      );
      document.documentElement.style.setProperty(
        "--vv-height",
        `${next.height}px`,
      );
    };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return viewport;
}
