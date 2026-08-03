import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PhoTestClientError,
  acknowledgePhoTestCommand,
  getPhoTestState,
  sendPhoTestCommand,
} from "../../lib/phoTestControllerClient";

describe("phoTestControllerClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches state with cache no-store", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ command: null, acknowledgement: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const state = await getPhoTestState("demo");
    expect(state).toEqual({ command: null, acknowledgement: null });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/test-call/state?sessionId=demo",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("sends bearer secret without including it in thrown errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "Unauthorized" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendPhoTestCommand("demo", "answer", "super-secret-value"),
    ).rejects.toMatchObject({
      status: 401,
      safeMessage: "Unauthorized",
    });

    const err = await sendPhoTestCommand(
      "demo",
      "answer",
      "super-secret-value",
    ).catch((error: unknown) => error);
    expect(err).toBeInstanceOf(PhoTestClientError);
    expect(JSON.stringify(err)).not.toContain("super-secret-value");
  });

  it("rejects malformed command responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ nope: true }),
      }),
    );

    await expect(
      sendPhoTestCommand("demo", "end", "secret"),
    ).rejects.toBeInstanceOf(PhoTestClientError);
  });

  it("posts acknowledgements", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          revision: 3,
          appliedAt: "2026-01-01T00:00:00.000Z",
          resultingPhase: "ended",
          clientId: "c1",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const ack = await acknowledgePhoTestCommand(
      "demo",
      3,
      "ended",
      "c1",
    );
    expect(ack.revision).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/test-call/command".replace("command", "ack"),
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
  });

  it("validates session ids before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getPhoTestState("bad id")).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
