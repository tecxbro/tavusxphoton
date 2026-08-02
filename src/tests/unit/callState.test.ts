import { describe, expect, it, vi } from "vitest";
import {
  callReducer,
  canTransition,
  formatDuration,
  getInitials,
  parseCallSearchParams,
} from "../../lib/callState";
import { selectPerformancePolicy } from "../../lib/performance";
import { AUTO_HIDE_MS, STATUS_PILL_MS } from "../../lib/callState";

describe("call state transitions", () => {
  it("moves through the happy path", () => {
    let status = callReducer("prejoin", { type: "START" });
    expect(status).toBe("requesting-permissions");
    status = callReducer(status, { type: "PERMISSIONS_GRANTED" });
    expect(status).toBe("connecting");
    status = callReducer(status, { type: "CONNECTED" });
    expect(status).toBe("live");
    status = callReducer(status, { type: "OPEN_EFFECTS" });
    expect(status).toBe("effects");
    status = callReducer(status, { type: "CLOSE_EFFECTS" });
    expect(status).toBe("live");
    status = callReducer(status, { type: "END" });
    expect(status).toBe("ended");
  });

  it("handles permission denial", () => {
    const status = callReducer("requesting-permissions", {
      type: "PERMISSIONS_DENIED",
    });
    expect(status).toBe("permission-error");
    expect(canTransition("permission-error", "requesting-permissions")).toBe(
      true,
    );
  });

  it("restarts from ended", () => {
    expect(callReducer("ended", { type: "START" })).toBe(
      "requesting-permissions",
    );
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
        "name=Nova&avatar=/a.jpg&remoteVideo=/v.mp4",
      ),
    ).toEqual({
      sessionId: "abc",
      participantName: "Nova",
      participantAvatar: "/a.jpg",
      remoteVideo: "/v.mp4",
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
    expect(AUTO_HIDE_MS).toBe(3000);
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
