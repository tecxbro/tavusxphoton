/**
 * Live call UI phases owned by {@link callReducer}.
 * Advance only via dispatched {@link CallAction}s — never set ad hoc.
 */
export type CallPhase =
  | "idle"
  | "bootstrapping"
  | "ringing"
  | "connecting"
  | "joining"
  | "live"
  | "ended"
  | "permission-error"
  | "connection-error";

/** Local camera facing mode from `getUserMedia` constraints. */
export type CameraFacing = "user" | "environment";

/** Transient chrome status chip; `null` clears the message. */
export type StatusMessage =
  | "microphone-muted"
  | "microphone-unmuted"
  | "camera-off"
  | "camera-on"
  | "front-camera"
  | "back-camera"
  | "connection-restored"
  | null;

/**
 * Display identity for a call session.
 * Prefer `callConfigFromAgent` — never trust browser PAL / room params.
 */
export interface CallConfig {
  sessionId: string;
  participantName: string;
  participantAvatar: string;
  selfAvatar?: string;
}

/** Fallback identity when parsing fails or no agent is resolved. */
export const defaultCall: CallConfig = {
  sessionId: "demo",
  participantName: "Garry Tan",
  participantAvatar: "/avatars/agents/garry-tan.webp",
};

export { CALL_MOTION, EASE_OUT_EXPO, SELF_VIEW_LAYOUT } from "./callUi";

/** Auto-hide delay for live call chrome when idle. */
export const AUTO_HIDE_MS = 2000;
export const MORE_OPEN_MS = 420;
export const MORE_CLOSE_MS = 210;
export const TOGGLE_SYMBOL_MS = 180;

const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/;

function safeSessionId(value: string): string {
  return SAFE_SESSION_ID.test(value) ? value : defaultCall.sessionId;
}

function safeName(value: string | null, fallback: string): string {
  const normalized = value?.trim().slice(0, 80);
  return normalized || fallback;
}

function safeSameOriginAsset(
  value: string | null,
  fallback: string,
): string {
  if (!value) return fallback;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Parse display-only call identity from the route search string.
 *
 * @param sessionId - Path session id (sanitized to `[A-Za-z0-9_-]{1,64}`).
 * @param search - `location.search` (may include leading `?`).
 * @returns Sanitized {@link CallConfig}; same-origin assets only for avatars.
 */
export function parseCallSearchParams(
  sessionId: string,
  search: string,
): CallConfig {
  const params = new URLSearchParams(search);
  const selfAvatarRaw = params.get("selfAvatar");
  const selfAvatar = selfAvatarRaw
    ? safeSameOriginAsset(selfAvatarRaw, "")
    : undefined;
  return {
    sessionId: safeSessionId(sessionId),
    participantName: safeName(params.get("name"), defaultCall.participantName),
    participantAvatar: safeSameOriginAsset(
      params.get("avatar"),
      defaultCall.participantAvatar,
    ),
    ...(selfAvatar ? { selfAvatar } : {}),
  };
}

/**
 * Two-letter (or single-letter) initials for avatar placeholders.
 *
 * @param name - Display name; empty / whitespace yields `"?"`.
 * @returns Uppercase initials string.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "").toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/**
 * Format elapsed call time as `MM:SS`.
 *
 * @param totalSeconds - Elapsed seconds (floored; negatives clamp to 0).
 * @returns Zero-padded duration string.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Allowed phase edges. CallScreen must dispatch through {@link callReducer} —
 * do not set phases ad hoc.
 *
 * @param from - Current phase.
 * @param to - Candidate next phase.
 * @returns Whether the edge is legal.
 */
export function canTransition(from: CallPhase, to: CallPhase): boolean {
  switch (from) {
    case "idle":
      return to === "bootstrapping";
    case "bootstrapping":
      return (
        to === "ringing" ||
        to === "permission-error" ||
        to === "ended" ||
        to === "connection-error" ||
        to === "idle"
      );
    case "ringing":
      return (
        to === "connecting" ||
        to === "ended" ||
        to === "permission-error" ||
        to === "connection-error"
      );
    case "connecting":
      return (
        to === "joining" ||
        to === "connection-error" ||
        to === "ended"
      );
    case "joining":
      return to === "live" || to === "ended" || to === "connection-error";
    case "live":
      return to === "ended" || to === "connection-error";
    case "ended":
      return to === "idle" || to === "bootstrapping";
    case "permission-error":
      return to === "idle" || to === "bootstrapping";
    case "connection-error":
      return to === "idle" || to === "bootstrapping" || to === "ended";
    default: {
      const _exhaustive: never = from;
      return _exhaustive;
    }
  }
}

/** Discriminated actions consumed by {@link callReducer}. */
export type CallAction =
  | { type: "START_CALL" }
  | { type: "PERMISSIONS_GRANTED" }
  | { type: "PERMISSIONS_DENIED" }
  | { type: "PAL_JOINED" }
  | { type: "REMOTE_FRAME" }
  | { type: "JOIN_COMPLETE" }
  | { type: "CONNECTION_FAILED" }
  | { type: "END" }
  | { type: "RESTART" }
  | { type: "CLOSE" };

/**
 * Pure phase machine. Illegal transitions are no-ops so async races cannot skip ahead.
 *
 * @param phase - Current call phase.
 * @param action - Transition intent.
 * @returns Next phase (unchanged when the edge is illegal).
 */
export function callReducer(phase: CallPhase, action: CallAction): CallPhase {
  switch (action.type) {
    case "START_CALL":
      return canTransition(phase, "bootstrapping") ? "bootstrapping" : phase;
    case "PERMISSIONS_GRANTED":
      return canTransition(phase, "ringing") ? "ringing" : phase;
    case "PERMISSIONS_DENIED":
      return canTransition(phase, "permission-error")
        ? "permission-error"
        : phase;
    case "PAL_JOINED":
      return canTransition(phase, "connecting") ? "connecting" : phase;
    case "REMOTE_FRAME":
      return canTransition(phase, "joining") ? "joining" : phase;
    case "JOIN_COMPLETE":
      return canTransition(phase, "live") ? "live" : phase;
    case "CONNECTION_FAILED":
      return canTransition(phase, "connection-error")
        ? "connection-error"
        : phase;
    case "END":
      return canTransition(phase, "ended") ? "ended" : phase;
    case "RESTART":
      return "idle";
    case "CLOSE":
      return "ended";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/**
 * Phases where local media and call chrome remain mounted.
 *
 * @param phase - Current call phase.
 * @returns True for ringing through live.
 */
export function isActiveCallPhase(phase: CallPhase): boolean {
  return (
    phase === "ringing" ||
    phase === "connecting" ||
    phase === "joining" ||
    phase === "live"
  );
}

/**
 * Phases that show the live FaceTime chrome (contact pill, control rail).
 *
 * @param phase - Current call phase.
 * @returns True for joining and live.
 */
export function isLiveChromePhase(phase: CallPhase): boolean {
  return phase === "joining" || phase === "live";
}
