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

interface DragOptions {
  compact?: boolean;
}

const STORAGE_KEY = "mini-pho-self-view";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function anchors(
  width: number,
  height: number,
  bounds: DOMRect,
  compact: boolean,
): CornerPosition[] {
  const rightPad = 24;
  const leftPad = 18;
  const topExpanded = 68;
  const topCompact = 18;
  const railReserve = compact ? 24 : 280;
  const safeLeft = leftPad;
  const safeRight = bounds.width - width - rightPad;
  const safeTop = (compact ? topCompact : topExpanded) + 8;
  const safeBottom = Math.max(
    safeTop,
    bounds.height - height - railReserve,
  );

  return [
    { left: safeLeft, top: safeTop },
    { left: safeRight, top: safeTop },
    { left: safeLeft, top: safeBottom },
    { left: safeRight, top: safeBottom },
  ];
}

function nearestCorner(
  left: number,
  top: number,
  width: number,
  height: number,
  bounds: DOMRect,
  compact: boolean,
): CornerPosition {
  const corners = anchors(width, height, bounds, compact);
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
  options: DragOptions = {},
) {
  const compact = options.compact ?? false;
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
      left: bounds.width - width - 24,
      top: compact ? 18 : 68,
    };
    const snapped = nearestCorner(
      current.left,
      current.top,
      width,
      height,
      bounds,
      compact,
    );
    persist(snapped);
    setDragging(false);
    drag.current = null;
  }, [compact, containerRef, persist, position]);

  useEffect(() => {
    if (!enabled || !containerRef.current || !nodeRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const width = nodeRef.current.offsetWidth;
    const height = nodeRef.current.offsetHeight;
    if (width <= 0 || height <= 0) return;
    const current = position ?? {
      left: bounds.width - width - 24,
      top: compact ? 18 : 68,
    };
    const snapped = nearestCorner(
      current.left,
      current.top,
      width,
      height,
      bounds,
      compact,
    );
    if (
      !position ||
      snapped.left !== position.left ||
      snapped.top !== position.top
    ) {
      persist(snapped);
    }
  }, [compact, containerRef, enabled, persist, position]);

  return {
    nodeRef,
    position,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
