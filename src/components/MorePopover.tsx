import { useEffect, useId, useRef, type RefObject } from "react";
import { getInitials } from "../lib/callState";
import { hapticTap } from "../lib/liquidGlass";
import { SymbolIcon, type SymbolName } from "./SymbolIcon";

export type MoreActionId =
  | "add-people"
  | "contact-card"
  | "audio"
  | "live-captions"
  | "live-translation"
  | "screen-sharing"
  | "shareplay";

export interface MoreAction {
  id: MoreActionId;
  title: string;
  subtitle?: string;
  badge?: string;
  icon: SymbolName;
  iconTone: "blue" | "purple" | "cyan" | "black" | "green" | "white" | "navy";
  dividerAfter?: boolean;
}

interface MorePopoverProps {
  open: boolean;
  audioLabel: string;
  contactName: string;
  contactAvatar: string;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onAction?: (id: MoreActionId) => void;
}

function buildActions(audioLabel: string): MoreAction[] {
  return [
    {
      id: "add-people",
      title: "Add People",
      icon: "person.badge.plus",
      iconTone: "blue",
    },
    {
      id: "contact-card",
      title: "Contact Card",
      icon: "person.badge.plus",
      iconTone: "navy",
      dividerAfter: true,
    },
    {
      id: "audio",
      title: "Audio",
      subtitle: audioLabel,
      icon: "airpodspro",
      iconTone: "white",
      dividerAfter: true,
    },
    {
      id: "live-captions",
      title: "Live Captions",
      subtitle: "Transcribe a conversation",
      icon: "captions.bubble.fill",
      iconTone: "black",
    },
    {
      id: "live-translation",
      title: "Live Translation",
      subtitle: "Translate caller as they speak",
      badge: "BETA",
      icon: "translate",
      iconTone: "cyan",
    },
    {
      id: "screen-sharing",
      title: "Screen Sharing",
      subtitle: "Share and remotely control",
      icon: "screen.sharing",
      iconTone: "purple",
    },
    {
      id: "shareplay",
      title: "SharePlay",
      subtitle: "Watch, listen, and collaborate",
      icon: "shareplay",
      iconTone: "green",
    },
  ];
}

export function MorePopover({
  open,
  audioLabel,
  contactName,
  contactAvatar,
  anchorRef,
  onClose,
  onAction,
}: MorePopoverProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const actions = buildActions(audioLabel);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current || !anchorRef.current) return;
    const panel = panelRef.current;
    const anchor = anchorRef.current.getBoundingClientRect();
    const originX = anchor.left + anchor.width / 2;
    const originY = anchor.top + anchor.height / 2;
    const panelRect = panel.getBoundingClientRect();
    const ox = ((originX - panelRect.left) / Math.max(panelRect.width, 1)) * 100;
    const oy = ((originY - panelRect.top) / Math.max(panelRect.height, 1)) * 100;
    panel.style.transformOrigin = `${ox}% ${oy}%`;
  }, [anchorRef, open]);

  if (!open) return null;

  return (
    <div
      className="more-popover-backdrop"
      role="presentation"
      onClick={onClose}
      data-testid="more-popover"
    >
      <div
        ref={panelRef}
        className="more-popover liquidGL-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="content more-popover__content">
          <h2 id={titleId} className="sr-only">
            More options
          </h2>
          <ul className="more-popover__list">
            {actions.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  className="more-popover__row"
                  onClick={() => {
                    hapticTap();
                    onAction?.(action.id);
                    onClose();
                  }}
                >
                  <span
                    className={`more-popover__icon more-popover__icon--${action.iconTone}`}
                    aria-hidden
                  >
                    {action.id === "contact-card" ? (
                      contactAvatar ? (
                        <img src={contactAvatar} alt="" />
                      ) : (
                        <span className="more-popover__initials">
                          {getInitials(contactName)}
                        </span>
                      )
                    ) : (
                      <SymbolIcon name={action.icon} size={22} />
                    )}
                  </span>
                  <span className="more-popover__copy">
                    <span className="more-popover__title">
                      {action.title}
                      {action.badge ? (
                        <span className="more-popover__badge">{action.badge}</span>
                      ) : null}
                    </span>
                    {action.subtitle ? (
                      <span className="more-popover__subtitle">
                        {action.subtitle}
                      </span>
                    ) : null}
                  </span>
                </button>
                {action.dividerAfter ? (
                  <div className="more-popover__divider" aria-hidden />
                ) : null}
              </li>
            ))}
          </ul>
        </span>
      </div>
    </div>
  );
}
