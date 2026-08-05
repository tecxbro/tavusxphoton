import type { CSSProperties, RefObject } from "react";
import type { LocalCameraMode } from "./LocalCameraSurface";
import { SymbolIcon } from "./SymbolIcon";

interface SelfViewControlsOverlayProps {
  mode: LocalCameraMode;
  style?: CSSProperties;
  /** Forwarded to the moving root — CallScreen owns the shared FLIP morph. */
  overlayRef: RefObject<HTMLDivElement | null>;
  flipVisible: boolean;
  flipDisabled?: boolean;
  onFlip: () => void;
}

/**
 * Transparent overlay that shares the self-view's geometry. CallScreen drives
 * one shared FLIP morph with the local camera surface as primary and this
 * overlay as follower (kept outside #liquid-gl-snapshot).
 */
export function SelfViewControlsOverlay({
  mode,
  style,
  overlayRef,
  flipVisible,
  flipDisabled = false,
  onFlip,
}: SelfViewControlsOverlayProps) {
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
