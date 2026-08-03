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
import { ApertureButton } from "./ApertureButton";
import { CallControlRail } from "./CallControlRail";
import { CameraActivationFallback } from "./CameraActivationFallback";
import { ContactPill } from "./ContactPill";
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
import { useMediaDevices } from "../hooks/useMediaDevices";
import { useSafeViewport } from "../hooks/useSafeViewport";
import {
  JOIN_MORPH_MS,
  callReducer,
  isActiveCallPhase,
  type CallConfig,
  type CallPhase,
} from "../lib/callState";
import { hapticTap } from "../lib/haptics";
import { createPhoControllerChannel } from "../lib/phoControllerChannel";

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

export function CallScreen({ config }: CallScreenProps) {
  const [phase, dispatch] = useReducer(callReducer, "bootstrapping");
  const [needsGesture, setNeedsGesture] = useState(false);

  const screenRef = useRef<HTMLElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const phaseRef = useRef<CallPhase>(phase);
  const transitionTimers = useRef<number[]>([]);
  const bootstrapped = useRef(false);

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

  useEffect(() => {
    if (dragging) pauseControls();
    else if (phase === "live") resumeControls();
  }, [dragging, pauseControls, phase, resumeControls]);

  useEffect(() => {
    return () => {
      clearTransitionTimers();
    };
  }, [clearTransitionTimers]);

  const beginCall = useCallback(async () => {
    clearTransitionTimers();

    if (remoteRef.current) {
      remoteRef.current.pause();
      remoteRef.current.removeAttribute("src");
      remoteRef.current.load();
    }

    setNeedsGesture(false);

    const prior = phaseRef.current;
    if (isActiveCallPhase(prior)) {
      stopAll();
      stopTimer();
      dispatch({ type: "END" });
      phaseRef.current = "ended";
    }

    dispatch({ type: "BOOTSTRAP" });
    phaseRef.current = "bootstrapping";

    const nextStream = await requestPermissions();
    if (!nextStream) {
      const message = mediaError ?? "";
      if (!/NotAllowedError|Permission denied|Permission/i.test(message)) {
        setNeedsGesture(true);
      }
      dispatch({ type: "PERMISSIONS_DENIED" });
      return;
    }

    resetTimer();
    dispatch({ type: "PERMISSIONS_GRANTED" });
    phaseRef.current = "ringing";
  }, [
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
    if (remoteRef.current) {
      remoteRef.current.pause();
      remoteRef.current.removeAttribute("src");
      remoteRef.current.load();
    }
    stopTimer();
    dispatch({ type: "END" });
  }, [clearTransitionTimers, stopAll, stopTimer]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void beginCall();
  }, [beginCall]);

  useEffect(() => {
    const controller = createPhoControllerChannel((message) => {
      if (message.type === "answer") {
        if (phaseRef.current === "ringing") {
          dispatch({ type: "PHO_ANSWERED" });
        }
        return;
      }

      if (message.type === "end") {
        endCall();
        return;
      }

      void beginCall();
    });

    return controller.close;
  }, [beginCall, endCall]);

  useFirstVideoFrame(remoteRef, phase === "connecting", () => {
    dispatch({ type: "REMOTE_FRAME" });
  });

  useEffect(() => {
    if (phase !== "joining") return;
    clearTransitionTimers();
    const id = window.setTimeout(() => {
      dispatch({ type: "JOIN_COMPLETE" });
    }, JOIN_MORPH_MS);
    transitionTimers.current.push(id);
    return () => {
      window.clearTimeout(id);
      transitionTimers.current = transitionTimers.current.filter(
        (timerId) => timerId !== id,
      );
    };
  }, [clearTransitionTimers, phase]);

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
  const showRemote =
    phase === "connecting" || phase === "joining" || phase === "live";

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

  return (
    <main
      ref={screenRef}
      className="call-screen"
      data-testid="call-screen"
      data-phase={phase}
      data-chrome={chromeVisibleAttr}
      data-camera={videoEnabled ? "on" : "off"}
    >
      <div id="video-stage">
        <div className="remote-video-wrap">
          {showRemote ? (
            <video
              ref={remoteRef}
              className="remote-video-surface"
              src={config.remoteVideo}
              autoPlay
              playsInline
              loop
              muted
              preload="auto"
              crossOrigin="anonymous"
              data-revealed={
                phase === "joining" || phase === "live" || undefined
              }
              data-testid="remote-video"
              onError={() => dispatch({ type: "CONNECTION_FAILED" })}
            />
          ) : null}
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
        <ApertureButton />

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

        {showWaitingFlip && (
          <button
            type="button"
            className="waiting-flip-btn liquidGL control-btn"
            aria-label="Switch camera"
            title="Switch camera"
            onClick={flipCamera}
            data-testid="waiting-flip"
          >
            <span className="content">
              <SymbolIcon name="camera.rotate" size={22} />
            </span>
          </button>
        )}
      </div>

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
              onClick={() => dispatch({ type: "CLOSE" })}
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
              onClick={() => dispatch({ type: "CLOSE" })}
            >
              Close
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
