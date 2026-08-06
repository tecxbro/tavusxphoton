import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import { SelfViewControlsOverlay } from "./SelfViewControlsOverlay";
import { SymbolIcon } from "./SymbolIcon";
import { useAutoHideControls } from "../hooks/useAutoHideControls";
import { useCallAudio } from "../hooks/useCallAudio";
import { useCallTimer } from "../hooks/useCallTimer";
import { useDraggableSelfView } from "../hooks/useDraggableSelfView";
import { useFirstVideoFrame } from "../hooks/useFirstVideoFrame";
import { useLayoutMorph } from "../hooks/useLayoutMorph";
import { useLiquidGlass } from "../hooks/useLiquidGlass";
import { useSafeViewport } from "../hooks/useSafeViewport";
import { useTavusCall } from "../hooks/useTavusCall";
import {
  callReducer,
  isActiveCallPhase,
  type CallConfig,
  type CallPhase,
} from "../lib/callState";
import { CALL_MOTION, callScreenCssVars } from "../lib/callUi";
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

function morphDurationFor(mode: LocalCameraMode, phase: CallPhase): number {
  if (mode === "fullscreen" || phase === "joining") {
    return CALL_MOTION.joinMs;
  }
  return CALL_MOTION.controlMs;
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
  const connectingStartedAtRef = useRef<number | null>(null);

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
    isFlippingCamera,
    toggleVideo,
    toggleAudio,
    replaceVideoTrack,
    flipCamera: flipMediaCamera,
    palJoined,
    error: callError,
    cameraActionError,
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

  const {
    nodeRef: dragNodeRef,
    position: dragPosition,
    dragging,
    onPointerDown: onDragPointerDown,
    onPointerMove: onDragPointerMove,
    onPointerUp: onDragPointerUp,
  } = useDraggableSelfView(screenRef, {
    active: phase === "live",
    draggable: phase === "live" && controlsVisible,
    compact: !controlsVisible,
    safeInsets: viewport.safeInsets,
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

  useEffect(() => {
    if (phase === "connecting") {
      connectingStartedAtRef.current = performance.now();
      return;
    }
    connectingStartedAtRef.current = null;
  }, [phase]);

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
    // Fatal connection / Tavus / Daily / initial-media errors only.
    // cameraActionError must never enter this path.
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
    const started = connectingStartedAtRef.current ?? performance.now();
    const elapsed = performance.now() - started;
    const remaining = Math.max(0, CALL_MOTION.connectingMinMs - elapsed);
    const attempt = attemptRef.current;

    const advance = () => {
      if (attempt !== attemptRef.current) return;
      if (phaseRef.current !== "connecting") return;
      dispatch({ type: "REMOTE_FRAME" });
      phaseRef.current = "joining";
    };

    if (remaining === 0) {
      advance();
      return;
    }

    const id = window.setTimeout(advance, remaining);
    transitionTimers.current.push(id);
  });

  useEffect(() => {
    if (phase !== "joining") return;
    const attempt = attemptRef.current;
    clearTransitionTimers();
    const id = window.setTimeout(() => {
      if (attempt !== attemptRef.current) return;
      dispatch({ type: "JOIN_COMPLETE" });
      phaseRef.current = "live";
    }, CALL_MOTION.joinMs);
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
    // Disable only while a flip transaction is in flight.
    if (isFlippingCamera) return;
    hapticTap();
    bumpControls();
    // Transaction owns recovery; supply Daily attachment from useTavusCall.
    void flipMediaCamera(replaceVideoTrack);
  }, [bumpControls, flipMediaCamera, isFlippingCamera, replaceVideoTrack]);

  const onSelfPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      bumpControls();
      onDragPointerDown(event);
    },
    [bumpControls, onDragPointerDown],
  );

  const mode = localModeFor(phase, controlsVisible);
  const morphDurationMs = morphDurationFor(mode, phase);
  const showChrome =
    isActiveCallPhase(phase) && (phase !== "live" || controlsVisible);
  const showWaitingFlip = phase === "ringing" || phase === "connecting";
  const showLiveExtras = phase === "joining" || phase === "live";
  const flipPillVisible =
    showLiveExtras &&
    controlsVisible &&
    mode === "expanded" &&
    videoEnabled &&
    !dragging &&
    !isFlippingCamera;

  const flipOverlayRef = useRef<HTMLDivElement | null>(null);

  const {
    mode: liquidMode,
    refreshImmediate,
    syncVideoLayout,
  } = useLiquidGlass({
    enabled: showLocal,
    backgroundReady: backgroundReady && showLocal,
    phase,
    controlsVisible: showChrome,
    layoutMode: mode,
    videoEnabled,
  });

  // CallScreen owns the only self-view morph: local camera primary, Flip
  // overlay follower (outside #liquid-gl-snapshot). syncVideoLayout already
  // includes one metric pass — do not add refreshImmediate beside start/finish.
  useLayoutMorph(dragNodeRef, {
    activeKey: mode,
    durationMs: morphDurationMs,
    followers: [flipOverlayRef],
    onStart: syncVideoLayout,
    onFrame: refreshImmediate,
    onFinish: syncVideoLayout,
  });

  // Flip visibility changes (drag, camera switch, phase, chrome) need one
  // immediate metric refresh after the commit — not only on drag completion.
  useLayoutEffect(() => {
    refreshImmediate();
  }, [flipPillVisible, refreshImmediate]);

  const selfStyle = useMemo(() => {
    if (mode === "fullscreen" || !dragPosition) return undefined;
    return {
      top: dragPosition.top,
      left: dragPosition.left,
      right: "auto",
    } as CSSProperties;
  }, [dragPosition, mode]);

  const screenStyle = useMemo(
    () => callScreenCssVars(viewport.safeInsets) as CSSProperties,
    [viewport.safeInsets],
  );

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
      style={screenStyle}
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
            draggable={phase === "live" && controlsVisible}
            onPointerDown={onSelfPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
          />
        )}
      </div>

      <div className="liquid-canvas-layer" aria-hidden="true" />

      {showLocal && (
        <SelfViewControlsOverlay
          mode={mode}
          style={selfStyle}
          overlayRef={flipOverlayRef}
          flipVisible={flipPillVisible}
          flipDisabled={isFlippingCamera}
          onFlip={flipCamera}
        />
      )}

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
          onMetricsInvalidate={refreshImmediate}
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
          className="waiting-flip-btn control-btn liquidGL"
          data-visible={showWaitingFlip}
          aria-hidden={!showWaitingFlip}
          aria-label="Switch camera"
          title="Switch camera"
          disabled={isFlippingCamera}
          onClick={flipCamera}
          data-testid="waiting-flip"
          tabIndex={showWaitingFlip && !isFlippingCamera ? 0 : -1}
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

      {cameraActionError && isActiveCallPhase(phase) ? (
        <div
          className="camera-action-toast"
          role="status"
          aria-live="polite"
          data-testid="camera-action-error"
        >
          {cameraActionError}
        </div>
      ) : null}

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
