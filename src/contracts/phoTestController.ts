export type PhoTestAction = "answer" | "end" | "reset";

export type CallResultPhase =
  | "bootstrapping"
  | "ringing"
  | "connecting"
  | "joining"
  | "live"
  | "ended"
  | "permission-error"
  | "connection-error";

export interface PhoTestCommand {
  sessionId: string;
  action: PhoTestAction;
  revision: number;
  issuedAt: string;
}

export interface PhoTestAcknowledgement {
  revision: number;
  appliedAt: string;
  resultingPhase: CallResultPhase;
  clientId: string;
}

export interface PhoTestState {
  command: PhoTestCommand | null;
  acknowledgement: PhoTestAcknowledgement | null;
}

export const PHO_TEST_ACTIONS: readonly PhoTestAction[] = [
  "answer",
  "end",
  "reset",
] as const;

export const CALL_RESULT_PHASES: readonly CallResultPhase[] = [
  "bootstrapping",
  "ringing",
  "connecting",
  "joining",
  "live",
  "ended",
  "permission-error",
  "connection-error",
] as const;

export const SAFE_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const PHO_TEST_TTL_SECONDS = 60 * 60;
export const PHO_TEST_KEY_PREFIX = "mini-pho:test-call:";

export function isSafeSessionId(value: string): boolean {
  return SAFE_SESSION_ID_PATTERN.test(value);
}

export function isPhoTestAction(value: unknown): value is PhoTestAction {
  return (
    value === "answer" || value === "end" || value === "reset"
  );
}

export function isCallResultPhase(value: unknown): value is CallResultPhase {
  return (
    typeof value === "string" &&
    (CALL_RESULT_PHASES as readonly string[]).includes(value)
  );
}

export function phoTestRedisKey(sessionId: string): string {
  return `${PHO_TEST_KEY_PREFIX}${sessionId}`;
}
