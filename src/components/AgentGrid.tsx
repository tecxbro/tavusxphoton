import type { AgentProfile } from "../data/agents";
import { AGENTS } from "../data/agents";
import { AgentCard } from "./AgentCard";

interface AgentGridProps {
  agents?: readonly AgentProfile[];
  onCall: (agent: AgentProfile) => void;
  disabled?: boolean;
}

export function AgentGrid({
  agents = AGENTS,
  onCall,
  disabled = false,
}: AgentGridProps) {
  return (
    <div className="agent-grid" data-testid="agent-grid" role="list">
      {agents.map((agent) => (
        <div key={agent.id} className="agent-grid__item" role="listitem">
          <AgentCard agent={agent} onCall={onCall} disabled={disabled} />
        </div>
      ))}
    </div>
  );
}
