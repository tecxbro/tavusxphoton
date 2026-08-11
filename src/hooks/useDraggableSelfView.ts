import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  SELF_VIEW_LAYOUT,
  type SafeInsets,
} from "../lib/callUi";

/**
 * Pixel position for the self-view tile. Recomputed from a saved corner name —
 * never persisted as raw coordinates.
 */
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

export interface DragOptions {
  /** Recalculate saved-corner positions on resize / compact changes. */
  active: boolean;
  /** Attach pointer handlers for user dragging. */
  draggable: boolean;
  compact: boolean;
  safeInsets: SafeInsets;
}

const STORAGE_KEY = "mini-pho-self-view";
const ZERO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

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

function layoutBounds(
  width: number,
  height: number,
  bounds: DOMRect,
  compact: boolean,
  safeInsets: SafeInsets,
): { safeLeft: number; safeRight: number; safeTop: number; safeBottom: number } {
  const leftPad = SELF_VIEW_LAYOUT.leftInset + safeInsets.left;
  const rightPad = SELF_VIEW_LAYOUT.rightInset + safeInsets.right;
  const topExpanded = SELF_VIEW_LAYOUT.expandedTopOffset + safeInsets.top;
  const topCompact = SELF_VIEW_LAYOUT.compactTopOffset + safeInsets.top;
  const railReserve = compact ? 24 : 280;

  const safeLeft = leftPad;
  const safeRight = Math.max(safeLeft, bounds.width - width - rightPad);
  const safeTop = compact ? topCompact : topExpanded;
  const safeBottom = Math.max(
    safeTop,
    bounds.height - height - railReserve - safeInsets.bottom,
  );

  return { safeLeft, safeRight, safeTop, safeBottom };
}

function anchors(
  width: number,
  height: number,
  bounds: DOMRect,
  compact: boolean,
  safeInsets: SafeInsets,
): Record<SelfViewCorner, CornerPosition> {
  const { safeLeft, safeRight, safeTop, safeBottom } = layoutBounds(
    width,
    height,
    bounds,
    compact,
    safeInsets,
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
  safeInsets: SafeInsets,
): { corner: SelfViewCorner; position: CornerPosition } {
  const corners = anchors(width, height, bounds, compact, safeInsets);
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

function defaultPosition(
  width: number,
  height: number,
  bounds: DOMRect,
  compact: boolean,
  safeInsets: SafeInsets,
): CornerPosition {
  return anchors(width, height, bounds, compact, safeInsets)["top-right"];
}

/**
 * Draggable self-view that snaps to corners. Persists a corner name in
 * `sessionStorage` (`mini-pho-self-view`), not pixel coordinates.
 *
 * @param containerRef - Call screen root used for layout bounds.
 * @param options - Active/draggable/compact flags and safe-area insets.
 * @returns Node ref, pixel style, drag handlers, and dragging flag.
 */
export function useDraggableSelfView(
  containerRef: RefObject<HTMLElement | null>,
  options: DragOptions,
) {
  const {
    active,
    draggable,
    compact,
    safeInsets = ZERO_INSETS,
  } = options;
  const [corner, setCorner] = useState<SelfViewCorner | null>(null);
  const [position, setPosition] = useState<CornerPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const [boundsVersion, setBoundsVersion] = useState(0);
  const drag = useRef<DragState | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const livePosition = useRef<CornerPosition | null>(null);
  const moveFrame = useRef<number | null>(null);
  const positionRef = useRef<CornerPosition | null>(null);
  const safeInsetsRef = useRef(safeInsets);
  const compactRef = useRef(compact);

  positionRef.current = position;
  safeInsetsRef.current = safeInsets;
  compactRef.current = compact;

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
      if (!draggable) return;
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
    [containerRef, draggable],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!drag.current || !containerRef.current || !nodeRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const width = nodeRef.current.offsetWidth;
      const height = nodeRef.current.offsetHeight;
      const edges = layoutBounds(
        width,
        height,
        bounds,
        compactRef.current,
        safeInsetsRef.current,
      );
      const dx = event.clientX - drag.current.startX;
      const dy = event.clientY - drag.current.startY;
      const left = clamp(
        drag.current.originLeft + dx,
        edges.safeLeft,
        edges.safeRight,
      );
      const top = clamp(
        drag.current.originTop + dy,
        edges.safeTop,
        edges.safeBottom,
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
    const insets = safeInsetsRef.current;
    const isCompact = compactRef.current;
    const current =
      livePosition.current ??
      defaultPosition(width, height, bounds, isCompact, insets);
    const snapped = nearestCorner(
      current.left,
      current.top,
      width,
      height,
      bounds,
      isCompact,
      insets,
    );
    if (nodeRef.current) {
      nodeRef.current.style.transform = "";
    }
    persist(snapped.corner, snapped.position);
    setDragging(false);
    drag.current = null;
    livePosition.current = null;
  }, [clearMoveFrame, containerRef, persist]);

  useEffect(() => {
    if (
      !active ||
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

    const nextPosition = anchors(
      width,
      height,
      bounds,
      compact,
      safeInsets,
    )[corner];
    if (
      !positionRef.current ||
      nextPosition.left !== positionRef.current.left ||
      nextPosition.top !== positionRef.current.top
    ) {
      setPosition(nextPosition);
      positionRef.current = nextPosition;
    }
  }, [active, boundsVersion, compact, containerRef, corner, safeInsets]);

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
