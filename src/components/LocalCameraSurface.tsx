import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from "react";
import { getInitials } from "../lib/callState";

/** Self-view layout mode driven by call phase and chrome visibility. */
export type LocalCameraMode = "fullscreen" | "expanded" | "compact";

interface LocalCameraSurfaceProps {
  stream: MediaStream | null;
  videoEnabled: boolean;
  mirrored: boolean;
  mode: LocalCameraMode;
  selfName: string;
  selfAvatar?: string;
  style?: CSSProperties;
  /** Forwarded to the moving root — CallScreen owns the shared FLIP morph. */
  nodeRef: RefObject<HTMLDivElement | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  draggable?: boolean;
}

/**
 * Local camera `<video>` + placeholder. Stays mounted during active phases
 * (even when camera-off) so LiquidGL snapshot structure does not remount.
 */
export function LocalCameraSurface({
  stream,
  videoEnabled,
  mirrored,
  mode,
  selfName,
  selfAvatar,
  style,
  nodeRef,
  videoRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  draggable = false,
}: LocalCameraSurfaceProps) {
  const innerVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = innerVideoRef.current;
    if (!element) return;

    element.srcObject = stream;
    if (stream) void element.play().catch(() => undefined);

    return () => {
      if (element.srcObject === stream) {
        element.pause();
        element.srcObject = null;
      }
    };
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
        // When camera is off, ignore this node in LiquidGL live blits so the
        // last frame is not frozen into the glass after the placeholder shows.
        data-liquid-ignore={videoEnabled ? undefined : ""}
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
    </div>
  );
}
