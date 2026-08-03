export type CallPhase =
  | "bootstrapping"
  | "ringing"
  | "connecting"
  | "joining"
  | "live"
  | "ended"
  | "permission-error"
  | "connection-error";

export type CameraFacing = "user" | "environment";

export type StatusMessage =
  | "microphone-muted"
  | "microphone-unmuted"
  | "camera-off"
  | "camera-on"
  | "front-camera"
  | "back-camera"
  | "connection-restored"
  | null;

export interface CallConfig {
  sessionId: string;
  participantName: string;
  participantAvatar: string;
  remoteVideo: string;
  selfAvatar?: string;
}

export const defaultCall: CallConfig = {
  sessionId: "demo",
  participantName: "Pho",
  participantAvatar: "/avatars/pho.jpg",
  remoteVideo: "/videos/mock-agent.mp4",
};

export const CONNECTING_MIN_MS = 700;
export const AUTO_HIDE_MS = 2000;
export const JOIN_MORPH_MS = 520;
export const CHROME_HIDE_MS = 280;
export const SELF_COMPACT_MS = 400;
export const MORE_OPEN_MS = 420;
export const MORE_CLOSE_MS = 210;
export const TOGGLE_SYMBOL_MS = 180;
export const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

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
    remoteVideo: safeSameOriginAsset(
      params.get("remoteVideo"),
      defaultCall.remoteVideo,
    ),
    ...(selfAvatar ? { selfAvatar } : {}),
  };
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "").toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function canTransition(from: CallPhase, to: CallPhase): boolean {
  switch (from) {
    case "bootstrapping":
      return (
        to === "ringing" ||
        to === "permission-error" ||
        to === "ended"
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
      return to === "bootstrapping" || to === "ringing";
    case "permission-error":
      return to === "bootstrapping" || to === "ringing";
    case "connection-error":
      return to === "bootstrapping" || to === "ringing" || to === "ended";
    default: {
      const _exhaustive: never = from;
      return _exhaustive;
    }
  }
}

export type CallAction =
  | { type: "BOOTSTRAP" }
  | { type: "PERMISSIONS_GRANTED" }
  | { type: "PERMISSIONS_DENIED" }
  | { type: "PHO_ANSWERED" }
  | { type: "REMOTE_FRAME" }
  | { type: "JOIN_COMPLETE" }
  | { type: "CONNECTION_FAILED" }
  | { type: "END" }
  | { type: "RESTART" }
  | { type: "CLOSE" };

export function callReducer(phase: CallPhase, action: CallAction): CallPhase {
  switch (action.type) {
    case "BOOTSTRAP":
      if (
        phase === "ended" ||
        phase === "permission-error" ||
        phase === "connection-error" ||
        phase === "bootstrapping"
      ) {
        return "bootstrapping";
      }
      return phase;
    case "PERMISSIONS_GRANTED":
      return canTransition(phase, "ringing") ? "ringing" : phase;
    case "PERMISSIONS_DENIED":
      return canTransition(phase, "permission-error")
        ? "permission-error"
        : phase;
    case "PHO_ANSWERED":
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
      return "bootstrapping";
    case "CLOSE":
      return "ended";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function isActiveCallPhase(phase: CallPhase): boolean {
  return (
    phase === "ringing" ||
    phase === "connecting" ||
    phase === "joining" ||
    phase === "live"
  );
}

export function isLiveChromePhase(phase: CallPhase): boolean {
  return phase === "joining" || phase === "live";
}
