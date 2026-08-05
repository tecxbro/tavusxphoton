import { useRef, type CSSProperties } from "react";
import { useLayoutMorph } from "../hooks/useLayoutMorph";
import type { LocalCameraMode } from "./LocalCameraSurface";
import { SymbolIcon } from "./SymbolIcon";

interface SelfViewControlsOverlayProps {
  mode: LocalCameraMode;
  style?: CSSProperties;
  morphDurationMs: number;
  flipVisible: boolean;
  flipDisabled?: boolean;
  onFlip: () => void;
}

/**
 * Transparent overlay that shares the self-view's geometry and FLIP morph so
 * the in-PIP Flip pill tracks the surface without DOMRect snapshots.
 */
export function SelfViewControlsOverlay({
  mode,
  style,
  morphDurationMs,
  flipVisible,
  flipDisabled = false,
  onFlip,
}: SelfViewControlsOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useLayoutMorph(overlayRef, mode, morphDurationMs);

  return (
    <div
      ref={overlayRef}
      className="self-view-controls-overlay"
      data-mode={mode}
      data-testid="self-view-controls-overlay"
      style={style}
      aria-hidden={!flipVisible}
    >
      <button
        type="button"
        className="self-flip-capsule liquidGL"
        data-visible={flipVisible}
        aria-hidden={!flipVisible}
        aria-label="Flip camera"
        title="Flip camera"
        disabled={flipDisabled || !flipVisible}
        onClick={onFlip}
        data-testid="self-flip"
        tabIndex={flipVisible && !flipDisabled ? 0 : -1}
      >
        <span className="content self-flip-capsule__content">
          <SymbolIcon name="flip-camera" size={13} />
          <span>Flip</span>
        </span>
      </button>
    </div>
  );
}
