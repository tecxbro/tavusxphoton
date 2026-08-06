import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { BusyCallScreen } from "./components/BusyCallScreen";
import { CallScreen } from "./components/CallScreen";
import { HomeScreen } from "./components/HomeScreen";
import { callConfigFromAgent, getAgentById } from "./data/agents";

function AgentCallRoute() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const agent = getAgentById(agentId);

  if (!agent) {
    return <Navigate to="/" replace />;
  }

  const onExit = () => {
    navigate("/");
  };

  const config = callConfigFromAgent(agent);

  if (agent.availability === "live") {
    return <CallScreen config={config} autoStart onExit={onExit} />;
  }

  return <BusyCallScreen agent={agent} onExit={onExit} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/call/:agentId" element={<AgentCallRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
