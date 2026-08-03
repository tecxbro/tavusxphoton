import { useCallback, useEffect, useRef, useState } from "react";
import {
  isSafeSessionId,
  type PhoTestAction,
  type PhoTestCommand,
  type PhoTestState,
} from "../contracts/phoTestController";
import {
  getPhoTestState,
  PhoTestClientError,
  sendPhoTestCommand,
} from "../lib/phoTestControllerClient";

type ConnectionState = "checking" | "reachable" | "unavailable" | "disabled";
type CommandStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "queued"; revision: number }
  | { kind: "applied"; phase: string; revision: number }
  | { kind: "queued-timeout"; revision: number }
  | { kind: "error"; message: string };

const SECRET_STORAGE_KEY = "mini-pho:controller-secret";
const ACK_WAIT_MS = 15_000;
const POLL_MS = 350;

function isControllerEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_PHO_TEST_CONTROLLER === "true";
}

function readStoredSecret(): string {
  try {
    return sessionStorage.getItem(SECRET_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredSecret(value: string): void {
  try {
    if (!value) sessionStorage.removeItem(SECRET_STORAGE_KEY);
    else sessionStorage.setItem(SECRET_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

function statusLabel(status: CommandStatus): string {
  switch (status.kind) {
    case "idle":
      return "Idle";
    case "sending":
      return "Sending";
    case "queued":
      return `Queued revision ${status.revision}`;
    case "applied":
      return `Applied: ${status.phase}`;
    case "queued-timeout":
      return "Queued, call client has not acknowledged";
    case "error":
      return `Error: ${status.message}`;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function PhoController() {
  const enabled = isControllerEnabled();
  const [sessionId, setSessionId] = useState("demo");
  const [secret, setSecret] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [status, setStatus] = useState<CommandStatus>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [lastRevision, setLastRevision] = useState<number | null>(null);
  const waitAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSecret(readStoredSecret());
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnection("disabled");
      return;
    }

    const abort = new AbortController();
    let timer: number | null = null;
    let failures = 0;

    const check = async () => {
      try {
        await getPhoTestState(
          isSafeSessionId(sessionId) ? sessionId : "demo",
          abort.signal,
        );
        if (abort.signal.aborted) return;
        failures = 0;
        setConnection("reachable");
      } catch (error) {
        if (abort.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (error instanceof PhoTestClientError && error.status === 404) {
          setConnection("disabled");
          return;
        }
        failures += 1;
        if (failures >= 2) {
          setConnection("unavailable");
        }
      }
      if (abort.signal.aborted) return;
      timer = window.setTimeout(() => {
        void check();
      }, 2000);
    };

    void check();
    return () => {
      abort.abort();
      if (timer != null) window.clearTimeout(timer);
    };
  }, [enabled, sessionId]);

  useEffect(() => {
    return () => {
      waitAbortRef.current?.abort();
    };
  }, []);

  const waitForAck = useCallback(
    async (command: PhoTestCommand, signal: AbortSignal) => {
      const started = Date.now();
      setStatus({ kind: "queued", revision: command.revision });
      setLastRevision(command.revision);

      while (Date.now() - started < ACK_WAIT_MS) {
        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        const state: PhoTestState = await getPhoTestState(
          command.sessionId,
          signal,
        );
        const ack = state.acknowledgement;
        if (ack && ack.revision === command.revision) {
          setStatus({
            kind: "applied",
            phase: ack.resultingPhase,
            revision: ack.revision,
          });
          return;
        }
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, POLL_MS);
          const onAbort = () => {
            window.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          };
          signal.addEventListener("abort", onAbort, { once: true });
        });
      }

      setStatus({ kind: "queued-timeout", revision: command.revision });
    },
    [],
  );

  const runAction = useCallback(
    async (action: PhoTestAction) => {
      if (!enabled || busy) return;
      if (!isSafeSessionId(sessionId)) {
        setStatus({ kind: "error", message: "Invalid session id" });
        return;
      }
      if (!secret) {
        setStatus({ kind: "error", message: "Missing controller secret" });
        return;
      }

      waitAbortRef.current?.abort();
      const abort = new AbortController();
      waitAbortRef.current = abort;

      setBusy(true);
      setStatus({ kind: "sending" });

      try {
        const command = await sendPhoTestCommand(
          sessionId,
          action,
          secret,
          abort.signal,
        );
        await waitForAck(command, abort.signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        const message =
          error instanceof PhoTestClientError
            ? error.safeMessage
            : "Request failed";
        setStatus({ kind: "error", message });
      } finally {
        setBusy(false);
      }
    },
    [busy, enabled, secret, sessionId, waitForAck],
  );

  if (!enabled) {
    return (
      <main className="pho-controller" data-testid="pho-controller">
        <h1 className="pho-controller__title">Pho Test Controller</h1>
        <p className="pho-controller__status" data-testid="pho-controller-status">
          Feature disabled
        </p>
      </main>
    );
  }

  const connectionLabel =
    connection === "reachable"
      ? "API reachable"
      : connection === "unavailable"
        ? "API unavailable"
        : connection === "disabled"
          ? "Feature disabled"
          : "Checking API…";

  return (
    <main className="pho-controller" data-testid="pho-controller">
      <h1 className="pho-controller__title">Pho Test Controller</h1>
      <p className="pho-controller__meta">
        Origin: <code>{window.location.origin}</code>
      </p>
      <p className="pho-controller__meta" data-testid="pho-connection">
        Connection: {connectionLabel}
      </p>
      <p className="pho-controller__meta" data-testid="pho-session-display">
        Session: {sessionId}
      </p>
      {lastRevision != null ? (
        <p className="pho-controller__meta" data-testid="pho-revision">
          Last revision: {lastRevision}
        </p>
      ) : null}

      <label className="pho-controller__field">
        <span>Session ID</span>
        <input
          type="text"
          value={sessionId}
          data-testid="pho-session-input"
          autoComplete="off"
          onChange={(event) => setSessionId(event.target.value.trim() || "demo")}
        />
      </label>

      <label className="pho-controller__field">
        <span>Controller secret</span>
        <input
          type="password"
          value={secret}
          data-testid="pho-secret-input"
          autoComplete="off"
          onChange={(event) => {
            const next = event.target.value;
            setSecret(next);
            writeStoredSecret(next);
          }}
        />
      </label>
      <button
        type="button"
        className="pho-controller__btn pho-controller__btn--clear"
        data-testid="pho-clear-secret"
        onClick={() => {
          setSecret("");
          writeStoredSecret("");
        }}
      >
        Clear Secret
      </button>

      <p
        className="pho-controller__status"
        data-testid="pho-controller-status"
      >
        Status: {statusLabel(status)}
      </p>

      <div className="pho-controller__actions">
        <button
          type="button"
          className="pho-controller__btn pho-controller__btn--answer"
          data-testid="pho-answer"
          disabled={busy || connection === "disabled"}
          onClick={() => {
            void runAction("answer");
          }}
        >
          Pick Up Call
        </button>
        <button
          type="button"
          className="pho-controller__btn pho-controller__btn--end"
          data-testid="pho-end"
          disabled={busy || connection === "disabled"}
          onClick={() => {
            void runAction("end");
          }}
        >
          End Call
        </button>
        <button
          type="button"
          className="pho-controller__btn pho-controller__btn--reset"
          data-testid="pho-reset"
          disabled={busy || connection === "disabled"}
          onClick={() => {
            void runAction("reset");
          }}
        >
          Reset Test
        </button>
      </div>
    </main>
  );
}
