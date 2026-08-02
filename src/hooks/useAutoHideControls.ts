import { useCallback, useEffect, useRef, useState } from "react";
import { AUTO_HIDE_MS } from "../lib/callState";

export function useAutoHideControls(
  active: boolean,
  keepVisible: boolean,
  delayMs = AUTO_HIDE_MS,
) {
  const [visible, setVisible] = useState(true);
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
    if (!active || keepVisible) return;
    timer.current = window.setTimeout(() => {
      setVisible(false);
    }, delayMs);
  }, [active, clear, delayMs, keepVisible]);

  const hide = useCallback(() => {
    if (keepVisible) return;
    clear();
    setVisible(false);
  }, [clear, keepVisible]);

  useEffect(() => {
    if (!active) {
      clear();
      setVisible(true);
      return;
    }
    if (keepVisible) {
      clear();
      setVisible(true);
      return;
    }
    show();
    return clear;
  }, [active, clear, keepVisible, show]);

  useEffect(() => clear, [clear]);

  return { visible, show, hide, bump: show };
}
