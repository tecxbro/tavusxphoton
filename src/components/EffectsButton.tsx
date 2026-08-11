import { SymbolIcon } from "./SymbolIcon";

/** Decorative aperture control — not interactive; LiquidGL target only. */
export function EffectsButton() {
  return (
    <div
      className="effects-btn liquidGL"
      aria-hidden="true"
      data-testid="aperture-button"
    >
      <span className="content effects-btn__content">
        <SymbolIcon name="effects" />
      </span>
    </div>
  );
}
