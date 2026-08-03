export function EffectsButton() {
  return (
    <div
      className="effects-btn liquidGL"
      data-glass-shape="circle"
      aria-hidden="true"
      data-testid="aperture-button"
    >
      <span className="content effects-btn__content">
        <span className="effects-btn__glyph">ƒ</span>
      </span>
    </div>
  );
}
