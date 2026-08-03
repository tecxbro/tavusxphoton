import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ApertureButton } from "./ApertureButton";
import { CallControlRail } from "./CallControlRail";
import { CameraActivationFallback } from "./CameraActivationFallback";
import { CaptureButton } from "./CaptureButton";
import { CaptureFlash, CaptureToast } from "./CaptureToast";
import { ContactPill } from "./ContactPill";
import { EndedScreen } from "./EndedScreen";
import {
  LocalCameraSurface,
  type LocalCameraMode,
} from "./LocalCameraSurface";
import { MorePopover } from "./MorePopover";
import { SymbolIcon } from "./SymbolIcon";
import { useAutoHideControls } from "../hooks/useAutoHideControls";
import { useCallTimer } from "../hooks/useCallTimer";
import { useDraggableSelfView } from "../hooks/useDraggableSelfView";
import { useFirstVideoFrame } from "../hooks/useFirstVideoFrame";
import { useMediaDevices } from "../hooks/useMediaDevices";
import { useSafeViewport } from "../hooks/useSafeViewport";
import {
  CAPTURE_FLASH_HOLD_MS,
  CAPTURE_FLASH_IN_MS,
  CAPTURE_FLASH_OUT_MS,
  CAPTURE_TOAST_MS,
  CONNECTING_MIN_MS,
  DIALING_MIN_MS,
  JOIN_MORPH_MS,
  callReducer,
  isActiveCallPhase,
  type CallConfig,
  type CallOverlay,
  type CallPhase,
} from "../lib/callState";
import {
  CaptureFrameError,
  captureCallFrame,
  shareOrDownloadCapture,
} from "../lib/captureCallFrame";
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

function localModeFor(
  phase: CallPhase,
  chromeVisible: boolean,
): LocalCameraMode {
  if (phase === "dialing" || phase === "connecting") return "fullscreen";
  if (phase === "joining") return "expanded";
  if (phase === "live") return chromeVisible ? "expanded" : "compact";
  return "fullscreen";
}

export function CallScreen({ config }: CallScreenProps) {
  const [phase, dispatch] = useReducer(callReducer, "bootstrapping");
  const [overlay, setOverlay] = useState<CallOverlay>("none");
  const [needsGesture, setNeedsGesture] = useState(false);
  const [remoteRevealed, setRemoteRevealed] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("You took a FaceTime photo.");
  const [perfSample, setPerfSample] = useState<PerformanceSample | null>(null);
  const [perfMode, setPerfMode] = useState<PerformanceMode>("full");
  const [audioRouteLabel, setAudioRouteLabel] = useState("iPhone");

  const screenRef = useRef<HTMLElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const glassRef = useRef<GlassController | null>(null);
  const phaseRef = useRef<CallPhase>(phase);
  const dialingStarted = useRef<number | null>(null);
  const connectingStarted = useRef<number | null>(null);
  const joinScheduled = useRef(false);
  const captureTimers = useRef<number[]>([]);
  const bootstrapped = useRef(false);

  phaseRef.current = phase;

  const media = useMediaDevices();
  const viewport = useSafeViewport();
  const timer = useCallTimer(phase === "live");

  const overlayOpen = overlay !== "none";
  const autoHide = useAutoHideControls(
    phase === "live",
    overlayOpen ||
      phase === "permission-error" ||
      phase === "connection-error",
  );

  const dragEnabled = phase === "live" && autoHide.visible;
  const drag = useDraggableSelfView(screenRef, dragEnabled, {
    compact: !autoHide.visible,
  });

  useEffect(() => {
    if (drag.dragging) autoHide.pause();
    else if (phase === "live" && overlay === "none") autoHide.resume();
  }, [autoHide, drag.dragging, overlay, phase]);

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
      captureTimers.current.forEach((id) => window.clearTimeout(id));
    };
  }, [destroyGlass]);

  useEffect(() => {
    if (!isActiveCallPhase(phase)) {
      destroyGlass();
      return;
    }
    const id = window.setTimeout(() => ensureGlass(), 60);
    return () => window.clearTimeout(id);
  }, [destroyGlass, ensureGlass, phase, overlay, autoHide.visible]);

  useEffect(() => {
    const onResize = () => {
      glassRef.current?.refresh();
      if (isActiveCallPhase(phase)) ensureGlass();
    };
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [ensureGlass, phase]);

  useEffect(() => {
    if (!import.meta.env.DEV || phase !== "live") return;
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
  }, [perfMode, phase, viewport.height, viewport.width]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") destroyGlass();
      else if (isActiveCallPhase(phase)) ensureGlass();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [destroyGlass, ensureGlass, phase]);

  useEffect(() => {
    let cancelled = false;
    void navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((devices) => {
        if (cancelled) return;
        const audio = devices.find(
          (device) =>
            device.kind === "audioinput" &&
            device.label &&
            !/default|communications/i.test(device.label),
        );
        if (audio?.label) setAudioRouteLabel(audio.label);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [media.stream]);

  const beginCall = useCallback(async () => {
    setNeedsGesture(false);
    setRemoteRevealed(false);
    setOverlay("none");
    joinScheduled.current = false;
    dialingStarted.current = null;
    connectingStarted.current = null;
    dispatch({ type: "BOOTSTRAP" });

    const stream = await media.requestPermissions();
    if (!stream) {
      const message = media.error ?? "";
      if (!/NotAllowedError|Permission denied|Permission/i.test(message)) {
        setNeedsGesture(true);
      }
      dispatch({ type: "PERMISSIONS_DENIED" });
      return;
    }

    dispatch({ type: "PERMISSIONS_GRANTED" });
    dialingStarted.current = performance.now();
    timer.reset();
    void remoteRef.current?.load();
    void remoteRef.current?.play().catch(() => undefined);
  }, [media, timer]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void beginCall();
  }, [beginCall]);

  useEffect(() => {
    if (phase !== "dialing" || dialingStarted.current == null) return;
    const elapsed = performance.now() - dialingStarted.current;
    const wait = Math.max(0, DIALING_MIN_MS - elapsed);
    const id = window.setTimeout(() => {
      connectingStarted.current = performance.now();
      dispatch({ type: "ENTER_CONNECTING" });
    }, wait);
    return () => window.clearTimeout(id);
  }, [phase]);

  const startJoin = useCallback(() => {
    if (joinScheduled.current) return;
    const current = phaseRef.current;
    if (current !== "connecting" && current !== "dialing") return;
    joinScheduled.current = true;

    const enterJoining = () => {
      setRemoteRevealed(true);
      void remoteRef.current?.play().catch(() => {
        dispatch({ type: "CONNECTION_FAILED" });
      });
      dispatch({ type: "REMOTE_FRAME" });
    };

    if (current === "dialing") {
      connectingStarted.current = performance.now();
      dispatch({ type: "ENTER_CONNECTING" });
      window.setTimeout(enterJoining, CONNECTING_MIN_MS);
      return;
    }

    const started = connectingStarted.current ?? performance.now();
    const wait = Math.max(0, CONNECTING_MIN_MS - (performance.now() - started));
    window.setTimeout(enterJoining, wait);
  }, []);

  useFirstVideoFrame(
    remoteRef,
    phase === "dialing" || phase === "connecting",
    startJoin,
  );

  useEffect(() => {
    if (phase !== "joining") return;
    const id = window.setTimeout(() => {
      dispatch({ type: "JOIN_COMPLETE" });
      window.setTimeout(() => glassRef.current?.refresh(), 40);
    }, JOIN_MORPH_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  const endCall = useCallback(() => {
    media.stopAll();
    remoteRef.current?.pause();
    timer.stop();
    destroyGlass();
    setOverlay("none");
    setFlashActive(false);
    setToastVisible(false);
    dispatch({ type: "END" });
  }, [destroyGlass, media, timer]);

  const flipCamera = useCallback(() => {
    hapticTap();
    autoHide.bump();
    void media.flipCamera();
  }, [autoHide, media]);

  const runCapture = useCallback(async () => {
    const remote = remoteRef.current;
    const stage = screenRef.current;
    const selfNode = drag.nodeRef.current;
    if (!remote || !stage || !selfNode) return;

    autoHide.pause();
    setOverlay("capture-feedback");
    captureTimers.current.forEach((id) => window.clearTimeout(id));
    captureTimers.current = [];

    setFlashActive(true);
    const flashOut = CAPTURE_FLASH_IN_MS + CAPTURE_FLASH_HOLD_MS;
    captureTimers.current.push(
      window.setTimeout(() => setFlashActive(false), flashOut + CAPTURE_FLASH_OUT_MS),
    );

    const stageRect = stage.getBoundingClientRect();
    const selfRect = selfNode.getBoundingClientRect();
    const radius =
      parseFloat(getComputedStyle(selfNode).borderRadius) ||
      (autoHide.visible ? 24 : 22);

    try {
      const { blob, filename } = await captureCallFrame({
        sessionId: config.sessionId,
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        remoteVideo: remote,
        localVideo: localVideoRef.current,
        selfView: {
          x: selfRect.left - stageRect.left,
          y: selfRect.top - stageRect.top,
          width: selfRect.width,
          height: selfRect.height,
          radius,
          mirrored: media.facingMode === "user",
          videoEnabled: media.videoEnabled,
          placeholderLabel: "You",
          placeholderAvatar: config.selfAvatar,
        },
      });
      await shareOrDownloadCapture(blob, filename);
      setToastMessage("You took a FaceTime photo.");
    } catch (error) {
      const message =
        error instanceof CaptureFrameError
          ? error.message
          : "Unable to take photo.";
      setToastMessage(message);
    }

    setToastVisible(true);
    captureTimers.current.push(
      window.setTimeout(() => {
        setToastVisible(false);
        setOverlay("none");
        autoHide.resume();
      }, CAPTURE_TOAST_MS),
    );
  }, [autoHide, config.sessionId, config.selfAvatar, drag.nodeRef, media.facingMode, media.videoEnabled]);

  const mode = localModeFor(phase, autoHide.visible);
  const showLocal = isActiveCallPhase(phase);
  const showChrome =
    isActiveCallPhase(phase) &&
    (phase !== "live" || autoHide.visible);
  const showWaitingFlip = phase === "dialing" || phase === "connecting";
  const showLiveExtras = phase === "joining" || phase === "live";

  const selfStyle = useMemo(() => {
    if (mode === "fullscreen" || !drag.position) return undefined;
    return {
      top: drag.position.top,
      left: drag.position.left,
      right: "auto",
    } as CSSProperties;
  }, [drag.position, mode]);

  const chromeVisibleAttr =
    phase === "live" ? (autoHide.visible ? "visible" : "hidden") : "visible";

  return (
    <main
      ref={screenRef}
      className="call-screen"
      data-testid="call-screen"
      data-phase={phase}
      data-chrome={chromeVisibleAttr}
      data-overlay={overlay}
      data-camera={media.videoEnabled ? "on" : "off"}
    >
      <div id="video-stage">
        <div className="remote-video-wrap">
          <video
            ref={remoteRef}
            className="remote-video-surface"
            src={config.remoteVideo}
            autoPlay
            playsInline
            loop
            muted
            crossOrigin="anonymous"
            data-revealed={remoteRevealed || undefined}
            data-testid="remote-video"
          />
        </div>
        <div className="video-overlay" />
      </div>

      {showLocal && (
        <LocalCameraSurface
          stream={media.stream}
          videoEnabled={media.videoEnabled}
          mirrored={media.facingMode === "user"}
          mode={mode}
          selfName="You"
          selfAvatar={config.selfAvatar}
          showFlipCapsule={showLiveExtras && autoHide.visible}
          style={selfStyle}
          nodeRef={drag.nodeRef}
          videoRef={localVideoRef}
          onFlip={flipCamera}
          draggable={dragEnabled}
          onPointerDown={(event) => {
            autoHide.bump();
            drag.onPointerDown(event);
          }}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
        />
      )}

      {phase === "live" && !autoHide.visible && (
        <button
          type="button"
          className="tap-catcher"
          aria-label="Show call controls"
          onClick={() => autoHide.show()}
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
          onClick={() => autoHide.bump()}
        />
        <ApertureButton onClick={() => autoHide.bump()} />

        {showLiveExtras && (
          <CaptureButton
            onClick={() => {
              autoHide.bump();
              void runCapture();
            }}
          />
        )}

        <CallControlRail
          videoEnabled={media.videoEnabled}
          audioEnabled={media.audioEnabled}
          moreButtonRef={moreButtonRef}
          onToggleCamera={() => {
            autoHide.bump();
            media.toggleVideo();
          }}
          onToggleMic={() => {
            autoHide.bump();
            media.toggleAudio();
          }}
          onMore={() => {
            hapticTap();
            autoHide.bump();
            setOverlay("more");
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

      <MorePopover
        open={overlay === "more"}
        audioLabel={audioRouteLabel}
        contactName={config.participantName}
        contactAvatar={config.participantAvatar}
        anchorRef={moreButtonRef}
        onClose={() => {
          setOverlay("none");
          autoHide.bump();
        }}
      />

      <CaptureFlash active={flashActive} />
      <CaptureToast visible={toastVisible} message={toastMessage} />

      {needsGesture && (
        <CameraActivationFallback
          onStart={() => {
            void beginCall();
          }}
        />
      )}

      {phase === "ended" && (
        <EndedScreen
          duration={timer.formatted}
          onCallAgain={() => {
            timer.reset();
            void beginCall();
          }}
          onClose={() => {
            timer.reset();
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

      <PerformanceHud sample={perfSample} />
    </main>
  );
}
