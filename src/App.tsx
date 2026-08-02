import { Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { CallScreen } from "./components/CallScreen";
import { parseCallSearchParams } from "./lib/callState";

function CallRoute() {
  const { sessionId = "demo" } = useParams();
  const [searchParams] = useSearchParams();
  const config = parseCallSearchParams(sessionId, searchParams.toString());
  return <CallScreen config={config} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/call/demo" replace />} />
      <Route path="/call/:sessionId" element={<CallRoute />} />
      <Route path="*" element={<Navigate to="/call/demo" replace />} />
    </Routes>
  );
}
