import { useCallback, useEffect, useRef, useState } from "react";
import { AUTO_HIDE_MS } from "../lib/callState";

export function useAutoHideControls(
  active: boolean,
  keepVisible: boolean,
  delayMs = AUTO_HIDE_MS,
) {
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    setVisible(true);
    clear();
    if (!active || keepVisible || paused) return;
    timer.current = window.setTimeout(() => {
      setVisible(false);
    }, delayMs);
  }, [active, clear, delayMs, keepVisible, paused]);

  const hide = useCallback(() => {
    if (keepVisible || paused) return;
    clear();
    setVisible(false);
  }, [clear, keepVisible, paused]);

  const pause = useCallback(() => {
    setPaused(true);
    clear();
    setVisible(true);
  }, [clear]);

  const resume = useCallback(() => {
    setPaused(false);
  }, []);

  useEffect(() => {
    if (!active) {
      clear();
      setVisible(true);
      return;
    }
    if (keepVisible || paused) {
      clear();
      setVisible(true);
      return;
    }
    show();
    return clear;
  }, [active, clear, keepVisible, paused, show]);

  useEffect(() => clear, [clear]);

  return { visible, show, hide, bump: show, pause, resume, paused };
}
