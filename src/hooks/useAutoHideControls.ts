import { useCallback, useEffect, useRef, useState } from "react";
import { AUTO_HIDE_MS } from "../lib/callState";

/**
 * Auto-hides live call chrome after idle. Pausing keeps chrome visible
 * (e.g. while dragging the self-view).
 *
 * @param active - When false, chrome stays visible and timers clear.
 * @param keepVisible - Force-visible override (error / sheets).
 * @param delayMs - Hide delay; defaults to {@link AUTO_HIDE_MS}.
 * @returns Visibility flag plus show/hide/pause/resume helpers.
 */
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
