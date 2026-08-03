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
  return (
    <div className="control-rail" role="toolbar" aria-label="Call controls">
      <CallControlButton
        variant="camera"
        ariaLabel={videoEnabled ? "Turn off camera" : "Turn on camera"}
        title={videoEnabled ? "Turn off camera" : "Turn on camera"}
        pressed={!videoEnabled}
        onClick={onToggleCamera}
        testId="toggle-camera"
      >
        <span className="symbol-swap" data-off={!videoEnabled || undefined}>
          <SymbolIcon
            name={videoEnabled ? "video.fill" : "video.slash.fill"}
            size={30}
            className={videoEnabled ? "symbol-on" : "symbol-off"}
          />
        </span>
      </CallControlButton>

      <CallControlButton
        variant="mic"
        ariaLabel={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        pressed={!audioEnabled}
        onClick={onToggleMic}
        testId="toggle-mic"
      >
        <span className="symbol-swap" data-off={!audioEnabled || undefined}>
          <SymbolIcon
            name={audioEnabled ? "mic.fill" : "mic.slash.fill"}
            size={30}
            className={audioEnabled ? "symbol-on" : "symbol-off"}
          />
        </span>
      </CallControlButton>

      <div className="glass-control glass-control--more">
        <span
          className="glass-control__lens liquidGL"
          data-glass-shape="circle"
          aria-hidden="true"
        />

        <button
          type="button"
          className="control-btn control-btn--more glass-control__action"
          aria-label="More options"
          title="More options"
          data-testid="more-button"
          disabled
        >
          <span className="content">
            <SymbolIcon name="ellipsis" size={28} />
          </span>
        </button>
      </div>

      <CallControlButton
        variant="end"
        ariaLabel="End call"
        title="End call"
        onClick={onEnd}
        testId="end-call"
      >
        <SymbolIcon name="xmark" size={32} />
      </CallControlButton>
    </div>
  );
}
