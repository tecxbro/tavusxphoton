export type CallPhase =
  | "bootstrapping"
  | "dialing"
  | "connecting"
  | "joining"
  | "live"
  | "ended"
  | "permission-error"
  | "connection-error";

export type CallOverlay = "none" | "more" | "capture-feedback";

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
export const DIALING_MIN_MS = 1600;
export const STATUS_PILL_MS = 2200;
export const AUTO_HIDE_MS = 2000;
export const JOIN_MORPH_MS = 520;
export const CHROME_HIDE_MS = 280;
export const SELF_COMPACT_MS = 400;
export const MORE_OPEN_MS = 420;
export const MORE_CLOSE_MS = 210;
export const CAPTURE_FLASH_IN_MS = 40;
export const CAPTURE_FLASH_HOLD_MS = 55;
export const CAPTURE_FLASH_OUT_MS = 160;
export const CAPTURE_TOAST_MS = 1800;
export const TOGGLE_SYMBOL_MS = 180;
export const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

export function parseCallSearchParams(
  sessionId: string,
  search: string,
): CallConfig {
  const params = new URLSearchParams(search);
  const selfAvatar = params.get("selfAvatar") || undefined;
  return {
    sessionId: sessionId || defaultCall.sessionId,
    participantName: params.get("name") || defaultCall.participantName,
    participantAvatar: params.get("avatar") || defaultCall.participantAvatar,
    remoteVideo: params.get("remoteVideo") || defaultCall.remoteVideo,
    ...(selfAvatar ? { selfAvatar } : {}),
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

export function canTransition(from: CallPhase, to: CallPhase): boolean {
  switch (from) {
    case "bootstrapping":
      return (
        to === "dialing" ||
        to === "permission-error" ||
        to === "ended"
      );
    case "dialing":
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
      return to === "bootstrapping" || to === "dialing";
    case "permission-error":
      return to === "bootstrapping" || to === "dialing";
    case "connection-error":
      return to === "bootstrapping" || to === "dialing" || to === "ended";
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
  | { type: "ENTER_CONNECTING" }
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
      return canTransition(phase, "dialing") ? "dialing" : phase;
    case "PERMISSIONS_DENIED":
      return canTransition(phase, "permission-error")
        ? "permission-error"
        : phase;
    case "ENTER_CONNECTING":
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
    phase === "dialing" ||
    phase === "connecting" ||
    phase === "joining" ||
    phase === "live"
  );
}

export function isLiveChromePhase(phase: CallPhase): boolean {
  return phase === "joining" || phase === "live";
}
