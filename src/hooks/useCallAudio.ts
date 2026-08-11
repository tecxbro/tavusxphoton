import { useEffect, useRef } from "react";
import {
  createCallAudioController,
  type CallAudioController,
} from "../lib/callAudio";
import type { CallPhase } from "../lib/callState";

/** Audio SFX phases mirror the live call phase model. */
export type CallAudioPhase = CallPhase;

/**
 * Maps call-phase + mic state to FaceTime SFX. Side effects run in effects
 * only — never from render. One controller instance lives for the screen.
 *
 * @param phase - Call or busy-mapped audio phase.
 * @param audioEnabled - Mic enabled flag for mute/unmute one-shots.
 */
export function useCallAudio(
  phase: CallAudioPhase,
  audioEnabled: boolean,
): void {
  const controllerRef = useRef<CallAudioController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createCallAudioController();
  }

  const prevPhaseRef = useRef<CallAudioPhase | null>(null);
  const prevMicRef = useRef<boolean | null>(null);
  const micPrimedRef = useRef(false);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    const onInteract = () => {
      controller.preload();
    };

    window.addEventListener("pointerdown", onInteract, { once: true });
    window.addEventListener("keydown", onInteract, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (phase === "ringing") {
      if (prev !== "ringing") {
        controller.resetSession();
        controller.startRinging();
      }
      return;
    }

    if (phase === "connecting") {
      if (prev === "ringing") {
        controller.playConnected();
      } else {
        controller.stopRinging();
      }
      return;
    }

    if (phase === "ended") {
      controller.playEnded();
      return;
    }

    // Failures, idle, bootstrap, and live/joining: never leave ringtone running.
    controller.stopRinging();
  }, [phase]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    if (!micPrimedRef.current) {
      micPrimedRef.current = true;
      prevMicRef.current = audioEnabled;
      return;
    }

    const prev = prevMicRef.current;
    prevMicRef.current = audioEnabled;
    if (prev === null || prev === audioEnabled) return;

    if (audioEnabled) controller.playMicUnmute();
    else controller.playMicMute();
  }, [audioEnabled]);
}
