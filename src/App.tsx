import { useEffect } from "react";
import { Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { CallScreen } from "./components/CallScreen";
import { PhoController } from "./components/PhoController";
import { parseCallSearchParams } from "./lib/callState";

function CallRoute() {
  const { sessionId = "demo" } = useParams();
  const [searchParams] = useSearchParams();
  const config = parseCallSearchParams(sessionId, searchParams.toString());
  return <CallScreen config={config} />;
}

function PhoControllerRoute() {
  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"]');
    if (existing) {
      existing.setAttribute("content", "noindex");
      return;
    }
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  if (import.meta.env.VITE_ENABLE_PHO_TEST_CONTROLLER !== "true") {
    return (
      <main className="pho-controller" data-testid="pho-controller">
        <h1 className="pho-controller__title">Not Found</h1>
        <p className="pho-controller__status">Test controller is disabled.</p>
      </main>
    );
  }

  return <PhoController />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/call/demo" replace />} />
      <Route path="/call/:sessionId" element={<CallRoute />} />
      <Route path="/pho-controller" element={<PhoControllerRoute />} />
      <Route path="*" element={<Navigate to="/call/demo" replace />} />
    </Routes>
  );
}
