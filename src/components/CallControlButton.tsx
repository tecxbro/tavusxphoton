import type { ReactNode } from "react";
import { hapticTap } from "../lib/haptics";

/** Control rail button role — End Call skips LiquidGL targeting. */
export type ControlVariant = "camera" | "mic" | "more" | "end";

interface CallControlButtonProps {
  variant: ControlVariant;
  ariaLabel: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  pressed?: boolean;
  disabled?: boolean;
  testId?: string;
  /** Media state for camera/mic — drives the solid surface and symbol color. */
  active?: boolean;
}

/**
 * The button itself is the LiquidGL target and stays one for its full
 * lifetime. Enabled media states paint a solid white surface above the glass;
 * disabling the media fades that surface out so the glass shows through.
 * The End Call button is never a LiquidGL target.
 *
 * @param props.variant - Visual / glass role.
 * @param props.onClick - Tap handler (also fires haptic).
 */
export function CallControlButton({
  variant,
  ariaLabel,
  title,
  onClick,
  children,
  className = "",
  pressed = false,
  disabled = false,
  testId,
  active = true,
}: CallControlButtonProps) {
  const usesGlass = variant !== "end";
  const hasSolidSurface = variant === "camera" || variant === "mic";

  const classes = [
    "control-btn",
    `control-btn--${variant}`,
    usesGlass ? "liquidGL" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      aria-label={ariaLabel}
      title={title}
      aria-pressed={pressed || undefined}
      data-testid={testId}
      data-control={variant}
      data-active={hasSolidSurface ? String(active) : undefined}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        hapticTap();
        onClick();
      }}
    >
      {hasSolidSurface && (
        <span className="control-btn__solid" aria-hidden="true" />
      )}
      <span className="content">{children}</span>
    </button>
  );
}
