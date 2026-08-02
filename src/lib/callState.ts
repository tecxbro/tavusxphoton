export type CallStatus =
  | "prejoin"
  | "requesting-permissions"
  | "connecting"
  | "live"
  | "effects"
  | "ended"
  | "permission-error"
  | "connection-error";

export type CameraFacing = "user" | "environment";

export type EffectMode = "none" | "portrait" | "studio" | "memoji" | "reactions";

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
}

export const defaultCall: CallConfig = {
  sessionId: "demo",
  participantName: "Pho",
  participantAvatar: "/avatars/pho.jpg",
  remoteVideo: "/videos/mock-agent.mp4",
};

export const CONNECTING_MIN_MS = 700;
export const STATUS_PILL_MS = 2200;
export const AUTO_HIDE_MS = 3000;
export const REACTION_MS = 1500;

export function parseCallSearchParams(
  sessionId: string,
  search: string,
): CallConfig {
  const params = new URLSearchParams(search);
  return {
    sessionId: sessionId || defaultCall.sessionId,
    participantName: params.get("name") || defaultCall.participantName,
    participantAvatar: params.get("avatar") || defaultCall.participantAvatar,
    remoteVideo: params.get("remoteVideo") || defaultCall.remoteVideo,
  };
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function canTransition(from: CallStatus, to: CallStatus): boolean {
  switch (from) {
    case "prejoin":
      return to === "requesting-permissions";
    case "requesting-permissions":
      return (
        to === "connecting" ||
        to === "permission-error" ||
        to === "prejoin"
      );
    case "connecting":
      return (
        to === "live" ||
        to === "connection-error" ||
        to === "ended" ||
        to === "prejoin"
      );
    case "live":
      return to === "effects" || to === "ended" || to === "connection-error";
    case "effects":
      return to === "live" || to === "ended";
    case "ended":
      return to === "prejoin" || to === "requesting-permissions";
    case "permission-error":
      return to === "prejoin" || to === "requesting-permissions";
    case "connection-error":
      return to === "prejoin" || to === "requesting-permissions" || to === "ended";
    default: {
      const _exhaustive: never = from;
      return _exhaustive;
    }
  }
}

export type CallAction =
  | { type: "START" }
  | { type: "PERMISSIONS_GRANTED" }
  | { type: "PERMISSIONS_DENIED" }
  | { type: "CONNECTED" }
  | { type: "CONNECTION_FAILED" }
  | { type: "OPEN_EFFECTS" }
  | { type: "CLOSE_EFFECTS" }
  | { type: "END" }
  | { type: "RESTART" }
  | { type: "CLOSE" };

export function callReducer(status: CallStatus, action: CallAction): CallStatus {
  switch (action.type) {
    case "START":
      if (
        status === "prejoin" ||
        status === "ended" ||
        status === "permission-error" ||
        status === "connection-error"
      ) {
        return "requesting-permissions";
      }
      return canTransition(status, "requesting-permissions")
        ? "requesting-permissions"
        : status;
    case "PERMISSIONS_GRANTED":
      return canTransition(status, "connecting") ? "connecting" : status;
    case "PERMISSIONS_DENIED":
      return canTransition(status, "permission-error")
        ? "permission-error"
        : status;
    case "CONNECTED":
      return canTransition(status, "live") ? "live" : status;
    case "CONNECTION_FAILED":
      return canTransition(status, "connection-error")
        ? "connection-error"
        : status;
    case "OPEN_EFFECTS":
      return canTransition(status, "effects") ? "effects" : status;
    case "CLOSE_EFFECTS":
      return canTransition(status, "live") ? "live" : status;
    case "END":
      return canTransition(status, "ended") ? "ended" : status;
    case "RESTART":
      return "requesting-permissions";
    case "CLOSE":
      return "prejoin";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
