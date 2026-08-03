import { Camera, CameraOff, Mic, MicOff, RotateCcw } from "lucide-react";
import type { StatusMessage } from "../lib/callState";
import { hapticTap } from "../lib/haptics";

interface StatusPillProps {
  message: StatusMessage;
  leaving?: boolean;
  onMutedTap?: () => void;
}

function content(message: NonNullable<StatusMessage>) {
  switch (message) {
    case "microphone-muted":
      return {
        icon: <MicOff size={24} />,
        title: "Microphone Muted",
        subtitle: "Tap to Unmute",
        interactive: true,
      };
    case "microphone-unmuted":
      return {
        icon: <Mic size={24} />,
        title: "Microphone Unmuted",
        subtitle: undefined,
        interactive: false,
      };
    case "camera-off":
      return {
        icon: <CameraOff size={24} />,
        title: "Camera Off",
        subtitle: undefined,
        interactive: false,
      };
    case "camera-on":
      return {
        icon: <Camera size={24} />,
        title: "Camera On",
        subtitle: undefined,
        interactive: false,
      };
    case "front-camera":
      return {
        icon: <RotateCcw size={24} />,
        title: "Front Camera",
        subtitle: undefined,
        interactive: false,
      };
    case "back-camera":
      return {
        icon: <RotateCcw size={24} />,
        title: "Back Camera",
        subtitle: undefined,
        interactive: false,
      };
    case "connection-restored":
      return {
        icon: <Camera size={24} />,
        title: "Connection Restored",
        subtitle: undefined,
        interactive: false,
      };
    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}

export function StatusPill({
  message,
  leaving = false,
  onMutedTap,
}: StatusPillProps) {
  if (!message) return null;
  const data = content(message);

  return (
    <button
      type="button"
      className={`status-pill liquidGL ${leaving ? "is-leaving" : ""}`}
      onClick={() => {
        if (data.interactive && onMutedTap) {
          hapticTap();
          onMutedTap();
        }
      }}
      aria-label={data.title}
      title={data.title}
      disabled={!data.interactive}
    >
      <span className="content" style={{ display: "contents" }}>
        <span className="status-pill__icon" aria-hidden>
          {data.icon}
        </span>
        <span className="status-pill__copy">
          <span className="status-pill__title">{data.title}</span>
          {data.subtitle && (
            <span className="status-pill__subtitle">{data.subtitle}</span>
          )}
        </span>
      </span>
    </button>
  );
}
