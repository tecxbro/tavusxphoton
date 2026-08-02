import type { CSSProperties, PointerEvent, RefObject } from "react";
import { CameraOff } from "lucide-react";
import { getInitials } from "../lib/callState";

interface SelfViewProps {
  stream: MediaStream | null;
  videoEnabled: boolean;
  mirrored: boolean;
  participantName: string;
  style?: CSSProperties;
  nodeRef: RefObject<HTMLDivElement | null>;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
}

export function SelfView({
  stream,
  videoEnabled,
  mirrored,
  participantName,
  style,
  nodeRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: SelfViewProps) {
  return (
    <div
      ref={nodeRef}
      className={`self-view ${mirrored ? "is-mirrored" : ""}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="group"
      aria-label="Self view"
      data-testid="self-view"
    >
      {stream && videoEnabled ? (
        <video
          ref={(el) => {
            if (el && stream && el.srcObject !== stream) {
              el.srcObject = stream;
            }
          }}
          autoPlay
          playsInline
          muted
        />
      ) : (
        <div className="self-view__placeholder">
          <span className="self-view__initials">
            {getInitials(participantName)}
          </span>
          <CameraOff size={20} aria-hidden />
          <span className="sr-only">Camera off</span>
        </div>
      )}
    </div>
  );
}
