import { ChevronRight } from "lucide-react";
import { hapticTap } from "../lib/liquidGlass";

interface ContactPillProps {
  name: string;
  avatar: string;
  connecting?: boolean;
  onClick: () => void;
}

export function ContactPill({
  name,
  avatar,
  connecting = false,
  onClick,
}: ContactPillProps) {
  return (
    <button
      type="button"
      className="contact-pill liquidGL"
      onClick={() => {
        hapticTap();
        onClick();
      }}
      aria-label={connecting ? "Connecting" : `Call with ${name}`}
      title={connecting ? "Connecting" : name}
    >
      <span className="content" style={{ display: "contents" }}>
        <img
          className="contact-pill__avatar"
          src={avatar}
          alt=""
          width={38}
          height={38}
        />
        <span className="contact-pill__text">
          <span className="contact-pill__name">
            {connecting ? "Connecting…" : name}
          </span>
        </span>
        {!connecting && (
          <ChevronRight
            className="contact-pill__chevron"
            size={18}
            aria-hidden
          />
        )}
      </span>
    </button>
  );
}
