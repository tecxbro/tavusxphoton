import { getInitials } from "../lib/callState";
import { SymbolIcon } from "./SymbolIcon";

interface ContactPillProps {
  name: string;
  avatar: string;
  connecting?: boolean;
}

export function ContactPill({
  name,
  avatar,
  connecting = false,
}: ContactPillProps) {
  const label = connecting ? "Connecting…" : name;

  return (
    <div
      className="contact-pill liquidGL"
      role="status"
      aria-live="polite"
      title={label}
      data-testid="contact-pill"
      data-connecting={connecting || undefined}
    >
      <span className="content contact-pill__content">
        {avatar ? (
          <img
            className="contact-pill__avatar"
            src={avatar}
            alt=""
            width={32}
            height={32}
            onError={(event) => {
              event.currentTarget.style.display = "none";
              const fallback = event.currentTarget.nextElementSibling;
              if (fallback instanceof HTMLElement) {
                fallback.hidden = false;
              }
            }}
          />
        ) : null}
        <span className="contact-pill__avatar-fallback" hidden={Boolean(avatar)}>
          {getInitials(name)}
        </span>
        <span className="contact-pill__text">
          <span className="contact-pill__name">{label}</span>
        </span>
        {!connecting && (
          <SymbolIcon
            className="contact-pill__chevron"
            name="chevron.right"
            size={14}
          />
        )}
      </span>
    </div>
  );
}
