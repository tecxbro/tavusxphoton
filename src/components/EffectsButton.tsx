import { SymbolIcon } from "./SymbolIcon";

export function EffectsButton() {
  return (
    <div
      className="effects-btn"
      aria-hidden="true"
      data-testid="aperture-button"
    >
      <span
        className="effects-btn__lens liquidGL"
        data-glass-shape="circle"
      />
      <span className="effects-btn__content">
        <SymbolIcon name="effects" size={27} />
      </span>
    </div>
  );
}
