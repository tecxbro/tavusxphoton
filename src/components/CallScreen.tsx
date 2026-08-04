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
import { CallLauncher } from "./CallLauncher";
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
import { useCallAudio } from "../hooks/useCallAudio";
import { useCallTimer } from "../hooks/useCallTimer";
import { useDraggableSelfView } from "../hooks/useDraggableSelfView";
import { useFirstVideoFrame } from "../hooks/useFirstVideoFrame";
import { useLiquidGlass } from "../hooks/useLiquidGlass";
import { useSafeViewport } from "../hooks/useSafeViewport";
import { useTavusCall } from "../hooks/useTavusCall";
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
  const [phase, dispatch] = useReducer(callReducer, "idle");
  const [needsGesture, setNeedsGesture] = useState(false);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [showGlassDebug, setShowGlassDebug] = useState(false);

  const screenRef = useRef<HTMLElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  // Mirror of reducer phase for async media handlers that must not
  // close over a stale render. Always update alongside dispatch.
  const phaseRef = useRef<CallPhase>(phase);
  const transitionTimers = useRef<number[]>([]);
  // Bumped on every beginCall / end so late media and timers ignore prior work.
  const attemptRef = useRef(0);

  phaseRef.current = phase;

  const {
    startCall,
    endCall: endTavusCall,
    resetCall,
    localStream,
    remoteVideoStream,
    remoteAudioStream,
    videoEnabled,
    audioEnabled,
    facingMode,
    toggleVideo,
    toggleAudio,
    flipCamera: flipMediaCamera,
    palJoined,
    error: callError,
    starting,
  } = useTavusCall();

  useCallAudio(phase, audioEnabled);

  const viewport = useSafeViewport();
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

  const clearRemoteMedia = useCallback(() => {
    const remote = remoteRef.current;
    if (remote) {
      remote.pause();
      remote.srcObject = null;
      remote.removeAttribute("data-revealed");
    }
    const remoteAudio = remoteAudioRef.current;
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
    }
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

    clearRemoteMedia();
    setNeedsGesture(false);
    setBackgroundReady(false);
    stopTimer();
    resetTimer();

    dispatch({ type: "START_CALL" });
    phaseRef.current = "bootstrapping";

    await startCall();
    if (attempt !== attemptRef.current) return;

    // startCall owns permission + Tavus create. Infer outcome from streams/error
    // via the effects below and the hook state at completion.
  }, [
    clearRemoteMedia,
    clearTransitionTimers,
    resetTimer,
    startCall,
    stopTimer,
  ]);

  const handleEndCall = useCallback(() => {
    clearTransitionTimers();
    clearRemoteMedia();
    stopTimer();
    dispatch({ type: "END" });
    phaseRef.current = "ended";
    void endTavusCall();
  }, [clearRemoteMedia, clearTransitionTimers, endTavusCall, stopTimer]);

  // Advance from bootstrapping as soon as local media is ready so the ringing
  // screen stays visible while Tavus create / Daily join continue.
  useEffect(() => {
    if (phase !== "bootstrapping") return;

    if (localStream) {
      dispatch({ type: "PERMISSIONS_GRANTED" });
      phaseRef.current = "ringing";
      setNeedsGesture(false);
      return;
    }

    if (!starting && callError) {
      const message = callError;
      if (/NotAllowedError|Permission denied|Permission/i.test(message)) {
        dispatch({ type: "PERMISSIONS_DENIED" });
        phaseRef.current = "permission-error";
        return;
      }
      dispatch({ type: "CONNECTION_FAILED" });
      phaseRef.current = "connection-error";
    }
  }, [callError, localStream, phase, starting]);

  useEffect(() => {
    if (!palJoined) return;
    if (phaseRef.current !== "ringing") return;
    dispatch({ type: "PAL_JOINED" });
    phaseRef.current = "connecting";
  }, [palJoined]);

  useEffect(() => {
    if (!callError) return;
    if (
      phaseRef.current === "ringing" ||
      phaseRef.current === "connecting" ||
      phaseRef.current === "joining" ||
      phaseRef.current === "live"
    ) {
      clearTransitionTimers();
      clearRemoteMedia();
      stopTimer();
      dispatch({ type: "CONNECTION_FAILED" });
      phaseRef.current = "connection-error";
      void endTavusCall();
    }
  }, [callError, clearRemoteMedia, clearTransitionTimers, endTavusCall, stopTimer]);

  const showRemote =
    phase === "connecting" || phase === "joining" || phase === "live";

  useEffect(() => {
    const remote = remoteRef.current;
    if (!remote) return;

    if (!showRemote || !remoteVideoStream) {
      if (remote.srcObject) {
        remote.srcObject = null;
      }
      return;
    }

    if (remote.srcObject !== remoteVideoStream) {
      remote.srcObject = remoteVideoStream;
      void remote.play().catch(() => undefined);
    }
  }, [remoteVideoStream, showRemote]);

  useEffect(() => {
    const remoteAudio = remoteAudioRef.current;
    if (!remoteAudio) return;

    if (!showRemote || !remoteAudioStream) {
      if (remoteAudio.srcObject) {
        remoteAudio.srcObject = null;
      }
      return;
    }

    if (remoteAudio.srcObject !== remoteAudioStream) {
      remoteAudio.srcObject = remoteAudioStream;
      void remoteAudio.play().catch(() => undefined);
    }
  }, [remoteAudioStream, showRemote]);

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

  const showLocal = isActiveCallPhase(phase);

  useEffect(() => {
    if (!showLocal) {
      setBackgroundReady(false);
    }
  }, [showLocal]);

  useFirstVideoFrame(
    localVideoRef,
    showLocal && videoEnabled && !backgroundReady,
    () => setBackgroundReady(true),
  );

  useEffect(() => {
    if (!showLocal || videoEnabled || backgroundReady) return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setBackgroundReady(true));
    });
    return () => {
      window.cancelAnimationFrame(first);
      if (second) window.cancelAnimationFrame(second);
    };
  }, [showLocal, videoEnabled, backgroundReady]);

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
  const showChrome =
    isActiveCallPhase(phase) && (phase !== "live" || controlsVisible);
  const showWaitingFlip = phase === "ringing" || phase === "connecting";
  const showLiveExtras = phase === "joining" || phase === "live";

  const [selfRect, setSelfRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (mode === "fullscreen" || dragging) {
      setSelfRect(null);
      return;
    }
    const node = dragNodeRef.current;
    if (!node) {
      setSelfRect(null);
      return;
    }
    setSelfRect(node.getBoundingClientRect());
  }, [mode, dragging, dragPosition, phase, controlsVisible, viewport, videoEnabled, dragNodeRef]);

  const capsuleVisible =
    showLiveExtras &&
    controlsVisible &&
    mode === "expanded" &&
    videoEnabled &&
    !dragging &&
    selfRect !== null;

  const capsuleStyle = useMemo(() => {
    if (!selfRect) return undefined;
    return {
      top: selfRect.bottom - 48,
      left: selfRect.left + selfRect.width / 2 - 44,
    } as CSSProperties;
  }, [selfRect]);

  const { mode: liquidMode } = useLiquidGlass({
    enabled: showLocal,
    backgroundReady: backgroundReady && showLocal,
    phase,
    controlsVisible: showChrome,
    layoutMode: mode,
    videoEnabled,
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

  if (phase === "idle") {
    return (
      <CallLauncher
        starting={starting}
        onCall={() => {
          void beginCall();
        }}
      />
    );
  }

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
              muted
              data-active={showRemote ? "true" : undefined}
              data-revealed={
                phase === "joining" || phase === "live" || undefined
              }
              data-liquid-ignore={
                phase === "joining" || phase === "live" ? undefined : ""
              }
              data-testid="remote-video"
              aria-hidden={!showRemote}
            />
            <audio
              ref={remoteAudioRef}
              autoPlay
              playsInline
              data-testid="remote-audio"
            />
          </div>
          <div className="video-overlay" />
        </div>

        {showLocal && (
          <LocalCameraSurface
            stream={localStream}
            videoEnabled={videoEnabled}
            mirrored={facingMode === "user"}
            mode={mode}
            selfName="You"
            selfAvatar={config.selfAvatar}
            style={selfStyle}
            nodeRef={dragNodeRef}
            videoRef={localVideoRef}
            draggable={dragEnabled}
            onPointerDown={onSelfPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
          />
        )}
      </div>

      <div className="liquid-canvas-layer" aria-hidden="true" />

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
          onEnd={handleEndCall}
        />

        <button
          type="button"
          className="self-flip-capsule liquidGL"
          data-visible={capsuleVisible}
          style={capsuleStyle}
          aria-hidden={!capsuleVisible}
          aria-label="Flip camera"
          title="Flip camera"
          onClick={flipCamera}
          data-testid="self-flip"
          tabIndex={capsuleVisible ? 0 : -1}
        >
          <span className="content self-flip-capsule__content">
            <SymbolIcon name="flip-camera" size={14} />
            <span>Flip</span>
          </span>
        </button>

        <button
          type="button"
          className="waiting-flip-btn control-btn liquidGL"
          data-visible={showWaitingFlip}
          aria-hidden={!showWaitingFlip}
          aria-label="Switch camera"
          title="Switch camera"
          onClick={flipCamera}
          data-testid="waiting-flip"
          tabIndex={showWaitingFlip ? 0 : -1}
        >
          <span className="content">
            <SymbolIcon name="flip-camera" />
          </span>
        </button>
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
            void (async () => {
              await resetCall();
              void beginCall();
            })();
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
            Could not connect to Gary. Try again.
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
