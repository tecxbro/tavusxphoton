import {
  isCallResultPhase,
  isPhoTestAction,
  isSafeSessionId,
  type CallResultPhase,
  type PhoTestAction,
  type PhoTestAcknowledgement,
  type PhoTestCommand,
  type PhoTestState,
} from "../contracts/phoTestController";

export class PhoTestClientError extends Error {
  readonly status: number;
  readonly safeMessage: string;

  constructor(status: number, safeMessage: string) {
    super(safeMessage);
    this.name = "PhoTestClientError";
    this.status = status;
    this.safeMessage = safeMessage;
  }
}

function assertNeverLoggedSecret(value: unknown): void {
  if (typeof value === "string" && /bearer\s+/i.test(value)) {
    throw new Error("Refusing to process authorization material in errors");
  }
}

async function parseJson(
  response: Response,
): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PhoTestClientError(response.status, "Invalid server response");
  }
}

function isPhoTestCommand(value: unknown): value is PhoTestCommand {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PhoTestCommand>;
  return (
    typeof candidate.sessionId === "string" &&
    isSafeSessionId(candidate.sessionId) &&
    isPhoTestAction(candidate.action) &&
    typeof candidate.revision === "number" &&
    typeof candidate.issuedAt === "string"
  );
}

function isPhoTestAcknowledgement(
  value: unknown,
): value is PhoTestAcknowledgement {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PhoTestAcknowledgement>;
  return (
    typeof candidate.revision === "number" &&
    typeof candidate.appliedAt === "string" &&
    isCallResultPhase(candidate.resultingPhase) &&
    typeof candidate.clientId === "string"
  );
}

function isPhoTestState(value: unknown): value is PhoTestState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PhoTestState>;
  const commandOk =
    candidate.command === null || isPhoTestCommand(candidate.command);
  const ackOk =
    candidate.acknowledgement === null ||
    isPhoTestAcknowledgement(candidate.acknowledgement);
  return commandOk && ackOk;
}

function safeErrorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const message = (body as { error?: unknown }).error;
    if (typeof message === "string" && message.length > 0) {
      assertNeverLoggedSecret(message);
      return message.slice(0, 160);
    }
  }
  if (status === 401) return "Unauthorized";
  if (status === 404) return "Not found";
  if (status === 429) return "Too many requests";
  if (status >= 500) return "Server error";
  return "Request failed";
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function getPhoTestState(
  sessionId: string,
  signal?: AbortSignal,
): Promise<PhoTestState> {
  if (!isSafeSessionId(sessionId)) {
    throw new PhoTestClientError(400, "Invalid session id");
  }

  let attempt = 0;
  let lastError: unknown;

  while (attempt < 3) {
    try {
      const response = await fetch(
        `/api/test-call/state?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: "GET",
          cache: "no-store",
          signal,
        },
      );
      const body = await parseJson(response);
      if (!response.ok) {
        throw new PhoTestClientError(
          response.status,
          safeErrorMessage(response.status, body),
        );
      }
      if (!isPhoTestState(body)) {
        throw new PhoTestClientError(502, "Invalid server response");
      }
      return body;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      lastError = error;
      attempt += 1;
      if (attempt >= 3) break;
      await sleep(80 * attempt, signal);
    }
  }

  if (lastError instanceof PhoTestClientError) throw lastError;
  throw new PhoTestClientError(503, "API unavailable");
}

export async function sendPhoTestCommand(
  sessionId: string,
  action: PhoTestAction,
  secret: string,
  signal?: AbortSignal,
): Promise<PhoTestCommand> {
  if (!isSafeSessionId(sessionId)) {
    throw new PhoTestClientError(400, "Invalid session id");
  }
  if (!isPhoTestAction(action)) {
    throw new PhoTestClientError(400, "Invalid action");
  }
  if (!secret) {
    throw new PhoTestClientError(401, "Missing controller secret");
  }

  const response = await fetch("/api/test-call/command", {
    method: "POST",
    cache: "no-store",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ sessionId, action }),
  });

  const body = await parseJson(response);
  if (!response.ok) {
    throw new PhoTestClientError(
      response.status,
      safeErrorMessage(response.status, body),
    );
  }
  if (!isPhoTestCommand(body)) {
    throw new PhoTestClientError(502, "Invalid server response");
  }
  return body;
}

export async function acknowledgePhoTestCommand(
  sessionId: string,
  revision: number,
  resultingPhase: CallResultPhase,
  clientId: string,
  signal?: AbortSignal,
): Promise<PhoTestAcknowledgement> {
  if (!isSafeSessionId(sessionId)) {
    throw new PhoTestClientError(400, "Invalid session id");
  }
  if (!Number.isInteger(revision) || revision < 1) {
    throw new PhoTestClientError(400, "Invalid revision");
  }
  if (!isCallResultPhase(resultingPhase)) {
    throw new PhoTestClientError(400, "Invalid resulting phase");
  }

  const response = await fetch("/api/test-call/ack", {
    method: "POST",
    cache: "no-store",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId,
      revision,
      resultingPhase,
      clientId,
    }),
  });

  const body = await parseJson(response);
  if (!response.ok) {
    throw new PhoTestClientError(
      response.status,
      safeErrorMessage(response.status, body),
    );
  }
  if (!isPhoTestAcknowledgement(body)) {
    throw new PhoTestClientError(502, "Invalid server response");
  }
  return body;
}
