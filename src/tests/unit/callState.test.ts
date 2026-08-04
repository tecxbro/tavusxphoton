import { describe, expect, it } from "vitest";
import {
  AUTO_HIDE_MS,
  callReducer,
  canTransition,
  formatDuration,
  getInitials,
  isActiveCallPhase,
  parseCallSearchParams,
} from "../../lib/callState";
import { objectCoverSourceRect } from "../../lib/objectCover";

describe("call state transitions", () => {
  it("moves through the happy path from idle", () => {
    let phase = callReducer("idle", { type: "START_CALL" });
    expect(phase).toBe("bootstrapping");
    phase = callReducer(phase, { type: "PERMISSIONS_GRANTED" });
    expect(phase).toBe("ringing");
    phase = callReducer(phase, { type: "PAL_JOINED" });
    expect(phase).toBe("connecting");
    phase = callReducer(phase, { type: "REMOTE_FRAME" });
    expect(phase).toBe("joining");
    phase = callReducer(phase, { type: "JOIN_COMPLETE" });
    expect(phase).toBe("live");
    phase = callReducer(phase, { type: "END" });
    expect(phase).toBe("ended");
  });

  it("ignores REMOTE_FRAME during ringing", () => {
    expect(callReducer("ringing", { type: "REMOTE_FRAME" })).toBe("ringing");
  });

  it("ignores PAL_JOINED after ringing", () => {
    expect(callReducer("connecting", { type: "PAL_JOINED" })).toBe(
      "connecting",
    );
    expect(callReducer("joining", { type: "PAL_JOINED" })).toBe("joining");
    expect(callReducer("live", { type: "PAL_JOINED" })).toBe("live");
  });

  it("allows ending from ringing", () => {
    expect(callReducer("ringing", { type: "END" })).toBe("ended");
    expect(canTransition("ringing", "ended")).toBe(true);
  });

  it("handles permission denial", () => {
    const phase = callReducer("bootstrapping", {
      type: "PERMISSIONS_DENIED",
    });
    expect(phase).toBe("permission-error");
    expect(canTransition("permission-error", "bootstrapping")).toBe(true);
  });

  it("restarts to idle", () => {
    expect(callReducer("ended", { type: "RESTART" })).toBe("idle");
    expect(callReducer("permission-error", { type: "RESTART" })).toBe("idle");
  });

  it("marks ringing through live as active", () => {
    expect(isActiveCallPhase("idle")).toBe(false);
    expect(isActiveCallPhase("ringing")).toBe(true);
    expect(isActiveCallPhase("connecting")).toBe(true);
    expect(isActiveCallPhase("joining")).toBe(true);
    expect(isActiveCallPhase("live")).toBe(true);
    expect(isActiveCallPhase("ended")).toBe(false);
  });

  it("keeps overlays separate from network phases", () => {
    expect(canTransition("live", "joining")).toBe(false);
    expect(callReducer("live", { type: "JOIN_COMPLETE" })).toBe("live");
  });
});

describe("call timer formatting", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(42)).toBe("00:42");
    expect(formatDuration(125)).toBe("02:05");
  });
});

describe("query parameter parsing", () => {
  it("applies defaults and overrides without remoteVideo", () => {
    expect(parseCallSearchParams("demo", "")).toMatchObject({
      sessionId: "demo",
      participantName: "Gary",
    });
    expect(
      parseCallSearchParams(
        "abc",
        "name=Nova&avatar=/a.jpg&remoteVideo=/v.mp4&selfAvatar=/me.jpg",
      ),
    ).toEqual({
      sessionId: "abc",
      participantName: "Nova",
      participantAvatar: "/a.jpg",
      selfAvatar: "/me.jpg",
    });
  });

  it("falls back invalid session IDs to demo", () => {
    expect(parseCallSearchParams("../evil", "").sessionId).toBe("demo");
    expect(parseCallSearchParams("has spaces", "").sessionId).toBe("demo");
  });

  it("trims and caps names at 80 characters", () => {
    const long = `  ${"A".repeat(100)}  `;
    expect(
      parseCallSearchParams("demo", `name=${encodeURIComponent(long)}`)
        .participantName,
    ).toHaveLength(80);
  });

  it("rejects cross-origin avatar values", () => {
    const config = parseCallSearchParams(
      "demo",
      "avatar=https://evil.example/a.jpg",
    );
    expect(config.participantAvatar).toBe("/avatars/pho.jpg");
  });

  it("builds initials", () => {
    expect(getInitials("Gary")).toBe("G");
    expect(getInitials("Ada Lovelace")).toBe("AL");
  });
});

describe("auto-hide timeout", () => {
  it("uses the product timeout constant", () => {
    expect(AUTO_HIDE_MS).toBe(2000);
  });
});

describe("object-cover math", () => {
  it("crops wider sources horizontally", () => {
    const rect = objectCoverSourceRect(1920, 1080, 400, 800);
    expect(rect.height).toBe(1080);
    expect(rect.width).toBeCloseTo(540);
    expect(rect.x).toBeCloseTo(690);
  });

  it("crops taller sources vertically", () => {
    const rect = objectCoverSourceRect(800, 1200, 400, 300);
    expect(rect.width).toBe(800);
    expect(rect.height).toBeCloseTo(600);
    expect(rect.y).toBeCloseTo(300);
  });
});
