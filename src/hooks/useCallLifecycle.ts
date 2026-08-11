import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  callReducer,
  type CallAction,
  type CallPhase,
} from "../lib/callState";
import { CALL_MOTION } from "../lib/callUi";

export interface UseCallLifecycleInput {
  autoStart: boolean;
  startCall: () => Promise<void>;
  endTavusCall: () => Promise<void>;
  onExit: () => void;
  localStream: MediaStream | null;
  palJoined: boolean;
  callError: string | null;
  starting: boolean;
  /** Clears remote video/audio elements before teardown / restart. */
  clearRemoteMedia: () => void;
  /** Resets local visual readiness (e.g. backgroundReady) on beginCall. */
  onResetVisuals: () => void;
}

export interface UseCallLifecycleResult {
  phase: CallPhase;
  beginCall: () => Promise<void>;
  handleEndCall: () => void;
  /**
   * Wire to first remote video frame while `phase === "connecting"`.
   * Advances to joining after the minimum connecting duration.
   */
  onRemoteFirstFrame: () => void;
}

/**
 * Live-call phase machine: owns {@link callReducer}, attempt generation,
 * autoStart, and bootstrap → live / error transitions.
 *
 * Inject Tavus/media signals — do not call `useTavusCall` inside this hook.
 */
export function useCallLifecycle({
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
}: UseCallLifecycleInput): UseCallLifecycleResult {
  const [phase, dispatch] = useReducer(
    callReducer,
    autoStart ? "bootstrapping" : "idle",
  );

  const phaseRef = useRef<CallPhase>(autoStart ? "bootstrapping" : "idle");
  const transitionTimers = useRef<number[]>([]);
  const attemptRef = useRef(0);
  const connectingStartedAtRef = useRef<number | null>(null);
  const beginCallInFlightRef = useRef(false);

  const clearTransitionTimers = useCallback(() => {
    transitionTimers.current.forEach((id) => window.clearTimeout(id));
    transitionTimers.current = [];
  }, []);

  /** Single write path: update phaseRef then dispatch so async guards stay fresh. */
  const advance = useCallback((action: CallAction) => {
    const next = callReducer(phaseRef.current, action);
    phaseRef.current = next;
    dispatch(action);
  }, []);

  useEffect(() => {
    return () => {
      clearTransitionTimers();
    };
  }, [clearTransitionTimers]);

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
    beginCallInFlightRef.current = true;

    clearRemoteMedia();
    onResetVisuals();

    advance({ type: "START_CALL" });

    try {
      await startCall();
      if (attempt !== attemptRef.current) return;
    } finally {
      if (attempt === attemptRef.current) {
        beginCallInFlightRef.current = false;
      }
    }
  }, [
    advance,
    clearRemoteMedia,
    clearTransitionTimers,
    onResetVisuals,
    startCall,
  ]);

  useEffect(() => {
    if (!autoStart) return;

    // Defer past React Strict Mode's mount→unmount→remount so we only
    // create one Tavus conversation / Daily call.
    let cancelled = false;
    const outer = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        if (beginCallInFlightRef.current) return;
        if (attemptRef.current > 0) return;
        const preRinging =
          phaseRef.current === "idle" || phaseRef.current === "bootstrapping";
        if (!preRinging) return;
        void beginCall();
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(outer);
    };
  }, [autoStart, beginCall]);

  const handleEndCall = useCallback(() => {
    clearTransitionTimers();
    clearRemoteMedia();
    advance({ type: "END" });

    void (async () => {
      await endTavusCall();
      onExit();
    })();
  }, [advance, clearRemoteMedia, clearTransitionTimers, endTavusCall, onExit]);

  // Advance from bootstrapping as soon as local media is ready so the ringing
  // screen stays visible while Tavus create / Daily join continue.
  useEffect(() => {
    if (phase !== "bootstrapping") return;

    if (localStream) {
      advance({ type: "PERMISSIONS_GRANTED" });
      return;
    }

    if (!starting && callError) {
      const message = callError;
      if (/NotAllowedError|Permission denied|Permission/i.test(message)) {
        advance({ type: "PERMISSIONS_DENIED" });
        return;
      }
      advance({ type: "CONNECTION_FAILED" });
    }
  }, [advance, callError, localStream, phase, starting]);

  useEffect(() => {
    if (!palJoined) return;
    if (phaseRef.current !== "ringing") return;
    advance({ type: "PAL_JOINED" });
  }, [advance, palJoined]);

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
      advance({ type: "CONNECTION_FAILED" });
      void endTavusCall();
    }
  }, [
    advance,
    callError,
    clearRemoteMedia,
    clearTransitionTimers,
    endTavusCall,
  ]);

  const onRemoteFirstFrame = useCallback(() => {
    if (phaseRef.current !== "connecting") return;
    const started = connectingStartedAtRef.current ?? performance.now();
    const elapsed = performance.now() - started;
    const remaining = Math.max(0, CALL_MOTION.connectingMinMs - elapsed);
    const attempt = attemptRef.current;

    const goJoining = () => {
      if (attempt !== attemptRef.current) return;
      if (phaseRef.current !== "connecting") return;
      advance({ type: "REMOTE_FRAME" });
    };

    if (remaining === 0) {
      goJoining();
      return;
    }

    const id = window.setTimeout(goJoining, remaining);
    transitionTimers.current.push(id);
  }, [advance]);

  useEffect(() => {
    if (phase !== "joining") return;
    const attempt = attemptRef.current;
    clearTransitionTimers();
    const id = window.setTimeout(() => {
      if (attempt !== attemptRef.current) return;
      advance({ type: "JOIN_COMPLETE" });
    }, CALL_MOTION.joinMs);
    transitionTimers.current.push(id);
    return () => {
      window.clearTimeout(id);
      transitionTimers.current = transitionTimers.current.filter(
        (timerId) => timerId !== id,
      );
    };
  }, [advance, clearTransitionTimers, phase]);

  return {
    phase,
    beginCall,
    handleEndCall,
    onRemoteFirstFrame,
  };
}
