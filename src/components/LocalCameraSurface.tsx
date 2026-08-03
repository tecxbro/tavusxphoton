import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from "react";
import { getInitials } from "../lib/callState";
import { useLayoutMorph } from "../hooks/useLayoutMorph";
import { hapticTap } from "../lib/liquidGlass";
import { SymbolIcon } from "./SymbolIcon";

export type LocalCameraMode = "fullscreen" | "expanded" | "compact";

interface LocalCameraSurfaceProps {
  stream: MediaStream | null;
  videoEnabled: boolean;
  mirrored: boolean;
  mode: LocalCameraMode;
  selfName: string;
  selfAvatar?: string;
  showFlipCapsule: boolean;
  style?: CSSProperties;
  nodeRef: RefObject<HTMLDivElement | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
  onFlip?: () => void;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  draggable?: boolean;
}

export function LocalCameraSurface({
  stream,
  videoEnabled,
  mirrored,
  mode,
  selfName,
  selfAvatar,
  showFlipCapsule,
  style,
  nodeRef,
  videoRef,
  onFlip,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  draggable = false,
}: LocalCameraSurfaceProps) {
  const innerVideoRef = useRef<HTMLVideoElement | null>(null);
  useLayoutMorph(nodeRef, mode);

  useEffect(() => {
    const el = innerVideoRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    void el.play().catch(() => undefined);
  }, [stream]);

  const setVideoNode = (el: HTMLVideoElement | null) => {
    innerVideoRef.current = el;
    if (videoRef) {
      videoRef.current = el;
    }
  };

  return (
    <div
      ref={nodeRef}
      className={`local-camera-surface ${mirrored ? "is-mirrored" : ""}`}
      data-mode={mode}
      data-camera={videoEnabled ? "on" : "off"}
      style={style}
      onPointerDown={draggable ? onPointerDown : undefined}
      onPointerMove={draggable ? onPointerMove : undefined}
      onPointerUp={draggable ? onPointerUp : undefined}
      onPointerCancel={draggable ? onPointerUp : undefined}
      role="group"
      aria-label="Self view"
      data-testid="local-camera-surface"
    >
      <video
        ref={setVideoNode}
        className="local-camera-surface__video"
        autoPlay
        playsInline
        muted
        data-testid="local-video"
      />

      <div className="local-camera-surface__placeholder" aria-hidden={videoEnabled}>
        <div className="local-camera-surface__avatar">
          {selfAvatar ? (
            <img src={selfAvatar} alt="" />
          ) : (
            <span>{getInitials(selfName)}</span>
          )}
        </div>
      </div>

      {showFlipCapsule && mode === "expanded" && videoEnabled && (
        <button
          type="button"
          className="self-flip-capsule liquidGL"
          aria-label="Flip camera"
          data-testid="self-flip"
          onClick={(event) => {
            event.stopPropagation();
            hapticTap();
            onFlip?.();
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="content self-flip-capsule__content">
            <SymbolIcon name="camera.rotate" size={16} />
            <span>Flip</span>
          </span>
        </button>
      )}
    </div>
  );
}
