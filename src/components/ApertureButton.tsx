import { SymbolIcon } from "./SymbolIcon";

export function ApertureButton() {
  return (
    <div
      className="aperture-btn liquidGL"
      aria-hidden="true"
      data-testid="aperture-button"
    >
      <span className="content">
        <SymbolIcon name="aperture" size={22} />
      </span>
    </div>
  );
}
