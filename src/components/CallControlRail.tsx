import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MoreHorizontal,
  X,
} from "lucide-react";
import { CallControlButton } from "./CallControlButton";

interface CallControlRailProps {
  videoEnabled: boolean;
  audioEnabled: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onMore: () => void;
  onEnd: () => void;
}

export function CallControlRail({
  videoEnabled,
  audioEnabled,
  onToggleCamera,
  onToggleMic,
  onMore,
  onEnd,
}: CallControlRailProps) {
  return (
    <div className="control-rail" role="toolbar" aria-label="Call controls">
      <CallControlButton
        variant="camera"
        ariaLabel={videoEnabled ? "Turn off camera" : "Turn on camera"}
        title={videoEnabled ? "Turn off camera" : "Turn on camera"}
        pressed={!videoEnabled}
        onClick={onToggleCamera}
      >
        {videoEnabled ? <Camera size={26} /> : <CameraOff size={26} />}
      </CallControlButton>

      <CallControlButton
        variant="mic"
        ariaLabel={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        pressed={!audioEnabled}
        onClick={onToggleMic}
      >
        {audioEnabled ? <Mic size={26} /> : <MicOff size={26} />}
      </CallControlButton>

      <CallControlButton
        variant="more"
        ariaLabel="More options"
        title="More"
        onClick={onMore}
      >
        <MoreHorizontal size={26} />
      </CallControlButton>

      <CallControlButton
        variant="end"
        ariaLabel="End call"
        title="End call"
        onClick={onEnd}
      >
        <X size={32} strokeWidth={2.5} />
      </CallControlButton>
    </div>
  );
}
