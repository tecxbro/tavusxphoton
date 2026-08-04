import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildServerCreatePayload,
  handleTavusRequest,
} from "../../src/lib/tavus/tavus-api-vite-ssr";

describe("tavus API handler", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.TAVUS_API_KEY = "server-secret-key";
    process.env.TAVUS_PAL_ID = "pa_fixed_pal";
    process.env.TAVUS_FACE_ID = "r_fixed_face";
    process.env.TAVUS_TEST_MODE = "true";
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.TAVUS_API_KEY;
    delete process.env.TAVUS_PAL_ID;
    delete process.env.TAVUS_FACE_ID;
    delete process.env.TAVUS_TEST_MODE;
    vi.restoreAllMocks();
  });

  it("keeps the Tavus API key server-side in create requests", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          conversation_id: "c1",
          conversation_url: "https://tavus.daily.co/room",
          meeting_token: "tok",
        }),
        { status: 200 },
      ),
    );

    const res = await handleTavusRequest(
      new Request("http://localhost/api/tavus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", params: {} }),
      }),
    );

    expect(res.status).toBe(200);
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-api-key")).toBe("server-secret-key");
    expect(JSON.stringify(await res.json())).not.toContain("server-secret-key");
  });

  it("creates with fixed PAL, Face, and timeout configuration", () => {
    const payload = buildServerCreatePayload();
    expect(payload).toEqual({
      pal_id: "pa_fixed_pal",
      face_id: "r_fixed_face",
      conversation_name: "Gary Call",
      require_auth: true,
      max_participants: 2,
      test_mode: true,
      properties: {
        participant_left_timeout: 10,
        participant_absent_timeout: 60,
        max_call_duration: 900,
      },
    });
  });

  it("omits face_id when TAVUS_FACE_ID is empty", () => {
    process.env.TAVUS_FACE_ID = "";
    const payload = buildServerCreatePayload();
    expect(payload.face_id).toBeUndefined();
  });

  it("ignores browser-supplied create overrides", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ conversation_id: "c1" }), { status: 200 }),
    );

    await handleTavusRequest(
      new Request("http://localhost/api/tavus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          params: {
            pal_id: "pa_from_browser",
            face_id: "r_from_browser",
            callback_url: "https://evil.example/hook",
            conversation_url: "https://evil.example/room",
            properties: {
              participant_left_timeout: 999,
            },
          },
        }),
      }),
    );

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    const sent = JSON.parse(String(init.body));
    expect(sent.pal_id).toBe("pa_fixed_pal");
    expect(sent.face_id).toBe("r_fixed_face");
    expect(sent.callback_url).toBeUndefined();
    expect(sent.conversation_url).toBeUndefined();
    expect(sent.properties.participant_left_timeout).toBe(10);
  });

  it("forwards the conversation id on end", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    const res = await handleTavusRequest(
      new Request("http://localhost/api/tavus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end",
          conversationId: "conv_abc123",
        }),
      }),
    );

    expect(res.status).toBe(204);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://tavusapi.com/v2/conversations/conv_abc123/end",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns safe errors without leaking Tavus payloads", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("secret upstream failure detail", { status: 502 }),
    );

    const res = await handleTavusRequest(
      new Request("http://localhost/api/tavus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", params: {} }),
      }),
    );

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: "Unable to create conversation.",
    });
  });

  it("does not call Tavus when the API key is missing", async () => {
    delete process.env.TAVUS_API_KEY;
    const res = await handleTavusRequest(
      new Request("http://localhost/api/tavus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", params: {} }),
      }),
    );
    expect(res.status).toBe(500);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
