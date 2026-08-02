import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Sparkles, SwitchCamera } from "lucide-react";
import { CallControlRail } from "./CallControlRail";
import { ConnectingScreen } from "./ConnectingScreen";
import { ContactPill } from "./ContactPill";
import { EffectsPanel } from "./EffectsPanel";
import { EndedScreen } from "./EndedScreen";
import { MoreSheet } from "./MoreSheet";
import { ParticipantSheet } from "./ParticipantSheet";
import { PrejoinScreen } from "./PrejoinScreen";
import { SelfView } from "./SelfView";
import { StatusPill } from "./StatusPill";
import { useAutoHideControls } from "../hooks/useAutoHideControls";
import { useCallTimer } from "../hooks/useCallTimer";
import { useDraggableSelfView } from "../hooks/useDraggableSelfView";
import { useMediaDevices } from "../hooks/useMediaDevices";
import { useSafeViewport } from "../hooks/useSafeViewport";
import {
  CONNECTING_MIN_MS,
  REACTION_MS,
  STATUS_PILL_MS,
  callReducer,
  type CallConfig,
  type EffectMode,
  type StatusMessage,
} from "../lib/callState";
import {
  hapticTap,
  initLiquidGlass,
  type GlassController,
} from "../lib/liquidGlass";
import {
  createFpsTracker,
  selectPerformancePolicy,
  type PerformanceMode,
  type PerformanceSample,
} from "../lib/performance";

interface CallScreenProps {
  config: CallConfig;
}

function PerformanceHud({ sample }: { sample: PerformanceSample | null }) {
  if (!import.meta.env.DEV || !sample) return null;
  return (
    <div className="perf-hud" data-testid="perf-hud">
      {`FPS ${sample.fps}  avg ${sample.averageFps}
drop ~${sample.droppedFrames}
glass ${sample.liquidEnabled ? sample.mode : "fallback"}
${Math.round(sample.viewportWidth)}×${Math.round(sample.viewportHeight)} @${sample.devicePixelRatio}`}
    </div>
  );
}

export function CallScreen({ config }: CallScreenProps) {
  const [status, dispatch] = useReducer(callReducer, "prejoin");
  const [effect, setEffect] = useState<EffectMode>("none");
  const [showReactions, setShowReactions] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [statusLeaving, setStatusLeaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [participantOpen, setParticipantOpen] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [perfSample, setPerfSample] = useState<PerformanceSample | null>(null);
  const [perfMode, setPerfMode] = useState<PerformanceMode>("full");

  const screenRef = useRef<HTMLElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const remoteBgRef = useRef<HTMLVideoElement | null>(null);
  const glassRef = useRef<GlassController | null>(null);
  const connectStarted = useRef<number | null>(null);
  const statusTimers = useRef<number[]>([]);
  const media = useMediaDevices();
  const viewport = useSafeViewport();

  const timerActive = status === "live" || status === "effects";
  const timer = useCallTimer(timerActive);

  const overlayOpen =
    moreOpen ||
    participantOpen ||
    Boolean(statusMessage) ||
    status === "effects";

  const autoHide = useAutoHideControls(
    status === "live",
    overlayOpen || status === "permission-error",
  );

  const drag = useDraggableSelfView(
    screenRef,
    status === "live" || status === "connecting",
  );

  const showStatus = useCallback((message: StatusMessage) => {
    statusTimers.current.forEach((id) => window.clearTimeout(id));
    statusTimers.current = [];
    setStatusLeaving(false);
    setStatusMessage(message);
    if (!message) return;
    const leave = window.setTimeout(
      () => setStatusLeaving(true),
      STATUS_PILL_MS - 180,
    );
    const clear = window.setTimeout(() => {
      setStatusMessage(null);
      setStatusLeaving(false);
    }, STATUS_PILL_MS);
    statusTimers.current = [leave, clear];
  }, []);

  const destroyGlass = useCallback(() => {
    glassRef.current?.destroy();
    glassRef.current = null;
  }, []);

  const ensureGlass = useCallback(() => {
    if (document.visibilityState === "hidden") return;
    destroyGlass();
    glassRef.current = initLiquidGlass(perfMode);
    setPerfMode(glassRef.current.mode);
  }, [destroyGlass, perfMode]);

  useEffect(() => {
    return () => {
      destroyGlass();
      statusTimers.current.forEach((id) => window.clearTimeout(id));
    };
  }, [destroyGlass]);

  useEffect(() => {
    if (status !== "live" && status !== "effects") {
      destroyGlass();
      return;
    }
    if (!remoteReady) return;
    const id = window.setTimeout(() => ensureGlass(), 50);
    return () => window.clearTimeout(id);
  }, [destroyGlass, ensureGlass, remoteReady, status]);

  useEffect(() => {
    const onResize = () => {
      glassRef.current?.refresh();
      if (status === "live" || status === "effects") {
        ensureGlass();
      }
    };
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [ensureGlass, status]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (status !== "live" && status !== "effects") return;
    const tracker = createFpsTracker();
    let raf = 0;
    const loop = () => {
      const stats = tracker.tick();
      const policy = selectPerformancePolicy(
        stats.averageFps,
        stats.lowFpsDurationMs,
        perfMode,
        window.__miniPhoForceGlassFallback__ === true,
      );
      if (policy.mode !== perfMode) {
        setPerfMode(policy.mode);
        glassRef.current?.setMode(policy.mode);
      }
      setPerfSample({
        fps: stats.fps,
        averageFps: stats.averageFps,
        droppedFrames: stats.droppedFrames,
        mode: policy.mode,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        devicePixelRatio: window.devicePixelRatio || 1,
        liquidEnabled: !policy.useCssFallback,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [perfMode, status, viewport.height, viewport.width]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        destroyGlass();
      } else if (status === "live" || status === "effects") {
        ensureGlass();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [destroyGlass, ensureGlass, status]);

  const beginConnecting = useCallback(async () => {
    dispatch({ type: "START" });
    const stream = await media.requestPermissions();
    if (!stream) {
      dispatch({ type: "PERMISSIONS_DENIED" });
      return;
    }
    dispatch({ type: "PERMISSIONS_GRANTED" });
    connectStarted.current = performance.now();
    timer.reset();

    const video = remoteRef.current;
    const alreadyReady =
      Boolean(video) &&
      video!.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    setRemoteReady(alreadyReady);
    if (alreadyReady) {
      void video?.play().catch(() => undefined);
      void remoteBgRef.current?.play().catch(() => undefined);
    }
  }, [media, timer]);

  useEffect(() => {
    if (
      status !== "connecting" ||
      !remoteReady ||
      connectStarted.current == null
    ) {
      return;
    }
    const elapsed = performance.now() - connectStarted.current;
    const wait = Math.max(0, CONNECTING_MIN_MS - elapsed);
    const id = window.setTimeout(() => {
      dispatch({ type: "CONNECTED" });
      showStatus("connection-restored");
    }, wait);
    return () => window.clearTimeout(id);
  }, [remoteReady, showStatus, status]);

  const endCall = useCallback(() => {
    media.stopAll();
    remoteRef.current?.pause();
    remoteBgRef.current?.pause();
    timer.stop();
    destroyGlass();
    setMoreOpen(false);
    setParticipantOpen(false);
    setShowReactions(false);
    setEffect("none");
    dispatch({ type: "END" });
  }, [destroyGlass, media, timer]);

  const onRemoteReady = useCallback(() => {
    setRemoteReady(true);
    void remoteRef.current?.play().catch(() => {
      dispatch({ type: "CONNECTION_FAILED" });
    });
    void remoteBgRef.current?.play().catch(() => undefined);
  }, []);

  const selfStyle = useMemo(() => {
    if (!drag.position) return undefined;
    return {
      top: drag.position.top,
      left: drag.position.left,
      right: "auto",
    } as CSSProperties;
  }, [drag.position]);

  const effectClass =
    effect === "portrait"
      ? "effect-portrait"
      : effect === "studio"
        ? "effect-studio"
        : "";

  const showStage =
    status === "connecting" ||
    status === "live" ||
    status === "effects" ||
    status === "requesting-permissions";

  const showSelf =
    status === "connecting" || status === "live";

  const showLiveChrome = status === "live";

  return (
    <main
      ref={screenRef}
      className={`call-screen ${status === "effects" ? "is-effects" : ""} ${effectClass}`}
      data-testid="call-screen"
      data-status={status}
    >
      {showStage && (
        <div id="video-stage">
          <div className="remote-video-wrap">
            <video
              ref={remoteBgRef}
              className="remote-video-bg"
              src={config.remoteVideo}
              autoPlay
              playsInline
              loop
              muted
              aria-hidden
            />
            <video
              ref={remoteRef}
              className="remote-video"
              src={config.remoteVideo}
              autoPlay
              playsInline
              loop
              muted
              onCanPlay={onRemoteReady}
              onLoadedData={onRemoteReady}
              data-testid="remote-video"
            />
            <div className="studio-light" aria-hidden />
            {status === "effects" && (
              <EffectsPanel
                active={effect}
                showReactions={showReactions}
                onClose={() => {
                  setShowReactions(false);
                  setEffect("none");
                  dispatch({ type: "CLOSE_EFFECTS" });
                  autoHide.bump();
                }}
                onSelect={(mode) => {
                  if (mode === "reactions") {
                    setShowReactions((value) => !value);
                    setEffect("reactions");
                    return;
                  }
                  setShowReactions(false);
                  setEffect((current) => (current === mode ? "none" : mode));
                  autoHide.bump();
                }}
                onReaction={(emoji) => {
                  setReaction(emoji);
                  window.setTimeout(() => setReaction(null), REACTION_MS);
                }}
              />
            )}
          </div>
          <div className="video-overlay" />
        </div>
      )}

      {status === "prejoin" && (
        <PrejoinScreen
          name={config.participantName}
          avatar={config.participantAvatar}
          onStart={() => {
            void beginConnecting();
          }}
          onCancel={() => undefined}
        />
      )}

      {status === "requesting-permissions" && (
        <ConnectingScreen message="Starting camera…" />
      )}

      {status === "connecting" && (
        <>
          <ConnectingScreen message="Connecting…" />
          <ContactPill
            name={config.participantName}
            avatar={config.participantAvatar}
            connecting
            onClick={() => setParticipantOpen(true)}
          />
        </>
      )}

      {showLiveChrome && !autoHide.visible && (
        <button
          type="button"
          className="tap-catcher"
          aria-label="Show call controls"
          onClick={() => autoHide.show()}
          data-testid="tap-restore"
        />
      )}

      {showLiveChrome && (
        <div
          className={`controls-layer ${
            autoHide.visible ? "is-visible" : "is-hidden"
          }`}
          data-testid="controls-layer"
          data-visible={autoHide.visible}
        >
          <ContactPill
            name={config.participantName}
            avatar={config.participantAvatar}
            onClick={() => {
              autoHide.bump();
              setParticipantOpen(true);
            }}
          />
          <button
            type="button"
            className="effects-btn liquidGL"
            aria-label="Open effects"
            title="Effects"
            onClick={() => {
              hapticTap();
              autoHide.bump();
              dispatch({ type: "OPEN_EFFECTS" });
            }}
            data-testid="effects-button"
          >
            <span className="content">
              <Sparkles size={24} />
            </span>
          </button>
          <CallControlRail
            videoEnabled={media.videoEnabled}
            audioEnabled={media.audioEnabled}
            onToggleCamera={() => {
              autoHide.bump();
              const enabled = media.toggleVideo();
              showStatus(enabled ? "camera-on" : "camera-off");
            }}
            onToggleMic={() => {
              autoHide.bump();
              const enabled = media.toggleAudio();
              showStatus(enabled ? "microphone-unmuted" : "microphone-muted");
            }}
            onMore={() => {
              autoHide.bump();
              setMoreOpen(true);
            }}
            onEnd={endCall}
          />
          <button
            type="button"
            className="flip-btn liquidGL control-btn"
            aria-label="Switch camera"
            title="Switch camera"
            onClick={() => {
              hapticTap();
              autoHide.bump();
              void media.flipCamera().then((facing) => {
                if (!facing) return;
                showStatus(
                  facing === "user" ? "front-camera" : "back-camera",
                );
              });
            }}
            data-testid="flip-camera"
          >
            <span className="content">
              <SwitchCamera size={24} />
            </span>
          </button>
        </div>
      )}

      {showSelf && (
        <SelfView
          stream={media.stream}
          videoEnabled={media.videoEnabled}
          mirrored={media.facingMode === "user"}
          participantName="You"
          style={selfStyle}
          nodeRef={drag.nodeRef}
          onPointerDown={(e) => {
            autoHide.bump();
            drag.onPointerDown(e);
          }}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
        />
      )}

      {statusMessage && (status === "live" || status === "effects") && (
        <StatusPill
          message={statusMessage}
          leaving={statusLeaving}
          onMutedTap={() => {
            media.setAudioEnabled(true);
            showStatus("microphone-unmuted");
            autoHide.bump();
          }}
        />
      )}

      {reaction && (
        <div className="reaction-burst" aria-live="polite">
          {reaction}
        </div>
      )}

      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}
      {participantOpen && (
        <ParticipantSheet
          name={config.participantName}
          avatar={config.participantAvatar}
          onClose={() => setParticipantOpen(false)}
        />
      )}

      {status === "ended" && (
        <EndedScreen
          duration={timer.formatted}
          onCallAgain={() => {
            timer.reset();
            setRemoteReady(false);
            void beginConnecting();
          }}
          onClose={() => {
            timer.reset();
            dispatch({ type: "CLOSE" });
          }}
        />
      )}

      {status === "permission-error" && (
        <section className="error-screen" data-testid="permission-error">
          <h1 className="error-screen__title">Camera Access Needed</h1>
          <p className="error-screen__body">
            Allow camera and microphone access to start the call.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                void beginConnecting();
              }}
            >
              Try Again
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => dispatch({ type: "CLOSE" })}
            >
              Close
            </button>
          </div>
        </section>
      )}

      {status === "connection-error" && (
        <section className="error-screen" data-testid="connection-error">
          <h1 className="error-screen__title">Connection Failed</h1>
          <p className="error-screen__body">
            Could not load the remote video. Try again.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                void beginConnecting();
              }}
            >
              Retry
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => dispatch({ type: "CLOSE" })}
            >
              Close
            </button>
          </div>
        </section>
      )}

      <PerformanceHud sample={perfSample} />
    </main>
  );
}
