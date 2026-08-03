import type { ReactNode } from "react";
import { hapticTap } from "../lib/haptics";

export type ControlVariant = "camera" | "mic" | "more" | "end" | "glass";

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
}

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
}: CallControlButtonProps) {
  const variantClass =
    variant === "camera"
      ? "control-btn--camera"
      : variant === "mic"
        ? "control-btn--mic"
        : variant === "more"
          ? "control-btn--more liquidGL"
          : variant === "end"
            ? "control-btn--end"
            : "liquidGL";

  return (
    <button
      type="button"
      className={`control-btn ${variantClass} ${className}`.trim()}
      aria-label={ariaLabel}
      title={title}
      aria-pressed={pressed || undefined}
      data-testid={testId}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        hapticTap();
        onClick();
      }}
    >
      <span className="content">{children}</span>
    </button>
  );
}
