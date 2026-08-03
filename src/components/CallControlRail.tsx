import { SymbolIcon } from "./SymbolIcon";
import { CallControlButton } from "./CallControlButton";

interface CallControlRailProps {
  videoEnabled: boolean;
  audioEnabled: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onEnd: () => void;
}

export function CallControlRail({
  videoEnabled,
  audioEnabled,
  onToggleCamera,
  onToggleMic,
  onEnd,
}: CallControlRailProps) {
  const cameraSymbol = videoEnabled ? "camera-on" : "camera-off";
  const micSymbol = audioEnabled ? "microphone-on" : "microphone-off";

  return (
    <div className="control-rail" role="toolbar" aria-label="Call controls">
      <CallControlButton
        variant="camera"
        ariaLabel={videoEnabled ? "Turn off camera" : "Turn on camera"}
        title={videoEnabled ? "Turn off camera" : "Turn on camera"}
        pressed={!videoEnabled}
        active={videoEnabled}
        onClick={onToggleCamera}
        testId="toggle-camera"
      >
        <SymbolIcon key={cameraSymbol} name={cameraSymbol} />
      </CallControlButton>

      <CallControlButton
        variant="mic"
        ariaLabel={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        pressed={!audioEnabled}
        active={audioEnabled}
        onClick={onToggleMic}
        testId="toggle-mic"
      >
        <SymbolIcon key={micSymbol} name={micSymbol} />
      </CallControlButton>

      <CallControlButton
        variant="more"
        ariaLabel="More options"
        title="More options"
        onClick={() => undefined}
        testId="more-button"
        disabled
      >
        <SymbolIcon name="more" />
      </CallControlButton>

      <CallControlButton
        variant="end"
        ariaLabel="End call"
        title="End call"
        onClick={onEnd}
        testId="end-call"
      >
        <SymbolIcon name="end-call" />
      </CallControlButton>
    </div>
  );
}
