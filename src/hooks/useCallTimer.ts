import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "../lib/callState";

export function useCallTimer(running: boolean) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (startedAt.current == null) return;
    setElapsedMs(performance.now() - startedAt.current);
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (running) {
      if (startedAt.current == null) {
        startedAt.current = performance.now();
      }
      raf.current = requestAnimationFrame(tick);
    } else if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [running, tick]);

  const reset = useCallback(() => {
    startedAt.current = null;
    setElapsedMs(0);
  }, []);

  const stop = useCallback(() => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  }, []);

  return {
    elapsedMs,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    formatted: formatDuration(elapsedMs / 1000),
    reset,
    stop,
  };
}
