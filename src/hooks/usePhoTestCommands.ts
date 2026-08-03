import { useEffect, useRef } from "react";
import type { CallPhase } from "../lib/callState";
import {
  acknowledgePhoTestCommand,
  getPhoTestState,
} from "../lib/phoTestControllerClient";
import {
  isSafeSessionId,
  type PhoTestAction,
} from "../contracts/phoTestController";

const POLL_MS = 350;

interface PendingAck {
  revision: number;
  action: PhoTestAction;
  /** True when answer was applied from ringing and must wait for progress. */
  expectProgress: boolean;
}

function revisionStorageKey(sessionId: string): string {
  return `mini-pho:last-applied-revision:${sessionId}`;
}

function readStoredRevision(sessionId: string): number {
  try {
    const raw = sessionStorage.getItem(revisionStorageKey(sessionId));
    const value = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeStoredRevision(sessionId: string, revision: number): void {
  try {
    sessionStorage.setItem(revisionStorageKey(sessionId), String(revision));
  } catch {
    // sessionStorage may be unavailable; ref still guards duplicates in-tab.
  }
}

function ensureClientId(): string {
  const key = "mini-pho:test-client-id";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return `client-${Date.now()}`;
  }
}

function isPhoTestEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_PHO_TEST_CONTROLLER === "true";
}

function shouldAcknowledge(pending: PendingAck, phase: CallPhase): boolean {
  switch (pending.action) {
    case "answer":
      if (pending.expectProgress) {
        return (
          phase === "connecting" ||
          phase === "joining" ||
          phase === "live"
        );
      }
      return true;
    case "end":
      return phase === "ended";
    case "reset":
      return phase === "ringing";
    default: {
      const _exhaustive: never = pending.action;
      return _exhaustive;
    }
  }
}

export interface PhoTestCommandHandlers {
  onAnswer: () => void;
  onEnd: () => void;
  onReset: () => void;
  getPhase: () => CallPhase;
}

/**
 * Polls the temporary test-controller API and applies each new revision once.
 * Acknowledgements are deferred until the resulting phase matches the action
 * so the controller UI never treats a bare POST as success.
 */
export function usePhoTestCommands(
  sessionId: string,
  handlers: PhoTestCommandHandlers,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const lastAppliedRef = useRef(0);
  const inflightRef = useRef(false);
  // Holds the applied revision until shouldAcknowledge sees the expected phase.
  const pendingAckRef = useRef<PendingAck | null>(null);

  useEffect(() => {
    if (!isPhoTestEnabled()) return;
    if (!isSafeSessionId(sessionId)) return;

    lastAppliedRef.current = readStoredRevision(sessionId);
    const clientId = ensureClientId();
    const abort = new AbortController();
    let timer: number | null = null;
    let stopped = false;

    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = (delay = POLL_MS) => {
      clearTimer();
      if (stopped) return;
      timer = window.setTimeout(() => {
        void tick();
      }, delay);
    };

    const tryAcknowledge = async () => {
      const pending = pendingAckRef.current;
      if (!pending) return;
      const phase = handlersRef.current.getPhase();
      if (!shouldAcknowledge(pending, phase)) return;

      pendingAckRef.current = null;
      try {
        await acknowledgePhoTestCommand(
          sessionId,
          pending.revision,
          phase,
          clientId,
          abort.signal,
        );
      } catch {
        pendingAckRef.current = pending;
      }
    };

    const applyCommand = async () => {
      const state = await getPhoTestState(sessionId, abort.signal);
      const command = state.command;
      if (!command || command.revision <= lastAppliedRef.current) {
        await tryAcknowledge();
        return;
      }

      const phaseBefore = handlersRef.current.getPhase();
      let expectProgress = false;

      switch (command.action) {
        case "answer": {
          if (phaseBefore === "ringing") {
            handlersRef.current.onAnswer();
            expectProgress = true;
          }
          break;
        }
        case "end": {
          if (
            phaseBefore === "ringing" ||
            phaseBefore === "connecting" ||
            phaseBefore === "joining" ||
            phaseBefore === "live"
          ) {
            handlersRef.current.onEnd();
          }
          break;
        }
        case "reset": {
          handlersRef.current.onReset();
          break;
        }
        default: {
          const _exhaustive: never = command.action;
          void _exhaustive;
        }
      }

      lastAppliedRef.current = command.revision;
      writeStoredRevision(sessionId, command.revision);
      // Persist before ack so a reload does not re-apply the same revision.
      pendingAckRef.current = {
        revision: command.revision,
        action: command.action,
        expectProgress,
      };

      await Promise.resolve();
      await tryAcknowledge();
    };

    const tick = async () => {
      if (stopped || inflightRef.current) {
        schedule();
        return;
      }
      if (document.visibilityState === "hidden") {
        schedule(1000);
        return;
      }

      inflightRef.current = true;
      try {
        await applyCommand();
      } catch {
        // Poll errors are expected while the API is unreachable.
      } finally {
        inflightRef.current = false;
        schedule();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void tick();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", tick);
    void tick();

    return () => {
      stopped = true;
      clearTimer();
      abort.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", tick);
    };
  }, [sessionId]);
}
