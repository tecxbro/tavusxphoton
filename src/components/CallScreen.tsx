import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { CallControlRail } from "./CallControlRail";
import { CallVisualShell } from "./CallVisualShell";
import { ContactPill } from "./ContactPill";
import { EffectsButton } from "./EffectsButton";
import { LocalCameraSurface } from "./LocalCameraSurface";
import { SelfViewControlsOverlay } from "./SelfViewControlsOverlay";
import { SymbolIcon } from "./SymbolIcon";
import { useAutoHideControls } from "../hooks/useAutoHideControls";
import { useCallAudio } from "../hooks/useCallAudio";
import { useCallLifecycle } from "../hooks/useCallLifecycle";
import { useDraggableSelfView } from "../hooks/useDraggableSelfView";
import { useFirstVideoFrame } from "../hooks/useFirstVideoFrame";
import { useLayoutMorph } from "../hooks/useLayoutMorph";
import { useLiquidGlass } from "../hooks/useLiquidGlass";
import { useSafeViewport } from "../hooks/useSafeViewport";
import { useTavusCall } from "../hooks/useTavusCall";
import {
  isActiveCallPhase,
  type CallConfig,
  type CallPhase,
} from "../lib/callState";
import {
  CALL_MOTION,
  callScreenCssVars,
  type LocalCameraMode,
} from "../lib/callUi";
import { hapticTap } from "../lib/haptics";

function redirectToPhotonHome() {
  window.location.replace("https://photon.codes");
}

interface CallScreenProps {
  /** Fixed agent-derived display identity. */
  config: CallConfig;
  /** When true, begins bootstrapping on mount (Garry landing). */
  autoStart?: boolean;
  /**
   * Fired after hang-up teardown (`endTavusCall`). Defaults to replacing
   * the page with https://photon.codes so Back cannot reopen the call.
   */
  onExit?: () => void;
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

/**
 * Live Garry FaceTime UI: presentation, LiquidGL, self-view drag/morph,
 * and Tavus/Daily wiring. Phase orchestration lives in {@link useCallLifecycle}.
 *
 * @param props.config - Display identity from fixed agent data.
 * @param props.autoStart - Auto-dispatch `START_CALL` on mount when true.
 * @param props.onExit - Post-end navigation (Photon home by default).
 */
export function CallScreen({
  config,
  autoStart = false,
  onExit = redirectToPhotonHome,
}: CallScreenProps) {
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [showGlassDebug, setShowGlassDebug] = useState(false);

  const screenRef = useRef<HTMLElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const {
    startCall,
    endCall: endTavusCall,
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

  const onResetVisuals = useCallback(() => {
    setBackgroundReady(false);
  }, []);

  const { phase, beginCall, handleEndCall, onRemoteFirstFrame } =
    useCallLifecycle({
      autoStart,
      startCall,
      endTavusCall,
      onExit,
      localStream,
      palJoined,
      callError,
      starting,
      clearRemoteMedia,
      onResetVisuals,
    });

  useCallAudio(phase, audioEnabled);

  const viewport = useSafeViewport();

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

  useEffect(() => {
    if (dragging) pauseControls();
    else if (phase === "live") resumeControls();
  }, [dragging, pauseControls, phase, resumeControls]);

  useEffect(() => {
    setShowGlassDebug(wantsDebugGlass());
  }, []);

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

  useFirstVideoFrame(remoteRef, phase === "connecting", onRemoteFirstFrame);

  const showLocal = isActiveCallPhase(phase) || phase === "bootstrapping";

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
    if (isFlippingCamera) return;
    hapticTap();
    bumpControls();
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
    (isActiveCallPhase(phase) || phase === "bootstrapping") &&
    (phase !== "live" || controlsVisible);
  const showWaitingFlip =
    phase === "bootstrapping" ||
    phase === "ringing" ||
    phase === "connecting";
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
    recapture,
  } = useLiquidGlass({
    enabled: showLocal,
    backgroundReady: backgroundReady && showLocal,
    phase,
    controlsVisible: showChrome,
    layoutMode: mode,
    videoEnabled,
  });

  const finishSelfViewMorph = useCallback(() => {
    recapture();
  }, [recapture]);

  useLayoutMorph(dragNodeRef, {
    activeKey: mode,
    durationMs: morphDurationMs,
    followers: [flipOverlayRef],
    onStart: refreshImmediate,
    onFrame: refreshImmediate,
    onFinish: finishSelfViewMorph,
  });

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
      <main
        className="call-screen call-screen--startup"
        data-testid="call-screen"
        data-phase="idle"
        style={screenStyle}
      />
    );
  }

  return (
    <CallVisualShell
      screenRef={screenRef}
      testId="call-screen"
      phase={phase}
      liquidMode={liquidMode}
      cameraOn={videoEnabled}
      style={screenStyle}
      chromeAttr={chromeVisibleAttr}
      stage={
        <>
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
              // Browser/WebRTC video→WebGL texture blitting produced black
              // pixels after post-snapshot rebuilds; runtime A/B confirmed
              // Canvas2D drawImage stays correct for this remote stream.
              data-liquid-video-upload="canvas"
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
        </>
      }
      localCamera={
        showLocal ? (
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
        ) : null
      }
      overlays={
        <>
          {showLocal ? (
            <SelfViewControlsOverlay
              mode={mode}
              style={selfStyle}
              overlayRef={flipOverlayRef}
              flipVisible={flipPillVisible}
              flipDisabled={isFlippingCamera}
              onFlip={flipCamera}
            />
          ) : null}
          {phase === "live" && !controlsVisible ? (
            <button
              type="button"
              className="tap-catcher"
              aria-label="Show call controls"
              onClick={() => showControls()}
              data-testid="tap-restore"
            />
          ) : null}
        </>
      }
      chrome={
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
      }
    >
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

      {phase === "permission-error" && (
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
                onExit();
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
            Could not connect to {config.participantName}. Try again.
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
                onExit();
              }}
            >
              Close
            </button>
          </div>
        </section>
      )}
    </CallVisualShell>
  );
}
