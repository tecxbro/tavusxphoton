import { hapticTap } from "../lib/liquidGlass";

interface CaptureButtonProps {
  onClick: () => void;
}

export function CaptureButton({ onClick }: CaptureButtonProps) {
  return (
    <button
      type="button"
      className="capture-btn"
      aria-label="Take FaceTime photo"
      title="Take photo"
      data-testid="capture-button"
      onClick={() => {
        hapticTap();
        onClick();
      }}
    >
      <span className="capture-btn__ring" aria-hidden />
      <span className="capture-btn__disc" aria-hidden />
    </button>
  );
}
