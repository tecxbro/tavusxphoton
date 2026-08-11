import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useNavigate } from "react-router-dom";
import type { AgentProfile } from "../data/agents";
import { useCallAudio, type CallAudioPhase } from "../hooks/useCallAudio";
import { useFirstVideoFrame } from "../hooks/useFirstVideoFrame";
import { useLiquidGlass } from "../hooks/useLiquidGlass";
import { useMediaDevices } from "../hooks/useMediaDevices";
import { useSafeViewport } from "../hooks/useSafeViewport";
import type { CallPhase } from "../lib/callState";
import { callScreenCssVars } from "../lib/callUi";
import { hapticTap } from "../lib/haptics";
import { CallControlRail } from "./CallControlRail";
import { CallVisualShell } from "./CallVisualShell";
import { ContactPill } from "./ContactPill";
import { EffectsButton } from "./EffectsButton";
import { LocalCameraSurface } from "./LocalCameraSurface";
import { SymbolIcon } from "./SymbolIcon";

/** Busy-simulation phases — local media only; never Tavus/Daily. */
export type BusyPhase =
  | "bootstrapping"
  | "ringing"
  | "busy"
  | "permission-error";

interface BusyCallScreenProps {
  agent: AgentProfile;
  /** Fired when the user leaves the busy / cancelled flow. */
  onExit: () => void;
}

function toAudioPhase(
  phase: BusyPhase,
  cancelled: boolean,
): CallAudioPhase {
  if (cancelled || phase === "busy") return "ended";
  if (phase === "ringing") return "ringing";
  if (phase === "permission-error") return "permission-error";
  return "bootstrapping";
}

function toGlassPhase(phase: BusyPhase): CallPhase {
  if (phase === "ringing") return "ringing";
  if (phase === "permission-error") return "permission-error";
  if (phase === "busy") return "ended";
  return "bootstrapping";
}

/**
 * Simulated FaceTime call for busy agents. Local media + chrome only —
 * never imports or invokes Tavus / Daily creation APIs.
 *
 * @param props.agent - Fixed busy agent profile (ring duration, avatars).
 * @param props.onExit - Leave handler (hire-me redirect from App).
 */
export function BusyCallScreen({ agent, onExit }: BusyCallScreenProps) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<BusyPhase>("bootstrapping");
  const [cancelled, setCancelled] = useState(false);
  const [backgroundReady, setBackgroundReady] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localNodeRef = useRef<HTMLDivElement | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  const {
    stream: localStream,
    videoEnabled,
    audioEnabled,
    facingMode,
    isFlippingCamera,
    error: mediaError,
    requesting,
    requestPermissions,
    toggleVideo,
    toggleAudio,
    flipCamera,
    stopAll,
  } = useMediaDevices();

  const audioPhase = toAudioPhase(phase, cancelled);
  useCallAudio(audioPhase, audioEnabled);

  const viewport = useSafeViewport();
  const screenStyle = useMemo(
    () => callScreenCssVars(viewport.safeInsets) as CSSProperties,
    [viewport.safeInsets],
  );

  const showLocal = phase === "bootstrapping" || phase === "ringing";
  const glassPhase = toGlassPhase(phase);

  const { mode: liquidMode, refreshImmediate } = useLiquidGlass({
    enabled: showLocal,
    backgroundReady: backgroundReady && showLocal,
    phase: glassPhase,
    controlsVisible: showLocal,
    layoutMode: "fullscreen",
    videoEnabled,
  });

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current != null) {
      window.clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  }, []);

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    void requestPermissions();

    return () => {
      clearRingTimer();
      clearExitTimer();
      stopAll();
    };
  }, [clearExitTimer, clearRingTimer, requestPermissions, stopAll]);

  useEffect(() => {
    if (phase !== "bootstrapping") return;

    if (localStream) {
      setPhase("ringing");
      return;
    }

    if (!requesting && mediaError) {
      setPhase("permission-error");
    }
  }, [localStream, mediaError, phase, requesting]);

  useEffect(() => {
    if (phase !== "ringing") {
      clearRingTimer();
      return;
    }

    const durationMs = agent.ringDurationMs ?? 12_000;
    clearRingTimer();
    ringTimerRef.current = window.setTimeout(() => {
      ringTimerRef.current = null;
      stopAll();
      setBackgroundReady(false);
      setPhase("busy");
    }, durationMs);

    return () => {
      clearRingTimer();
    };
  }, [agent.ringDurationMs, clearRingTimer, phase, stopAll]);

  useEffect(() => {
    if (!cancelled) return;
    clearExitTimer();
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      onExit();
    }, 80);
    return () => {
      clearExitTimer();
    };
  }, [cancelled, clearExitTimer, onExit]);

  useFirstVideoFrame(
    localVideoRef,
    showLocal && videoEnabled && !backgroundReady,
    () => setBackgroundReady(true),
  );

  useEffect(() => {
    if (!showLocal || videoEnabled || backgroundReady) return;
    setBackgroundReady(true);
  }, [showLocal, videoEnabled, backgroundReady]);

  const handleCancel = useCallback(() => {
    if (cancelled || phase === "busy") return;
    hapticTap();
    clearRingTimer();
    stopAll();
    setBackgroundReady(false);
    setCancelled(true);
  }, [cancelled, clearRingTimer, phase, stopAll]);

  const handleTalkToGarry = useCallback(() => {
    hapticTap();
    stopAll();
    navigate("/call/garry-tan");
  }, [navigate, stopAll]);

  const handleBackToCalls = useCallback(() => {
    hapticTap();
    stopAll();
    onExit();
  }, [onExit, stopAll]);

  const handleRetryPermissions = useCallback(() => {
    hapticTap();
    setPhase("bootstrapping");
    setBackgroundReady(false);
    void requestPermissions();
  }, [requestPermissions]);

  return (
    <CallVisualShell
      testId="busy-call-screen"
      phase={phase}
      liquidMode={liquidMode}
      cameraOn={videoEnabled}
      style={screenStyle}
      dataAttrs={{ "agent-id": agent.id }}
      stage={
        <>
          {/* No remote <video> — busy agents never join Daily/Tavus. */}
          <div className="remote-video-wrap" aria-hidden="true" />
          <div className="video-overlay" />
        </>
      }
      localCamera={
        showLocal ? (
          <LocalCameraSurface
            stream={localStream}
            videoEnabled={videoEnabled}
            mirrored={facingMode === "user"}
            mode="fullscreen"
            selfName="You"
            nodeRef={localNodeRef}
            videoRef={localVideoRef}
          />
        ) : null
      }
      chrome={
        showLocal ? (
          <div
            className="facetime-chrome is-visible"
            data-testid="busy-call-chrome"
            data-visible="true"
          >
            <ContactPill
              name={agent.displayName}
              avatar={agent.avatarSrc}
              connecting={false}
              onMetricsInvalidate={refreshImmediate}
            />
            <EffectsButton />

            <CallControlRail
              videoEnabled={videoEnabled}
              audioEnabled={audioEnabled}
              onToggleCamera={() => {
                toggleVideo();
              }}
              onToggleMic={() => {
                toggleAudio();
              }}
              onEnd={handleCancel}
            />

            <button
              type="button"
              className="waiting-flip-btn control-btn liquidGL"
              data-visible="true"
              aria-label="Switch camera"
              title="Switch camera"
              disabled={isFlippingCamera}
              onClick={() => {
                void flipCamera();
              }}
              data-testid="busy-waiting-flip"
            >
              <span className="content">
                <SymbolIcon name="flip-camera" />
              </span>
            </button>
          </div>
        ) : null
      }
    >
      {phase === "busy" ? (
        <section className="ended" data-testid="busy-agent-busy">
          <div className="ended__icon" aria-hidden />
          <h1 className="ended__title">Agent is busy</h1>
          <p className="ended__duration">
            {agent.displayName} didn’t answer.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--primary"
              data-testid="busy-talk-garry"
              onClick={handleTalkToGarry}
            >
              Talk to Garry
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              data-testid="busy-back-calls"
              onClick={handleBackToCalls}
            >
              Back to Calls
            </button>
          </div>
        </section>
      ) : null}

      {phase === "permission-error" ? (
        <section className="error-screen" data-testid="busy-permission-error">
          <h1 className="error-screen__title">Camera Access Needed</h1>
          <p className="error-screen__body">
            Allow camera and microphone access to place the call.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleRetryPermissions}
            >
              Try Again
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleBackToCalls}
            >
              Back to Calls
            </button>
          </div>
        </section>
      ) : null}
    </CallVisualShell>
  );
}
