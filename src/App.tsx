import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { BusyCallScreen } from "./components/BusyCallScreen";
import { CallScreen } from "./components/CallScreen";
import { callConfigFromAgent, getAgentById } from "./data/agents";
import { HIRE_ME_URL } from "./data/homeLinks";

/**
 * Resolves `/call/:agentId` to live Tavus (`CallScreen`) or busy simulation.
 * Unknown ids redirect home; exit replaces the page with {@link HIRE_ME_URL}.
 */
function AgentCallRoute() {
  const { agentId } = useParams();
  const agent = getAgentById(agentId);

  if (!agent) {
    return <Navigate to="/" replace />;
  }

  const onExit = () => {
    window.location.replace(HIRE_ME_URL);
  };

  const config = callConfigFromAgent(agent);

  if (agent.availability === "live") {
    return <CallScreen config={config} autoStart onExit={onExit} />;
  }

  return <BusyCallScreen agent={agent} onExit={onExit} />;
}

/**
 * App routes: `/` → Garry live call; `/call/:agentId` live or busy; `*` → `/`.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/call/garry-tan" replace />} />
      <Route path="/call/:agentId" element={<AgentCallRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
