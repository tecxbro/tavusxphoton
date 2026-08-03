import { describe, expect, it, vi } from "vitest";
import {
  AUTO_HIDE_MS,
  STATUS_PILL_MS,
  callReducer,
  canTransition,
  formatDuration,
  getInitials,
  parseCallSearchParams,
} from "../../lib/callState";
import { objectCoverSourceRect } from "../../lib/objectCover";
import { selectPerformancePolicy } from "../../lib/performance";

describe("call state transitions", () => {
  it("moves through the happy path", () => {
    let phase = callReducer("bootstrapping", { type: "BOOTSTRAP" });
    expect(phase).toBe("bootstrapping");
    phase = callReducer(phase, { type: "PERMISSIONS_GRANTED" });
    expect(phase).toBe("dialing");
    phase = callReducer(phase, { type: "ENTER_CONNECTING" });
    expect(phase).toBe("connecting");
    phase = callReducer(phase, { type: "REMOTE_FRAME" });
    expect(phase).toBe("joining");
    phase = callReducer(phase, { type: "JOIN_COMPLETE" });
    expect(phase).toBe("live");
    phase = callReducer(phase, { type: "END" });
    expect(phase).toBe("ended");
  });

  it("handles permission denial", () => {
    const phase = callReducer("bootstrapping", {
      type: "PERMISSIONS_DENIED",
    });
    expect(phase).toBe("permission-error");
    expect(canTransition("permission-error", "bootstrapping")).toBe(true);
  });

  it("allows ending from early phases", () => {
    expect(canTransition("dialing", "ended")).toBe(true);
    expect(canTransition("connecting", "ended")).toBe(true);
    expect(canTransition("joining", "ended")).toBe(true);
    expect(canTransition("live", "ended")).toBe(true);
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
  it("applies defaults and overrides", () => {
    expect(parseCallSearchParams("demo", "")).toMatchObject({
      sessionId: "demo",
      participantName: "Pho",
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
      remoteVideo: "/v.mp4",
      selfAvatar: "/me.jpg",
    });
  });

  it("builds initials", () => {
    expect(getInitials("Pho")).toBe("PH");
    expect(getInitials("Ada Lovelace")).toBe("AL");
  });
});

describe("performance fallback selection", () => {
  it("stays full when fps is healthy", () => {
    expect(selectPerformancePolicy(58, 0, "full").mode).toBe("full");
  });

  it("reduces then falls back under sustained low fps", () => {
    expect(selectPerformancePolicy(40, 3000, "full").mode).toBe("reduced");
    expect(selectPerformancePolicy(40, 3000, "reduced").mode).toBe("fallback");
    expect(selectPerformancePolicy(60, 0, "full", true).useCssFallback).toBe(
      true,
    );
  });
});

describe("auto-hide and status timeouts", () => {
  it("uses the product timeout constants", () => {
    expect(AUTO_HIDE_MS).toBe(2000);
    expect(STATUS_PILL_MS).toBe(2200);
  });

  it("clears status after timeout", async () => {
    vi.useFakeTimers();
    let message: string | null = "microphone-muted";
    const id = setTimeout(() => {
      message = null;
    }, STATUS_PILL_MS);
    expect(message).toBe("microphone-muted");
    await vi.advanceTimersByTimeAsync(STATUS_PILL_MS);
    expect(message).toBeNull();
    clearTimeout(id);
    vi.useRealTimers();
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
