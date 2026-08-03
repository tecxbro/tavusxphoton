import { describe, expect, it } from "vitest";
import {
  isCallResultPhase,
  isPhoTestAction,
  isSafeSessionId,
} from "../../contracts/phoTestController";
import { callReducer } from "../../lib/callState";

describe("pho test command mapping helpers", () => {
  it("validates session ids and actions", () => {
    expect(isSafeSessionId("demo")).toBe(true);
    expect(isSafeSessionId("bad id")).toBe(false);
    expect(isPhoTestAction("answer")).toBe(true);
    expect(isPhoTestAction("PHO_ANSWERED")).toBe(false);
    expect(isCallResultPhase("live")).toBe(true);
    expect(isCallResultPhase("nope")).toBe(false);
  });

  it("maps answer only from ringing", () => {
    expect(callReducer("ringing", { type: "PHO_ANSWERED" })).toBe("connecting");
    expect(callReducer("live", { type: "PHO_ANSWERED" })).toBe("live");
  });

  it("ends from every active phase", () => {
    expect(callReducer("ringing", { type: "END" })).toBe("ended");
    expect(callReducer("connecting", { type: "END" })).toBe("ended");
    expect(callReducer("joining", { type: "END" })).toBe("ended");
    expect(callReducer("live", { type: "END" })).toBe("ended");
  });

  it("restarts to bootstrapping from any phase", () => {
    expect(callReducer("live", { type: "RESTART" })).toBe("bootstrapping");
    expect(callReducer("ended", { type: "RESTART" })).toBe("bootstrapping");
    expect(callReducer("permission-error", { type: "RESTART" })).toBe(
      "bootstrapping",
    );
  });
});
