import {
  Aperture,
  Smile,
  Sparkles,
  SunMedium,
  X,
} from "lucide-react";
import { hapticTap } from "../lib/haptics";

type EffectMode = "none" | "portrait" | "studio" | "memoji" | "reactions";

const EFFECTS: Array<{
  id: Exclude<EffectMode, "none">;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: "portrait", label: "Portrait", icon: Aperture },
  { id: "studio", label: "Studio Light", icon: SunMedium },
  { id: "memoji", label: "Memoji", icon: Smile },
  { id: "reactions", label: "Reactions", icon: Sparkles },
];

interface EffectsPanelProps {
  active: EffectMode;
  showReactions: boolean;
  onSelect: (mode: EffectMode) => void;
  onClose: () => void;
  onReaction: (emoji: string) => void;
}

const REACTIONS = ["👍", "❤️", "🎉", "😂"];

export function EffectsPanel({
  active,
  showReactions,
  onSelect,
  onClose,
  onReaction,
}: EffectsPanelProps) {
  return (
    <>
      <button
        type="button"
        className="effects-close liquidGL"
        aria-label="Close effects"
        title="Close effects"
        onClick={() => {
          hapticTap();
          onClose();
        }}
        data-testid="effects-close"
      >
        <span className="content">
          <X size={20} />
        </span>
      </button>

      <div className="effects-panel" data-testid="effects-panel">
        <div className="effects-row" role="toolbar" aria-label="Video effects">
          {EFFECTS.map((effect) => {
            const Icon = effect.icon;
            const selected =
              active === effect.id ||
              (effect.id === "reactions" && showReactions);
            return (
              <div
                key={effect.id}
                className={`effect-control ${selected ? "is-selected" : ""}`}
              >
                <button
                  type="button"
                  className="effect-control__btn"
                  aria-label={effect.label}
                  title={effect.label}
                  aria-pressed={selected}
                  onClick={() => {
                    hapticTap();
                    onSelect(effect.id);
                  }}
                  data-testid={`effect-${effect.id}`}
                >
                  <Icon size={22} />
                </button>
                <span className="effect-control__label">{effect.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {showReactions && (
        <div
          className="reaction-picker liquidGL"
          role="toolbar"
          aria-label="Reactions"
        >
          <span className="content" style={{ display: "contents" }}>
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Send ${emoji}`}
                title={emoji}
                onClick={() => {
                  hapticTap();
                  onReaction(emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </span>
        </div>
      )}
    </>
  );
}
