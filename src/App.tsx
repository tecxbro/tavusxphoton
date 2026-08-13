import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { BusyCallScreen } from "./components/BusyCallScreen";
import { CallScreen } from "./components/CallScreen";
import { IncomingCallCard } from "./components/IncomingCallCard";
import { callConfigFromAgent, getAgentById } from "./data/agents";
import { HIRE_ME_URL } from "./data/homeLinks";

const DEMO_AGENT_ID = "garry-tan";
const PHOTON_HOME_URL = "https://photon.codes";

/**
 * Resolves `/call/:agentId` to live Tavus (`CallScreen`) or busy simulation.
 * `demo` is an alias for Garry. Live hang-up replaces the page with Photon
 * home; busy sims still exit to {@link HIRE_ME_URL}.
 */
function AgentCallRoute() {
  const { agentId } = useParams();
  const resolvedId = agentId === "demo" ? DEMO_AGENT_ID : agentId;
  const agent = getAgentById(resolvedId);

  if (!agent) {
    return <Navigate to="/" replace />;
  }

  const config = callConfigFromAgent(agent);

  if (agent.availability === "live") {
    return (
      <CallScreen
        config={config}
        autoStart
        onExit={() => {
          window.location.replace(PHOTON_HOME_URL);
        }}
      />
    );
  }

  return (
    <BusyCallScreen
      agent={agent}
      onExit={() => {
        window.location.replace(HIRE_ME_URL);
      }}
    />
  );
}

/**
 * App routes: `/incoming/garry` Live Mini App card; `/` and `/call/demo`
 * Garry live call; `/call/:agentId` live or busy; `*` → `/`.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/call/demo" replace />} />
      <Route path="/incoming/garry" element={<IncomingCallCard />} />
      <Route path="/call/:agentId" element={<AgentCallRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
