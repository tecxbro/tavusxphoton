import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { CallControlRail } from "./CallControlRail";
import { CameraActivationFallback } from "./CameraActivationFallback";
import { ContactPill } from "./ContactPill";
import { EffectsButton } from "./EffectsButton";
import { EndedScreen } from "./EndedScreen";
import {
  LocalCameraSurface,
  type LocalCameraMode,
} from "./LocalCameraSurface";
import { SymbolIcon } from "./SymbolIcon";
import { useAutoHideControls } from "../hooks/useAutoHideControls";
import { useCallTimer } from "../hooks/useCallTimer";
import { useDraggableSelfView } from "../hooks/useDraggableSelfView";
import { useFirstVideoFrame } from "../hooks/useFirstVideoFrame";
import { useLiquidGlass } from "../hooks/useLiquidGlass";
import { useMediaDevices } from "../hooks/useMediaDevices";
import { usePhoTestCommands } from "../hooks/usePhoTestCommands";
import { useSafeViewport } from "../hooks/useSafeViewport";
import {
  JOIN_MORPH_MS,
  callReducer,
  isActiveCallPhase,
  type CallConfig,
  type CallPhase,
} from "../lib/callState";
import { hapticTap } from "../lib/haptics";

interface CallScreenProps {
  config: CallConfig;
}

function localModeFor(
  phase: CallPhase,
  chromeVisible: boolean,
): LocalCameraMode {
  if (phase === "ringing" || phase === "connecting") return "fullscreen";
  if (phase === "joining") return "expanded";
  if (phase === "live") return chromeVisible ? "expanded" : "compact";
  return "fullscreen";
}

function wantsDebugGlass(): boolean {
  if (typeof window === "undefined") return false;
  if (!import.meta.env.DEV) return false;

  return new URLSearchParams(window.location.search).has("debugGlass");
}

export function CallScreen({ config }: CallScreenProps) {
  const [phase, dispatch] = useReducer(callReducer, "bootstrapping");
  const [needsGesture, setNeedsGesture] = useState(false);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [showGlassDebug, setShowGlassDebug] = useState(false);

  const screenRef = useRef<HTMLElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const phaseRef = useRef<CallPhase>(phase);
  const transitionTimers = useRef<number[]>([]);
  const bootstrapped = useRef(false);
  const attemptRef = useRef(0);

  phaseRef.current = phase;

  const {
    stream,
    videoEnabled,
    audioEnabled,
    facingMode,
    error: mediaError,
    requestPermissions,
    toggleVideo,
    toggleAudio,
    flipCamera: flipMediaCamera,
    stopAll,
  } = useMediaDevices();

  useSafeViewport();
  const {
    formatted: timerFormatted,
    reset: resetTimer,
    stop: stopTimer,
  } = useCallTimer(phase === "live");

  const {
    visible: controlsVisible,
    bump: bumpControls,
    pause: pauseControls,
    resume: resumeControls,
    show: showControls,
  } = useAutoHideControls(
    phase === "live",
    phase === "permission-error" || phase === "connection-error",
  );

  const dragEnabled = phase === "live" && controlsVisible;
  const {
    nodeRef: dragNodeRef,
    position: dragPosition,
    dragging,
    onPointerDown: onDragPointerDown,
    onPointerMove: onDragPointerMove,
    onPointerUp: onDragPointerUp,
  } = useDraggableSelfView(screenRef, dragEnabled, {
    compact: !controlsVisible,
  });

  const clearTransitionTimers = useCallback(() => {
    transitionTimers.current.forEach((id) => window.clearTimeout(id));
    transitionTimers.current = [];
  }, []);

  const clearRemoteVideo = useCallback(() => {
    const remote = remoteRef.current;
    if (!remote) return;
    remote.pause();
    remote.removeAttribute("src");
    remote.removeAttribute("data-revealed");
    remote.load();
  }, []);

  useEffect(() => {
    if (dragging) pauseControls();
    else if (phase === "live") resumeControls();
  }, [dragging, pauseControls, phase, resumeControls]);

  useEffect(() => {
    return () => {
      clearTransitionTimers();
    };
  }, [clearTransitionTimers]);

  useEffect(() => {
    setShowGlassDebug(wantsDebugGlass());
  }, []);

  const beginCall = useCallback(async () => {
    clearTransitionTimers();
    attemptRef.current += 1;
    const attempt = attemptRef.current;

    clearRemoteVideo();
    setNeedsGesture(false);
    setBackgroundReady(false);

    const prior = phaseRef.current;
    if (isActiveCallPhase(prior) || prior === "ended") {
      stopAll();
      stopTimer();
    }

    // Always restart explicitly — do not transit through ended during reset.
    dispatch({ type: "RESTART" });
    phaseRef.current = "bootstrapping";

    const nextStream = await requestPermissions();
    if (attempt !== attemptRef.current) return;

    if (!nextStream) {
      const message = mediaError ?? "";
      if (!/NotAllowedError|Permission denied|Permission/i.test(message)) {
        setNeedsGesture(true);
      }
      dispatch({ type: "PERMISSIONS_DENIED" });
      phaseRef.current = "permission-error";
      return;
    }

    resetTimer();
    dispatch({ type: "PERMISSIONS_GRANTED" });
    phaseRef.current = "ringing";
  }, [
    clearRemoteVideo,
    clearTransitionTimers,
    mediaError,
    requestPermissions,
    resetTimer,
    stopAll,
    stopTimer,
  ]);

  const endCall = useCallback(() => {
    clearTransitionTimers();
    stopAll();
    clearRemoteVideo();
    stopTimer();
    dispatch({ type: "END" });
    phaseRef.current = "ended";
  }, [clearRemoteVideo, clearTransitionTimers, stopAll, stopTimer]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void beginCall();
  }, [beginCall]);

  usePhoTestCommands(config.sessionId, {
    onAnswer: () => {
      if (phaseRef.current === "ringing") {
        dispatch({ type: "PHO_ANSWERED" });
        phaseRef.current = "connecting";
      }
    },
    onEnd: () => {
      endCall();
    },
    onReset: () => {
      void beginCall();
    },
    getPhase: () => phaseRef.current,
  });

  const showRemote =
    phase === "connecting" || phase === "joining" || phase === "live";

  useEffect(() => {
    const remote = remoteRef.current;
    if (!remote) return;
    const attempt = attemptRef.current;

    if (!showRemote) {
      if (remote.getAttribute("src")) {
        clearRemoteVideo();
      }
      return;
    }

    if (remote.getAttribute("src") !== config.remoteVideo) {
      remote.setAttribute("src", config.remoteVideo);
      remote.load();
      void remote.play().catch(() => undefined);
    }

    const onError = () => {
      if (attempt !== attemptRef.current) return;
      dispatch({ type: "CONNECTION_FAILED" });
      phaseRef.current = "connection-error";
    };
    remote.addEventListener("error", onError);
    return () => {
      remote.removeEventListener("error", onError);
    };
  }, [clearRemoteVideo, config.remoteVideo, showRemote]);

  useFirstVideoFrame(remoteRef, phase === "connecting", () => {
    if (phaseRef.current !== "connecting") return;
    dispatch({ type: "REMOTE_FRAME" });
    phaseRef.current = "joining";
  });

  useEffect(() => {
    if (phase !== "joining") return;
    const attempt = attemptRef.current;
    clearTransitionTimers();
    const id = window.setTimeout(() => {
      if (attempt !== attemptRef.current) return;
      dispatch({ type: "JOIN_COMPLETE" });
      phaseRef.current = "live";
    }, JOIN_MORPH_MS);
    transitionTimers.current.push(id);
    return () => {
      window.clearTimeout(id);
      transitionTimers.current = transitionTimers.current.filter(
        (timerId) => timerId !== id,
      );
    };
  }, [clearTransitionTimers, phase]);

  // Mark background ready once local camera has a frame, or the camera-off
  // placeholder is visible, so LiquidGL can snapshot real pixels.
  useEffect(() => {
    if (!isActiveCallPhase(phase)) {
      setBackgroundReady(false);
      return;
    }

    if (!videoEnabled) {
      setBackgroundReady(true);
      return;
    }

    const video = localVideoRef.current;
    if (!video) {
      setBackgroundReady(Boolean(stream));
      return;
    }

    const markReady = () => setBackgroundReady(true);
    if (video.readyState >= 2) {
      markReady();
      return;
    }
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("playing", markReady);
    return () => {
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("playing", markReady);
    };
  }, [phase, stream, videoEnabled]);

  const flipCamera = useCallback(() => {
    hapticTap();
    bumpControls();
    void flipMediaCamera();
  }, [bumpControls, flipMediaCamera]);

  const onSelfPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      bumpControls();
      onDragPointerDown(event);
    },
    [bumpControls, onDragPointerDown],
  );

  const mode = localModeFor(phase, controlsVisible);
  const showLocal = isActiveCallPhase(phase);
  const showChrome =
    isActiveCallPhase(phase) && (phase !== "live" || controlsVisible);
  const showWaitingFlip = phase === "ringing" || phase === "connecting";
  const showLiveExtras = phase === "joining" || phase === "live";

  const { mode: liquidMode } = useLiquidGlass({
    enabled: showLocal,
    backgroundReady: backgroundReady && showLocal,
    phase,
    controlsVisible: showChrome,
    layoutMode: mode,
  });

  const selfStyle = useMemo(() => {
    if (mode === "fullscreen" || !dragPosition) return undefined;
    return {
      top: dragPosition.top,
      left: dragPosition.left,
      right: "auto",
    } as CSSProperties;
  }, [dragPosition, mode]);

  const chromeVisibleAttr =
    phase === "live" ? (controlsVisible ? "visible" : "hidden") : "visible";

  const debug = showGlassDebug
    ? window.__miniPhoLiquidGlassDebug__
    : null;

  return (
    <main
      ref={screenRef}
      className="call-screen"
      data-testid="call-screen"
      data-phase={phase}
      data-chrome={chromeVisibleAttr}
      data-camera={videoEnabled ? "on" : "off"}
      data-liquid-mode={liquidMode}
    >
      <div id="liquid-gl-snapshot" className="call-visual-stage">
        <div id="video-stage">
          <div className="remote-video-wrap">
            <video
              ref={remoteRef}
              className="remote-video-surface"
              autoPlay
              playsInline
              loop
              muted
              preload="auto"
              crossOrigin="anonymous"
              data-active={showRemote ? "true" : undefined}
              data-revealed={
                phase === "joining" || phase === "live" || undefined
              }
              data-testid="remote-video"
              aria-hidden={!showRemote}
            />
          </div>
          <div className="video-overlay" />
        </div>

        {showLocal && (
          <LocalCameraSurface
            stream={stream}
            videoEnabled={videoEnabled}
            mirrored={facingMode === "user"}
            mode={mode}
            selfName="You"
            selfAvatar={config.selfAvatar}
            showFlipCapsule={showLiveExtras && controlsVisible}
            style={selfStyle}
            nodeRef={dragNodeRef}
            videoRef={localVideoRef}
            onFlip={flipCamera}
            draggable={dragEnabled}
            onPointerDown={onSelfPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
          />
        )}
      </div>

      {phase === "live" && !controlsVisible && (
        <button
          type="button"
          className="tap-catcher"
          aria-label="Show call controls"
          onClick={() => showControls()}
          data-testid="tap-restore"
        />
      )}

      <div
        className={`facetime-chrome ${showChrome ? "is-visible" : "is-hidden"}`}
        data-testid="facetime-chrome"
        data-visible={showChrome}
        aria-hidden={!showChrome}
      >
        <ContactPill
          name={config.participantName}
          avatar={config.participantAvatar}
          connecting={phase === "connecting"}
        />
        <EffectsButton />

        <CallControlRail
          videoEnabled={videoEnabled}
          audioEnabled={audioEnabled}
          onToggleCamera={() => {
            bumpControls();
            toggleVideo();
          }}
          onToggleMic={() => {
            bumpControls();
            toggleAudio();
          }}
          onEnd={endCall}
        />

        <div
          className="waiting-flip-control"
          data-visible={showWaitingFlip}
          aria-hidden={!showWaitingFlip}
        >
          <span
            className="waiting-flip-control__lens liquidGL"
            data-glass-shape="circle"
            aria-hidden="true"
          />

          <button
            type="button"
            className="waiting-flip-btn control-btn waiting-flip-control__action"
            aria-label="Switch camera"
            title="Switch camera"
            onClick={flipCamera}
            data-testid="waiting-flip"
            tabIndex={showWaitingFlip ? 0 : -1}
          >
            <span className="content">
              <SymbolIcon name="flip-camera" size={26} />
            </span>
          </button>
        </div>
      </div>

      {showGlassDebug && debug ? (
        <aside
          className="liquid-glass-debug"
          data-liquid-ignore
          data-testid="liquid-glass-debug"
        >
          <div>LiquidGL {debug.packageVersion}</div>
          <div>Mode: {debug.mode}</div>
          <div>Snapshot: {debug.snapshotFound ? "found" : "missing"}</div>
          <div>Targets: {debug.targetCount}</div>
          <div>Canvases: {debug.canvasCount}</div>
          <div>WebGL: {debug.webglAvailable ? "available" : "unavailable"}</div>
        </aside>
      ) : null}

      {needsGesture && (
        <CameraActivationFallback
          onStart={() => {
            void beginCall();
          }}
        />
      )}

      {phase === "ended" && (
        <EndedScreen
          duration={timerFormatted}
          onCallAgain={() => {
            resetTimer();
            void beginCall();
          }}
          onClose={() => {
            resetTimer();
            dispatch({ type: "CLOSE" });
            phaseRef.current = "ended";
          }}
        />
      )}

      {phase === "permission-error" && !needsGesture && (
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
                void beginCall();
              }}
            >
              Try Again
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                dispatch({ type: "CLOSE" });
                phaseRef.current = "ended";
              }}
            >
              Close
            </button>
          </div>
        </section>
      )}

      {phase === "connection-error" && (
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
                void beginCall();
              }}
            >
              Retry
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                dispatch({ type: "CLOSE" });
                phaseRef.current = "ended";
              }}
            >
              Close
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
