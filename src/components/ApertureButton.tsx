import { hapticTap } from "../lib/liquidGlass";
import { SymbolIcon } from "./SymbolIcon";

interface ApertureButtonProps {
  onClick?: () => void;
}

export function ApertureButton({ onClick }: ApertureButtonProps) {
  return (
    <button
      type="button"
      className="aperture-btn liquidGL"
      aria-label="Effects"
      title="Effects"
      data-testid="aperture-button"
      onClick={() => {
        hapticTap();
        onClick?.();
      }}
    >
      <span className="content">
        <SymbolIcon name="aperture" size={22} />
      </span>
    </button>
  );
}
