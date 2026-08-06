import type { AgentProfile } from "../data/agents";
import { HomeSymbolIcon } from "./HomeSymbolIcon";

interface AgentCardProps {
  agent: AgentProfile;
  onCall: (agent: AgentProfile) => void;
  disabled?: boolean;
}

export function AgentCard({ agent, onCall, disabled = false }: AgentCardProps) {
  const callLabel = `FaceTime ${agent.displayName}`;
  const statusPrefix =
    agent.availability === "live" ? "Available" : "Last call";

  return (
    <button
      type="button"
      className="agent-card"
      data-testid={`agent-card-${agent.id}`}
      data-agent-id={agent.id}
      data-image-mode={agent.imageMode}
      data-availability={agent.availability}
      aria-label={callLabel}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onCall(agent);
      }}
    >
      <span className="agent-card__media" aria-hidden="true">
        <img
          className="agent-card__image"
          src={agent.avatarSrc}
          alt=""
          draggable={false}
          style={
            agent.objectPosition
              ? { objectPosition: agent.objectPosition }
              : undefined
          }
        />
      </span>

      <span className="agent-card__scrim" aria-hidden="true" />

      <span className="agent-card__name">{agent.displayName}</span>

      <span className="agent-card__status">
        <HomeSymbolIcon name="call-outgoing" size={11} />
        <span className="agent-card__status-text">
          <span className="sr-only">{statusPrefix}: </span>
          {agent.statusLabel}
        </span>
      </span>

      {/* Visual video control only — whole card is the single interactive target. */}
      <span className="agent-card__video-btn" aria-hidden="true">
        <HomeSymbolIcon name="camera-on" size={16} />
      </span>
    </button>
  );
}
