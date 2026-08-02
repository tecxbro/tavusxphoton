import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";

export interface CornerPosition {
  top: number;
  left: number;
}

interface DragState {
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
}

const STORAGE_KEY = "mini-pho-self-view";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nearestCorner(
  left: number,
  top: number,
  width: number,
  height: number,
  bounds: DOMRect,
  endCallSafeBottom: number,
): CornerPosition {
  const pad = 18;
  const safeLeft = pad;
  const safeRight = bounds.width - width - pad;
  const safeTop = pad + 92;
  const safeBottom = Math.max(
    safeTop,
    bounds.height - height - endCallSafeBottom,
  );

  const corners: CornerPosition[] = [
    { left: safeLeft, top: safeTop },
    { left: safeRight, top: safeTop },
    { left: safeLeft, top: safeBottom },
    { left: safeRight, top: safeBottom },
  ];

  let best = corners[1];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const corner of corners) {
    const dx = corner.left - left;
    const dy = corner.top - top;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = corner;
    }
  }
  return best;
}

export function useDraggableSelfView(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const [position, setPosition] = useState<CornerPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<DragState | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CornerPosition;
        if (
          typeof parsed.left === "number" &&
          typeof parsed.top === "number"
        ) {
          setPosition(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((next: CornerPosition) => {
    setPosition(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const node = nodeRef.current;
      const container = containerRef.current;
      if (!node || !container) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = node.getBoundingClientRect();
      const bounds = container.getBoundingClientRect();
      drag.current = {
        startX: event.clientX,
        startY: event.clientY,
        originLeft: rect.left - bounds.left,
        originTop: rect.top - bounds.top,
      };
      setDragging(true);
    },
    [containerRef, enabled],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!drag.current || !containerRef.current || !nodeRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const width = nodeRef.current.offsetWidth;
      const height = nodeRef.current.offsetHeight;
      const dx = event.clientX - drag.current.startX;
      const dy = event.clientY - drag.current.startY;
      const left = clamp(
        drag.current.originLeft + dx,
        8,
        bounds.width - width - 8,
      );
      const top = clamp(
        drag.current.originTop + dy,
        8,
        bounds.height - height - 100,
      );
      setPosition({ left, top });
    },
    [containerRef],
  );

  const onPointerUp = useCallback(() => {
    if (!drag.current || !containerRef.current || !nodeRef.current) {
      setDragging(false);
      drag.current = null;
      return;
    }
    const bounds = containerRef.current.getBoundingClientRect();
    const width = nodeRef.current.offsetWidth;
    const height = nodeRef.current.offsetHeight;
    const current = position ?? {
      left: bounds.width - width - 18,
      top: 92,
    };
    const snapped = nearestCorner(
      current.left,
      current.top,
      width,
      height,
      bounds,
      120,
    );
    persist(snapped);
    setDragging(false);
    drag.current = null;
  }, [containerRef, persist, position]);

  useEffect(() => {
    if (!enabled || !containerRef.current || !nodeRef.current || !position) {
      return;
    }
    const bounds = containerRef.current.getBoundingClientRect();
    const width = nodeRef.current.offsetWidth;
    const height = nodeRef.current.offsetHeight;
    const snapped = nearestCorner(
      position.left,
      position.top,
      width,
      height,
      bounds,
      120,
    );
    if (snapped.left !== position.left || snapped.top !== position.top) {
      persist(snapped);
    }
  }, [containerRef, enabled, persist, position]);

  return {
    nodeRef,
    position,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
