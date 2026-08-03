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

type SelfViewCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

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

// Persist corner names only — pixel coords go stale across resize / chrome hide.
const VALID_CORNERS: ReadonlySet<string> = new Set([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function anchors(
  width: number,
  height: number,
  bounds: DOMRect,
  compact: boolean,
): Record<SelfViewCorner, CornerPosition> {
  const rightPad = 24;
  const leftPad = 18;
  const topExpanded = 68;
  const topCompact = 18;
  const railReserve = compact ? 24 : 280;

  const safeLeft = leftPad;
  const safeRight = bounds.width - width - rightPad;
  const safeTop = compact ? topCompact : topExpanded;
  const safeBottom = Math.max(
    safeTop,
    bounds.height - height - railReserve,
  );

  return {
    "top-left": {
      left: safeLeft,
      top: safeTop,
    },
    "top-right": {
      left: safeRight,
      top: safeTop,
    },
    "bottom-left": {
      left: safeLeft,
      top: safeBottom,
    },
    "bottom-right": {
      left: safeRight,
      top: safeBottom,
    },
  };
}

function nearestCorner(
  left: number,
  top: number,
  width: number,
  height: number,
  bounds: DOMRect,
  compact: boolean,
): { corner: SelfViewCorner; position: CornerPosition } {
  const corners = anchors(width, height, bounds, compact);
  let bestCorner: SelfViewCorner = "top-right";
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [name, position] of Object.entries(corners) as Array<
    [SelfViewCorner, CornerPosition]
  >) {
    const dx = position.left - left;
    const dy = position.top - top;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestCorner = name;
    }
  }
  return {
    corner: bestCorner,
    position: corners[bestCorner],
  };
}

export function useDraggableSelfView(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  options: DragOptions = {},
) {
  const compact = options.compact ?? false;
  const [corner, setCorner] = useState<SelfViewCorner | null>(null);
  const [position, setPosition] = useState<CornerPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const [boundsVersion, setBoundsVersion] = useState(0);
  const drag = useRef<DragState | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const livePosition = useRef<CornerPosition | null>(null);
  const moveFrame = useRef<number | null>(null);
  const positionRef = useRef<CornerPosition | null>(null);

  positionRef.current = position;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === "string" && VALID_CORNERS.has(parsed)) {
        setCorner(parsed as SelfViewCorner);
        return;
      }
      // Drop legacy pixel payloads or corrupt values so layout recomputes cleanly.
      sessionStorage.removeItem(STORAGE_KEY);
      setCorner(null);
      setPosition(null);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      setCorner(null);
      setPosition(null);
    }
  }, []);

  useEffect(() => {
    const bump = () => setBoundsVersion((value) => value + 1);
    window.addEventListener("resize", bump);
    window.visualViewport?.addEventListener("resize", bump);
    return () => {
      window.removeEventListener("resize", bump);
      window.visualViewport?.removeEventListener("resize", bump);
    };
  }, []);

  const persist = useCallback(
    (nextCorner: SelfViewCorner, nextPosition: CornerPosition) => {
      setCorner(nextCorner);
      setPosition(nextPosition);
      positionRef.current = nextPosition;

      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextCorner));
      } catch {
        // ignore
      }
    },
    [],
  );

  const clearMoveFrame = useCallback(() => {
    if (moveFrame.current != null) {
      cancelAnimationFrame(moveFrame.current);
      moveFrame.current = null;
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
      const originLeft = rect.left - bounds.left;
      const originTop = rect.top - bounds.top;
      drag.current = {
        startX: event.clientX,
        startY: event.clientY,
        originLeft,
        originTop,
      };
      livePosition.current = { left: originLeft, top: originTop };
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
      livePosition.current = { left, top };

      if (moveFrame.current !== null) return;
      moveFrame.current = requestAnimationFrame(() => {
        moveFrame.current = null;
        const node = nodeRef.current;
        const live = livePosition.current;
        if (!node || !live) return;
        const committed = positionRef.current ?? {
          left: drag.current?.originLeft ?? live.left,
          top: drag.current?.originTop ?? live.top,
        };
        node.style.transform = `translate3d(${live.left - committed.left}px, ${live.top - committed.top}px, 0)`;
      });
    },
    [containerRef],
  );

  const onPointerUp = useCallback(() => {
    clearMoveFrame();
    if (!drag.current || !containerRef.current || !nodeRef.current) {
      setDragging(false);
      drag.current = null;
      livePosition.current = null;
      return;
    }
    const bounds = containerRef.current.getBoundingClientRect();
    const width = nodeRef.current.offsetWidth;
    const height = nodeRef.current.offsetHeight;
    const current = livePosition.current ?? {
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
    if (nodeRef.current) {
      nodeRef.current.style.transform = "";
    }
    persist(snapped.corner, snapped.position);
    setDragging(false);
    drag.current = null;
    livePosition.current = null;
  }, [clearMoveFrame, compact, containerRef, persist]);

  useEffect(() => {
    if (
      !enabled ||
      !corner ||
      !containerRef.current ||
      !nodeRef.current
    ) {
      return;
    }
    const bounds = containerRef.current.getBoundingClientRect();
    const width = nodeRef.current.offsetWidth;
    const height = nodeRef.current.offsetHeight;
    if (width <= 0 || height <= 0) return;

    const nextPosition = anchors(width, height, bounds, compact)[corner];
    if (
      !positionRef.current ||
      nextPosition.left !== positionRef.current.left ||
      nextPosition.top !== positionRef.current.top
    ) {
      setPosition(nextPosition);
      positionRef.current = nextPosition;
    }
  }, [boundsVersion, compact, containerRef, corner, enabled]);

  useEffect(() => () => clearMoveFrame(), [clearMoveFrame]);

  return {
    nodeRef,
    position,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
