import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRateLimitsForTests,
  isFeatureEnabled,
} from "../_lib/http";
import {
  __resetPhoTestStoreForTests,
  getPhoTestStore,
} from "../_lib/phoTestStore";
import { handlePhoTestApi } from "../_lib/dispatch";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";

function makeReq(
  method: string,
  headers: Record<string, string>,
  body?: string,
): IncomingMessage {
  const stream = Readable.from([body ?? ""]) as IncomingMessage;
  stream.method = method;
  stream.headers = headers;
  stream.socket = { remoteAddress: "127.0.0.1" } as IncomingMessage["socket"];
  return stream;
}

async function call(
  method: string,
  path: string,
  options?: {
    headers?: Record<string, string>;
    body?: string;
  },
) {
  const url = new URL(path, "http://127.0.0.1");
  const req = makeReq(method, options?.headers ?? {}, options?.body);
  return handlePhoTestApi(req, url);
}

describe("pho test API", () => {
  beforeEach(() => {
    process.env.ENABLE_PHO_TEST_CONTROLLER = "true";
    process.env.TEST_CONTROLLER_SECRET = "unit-test-secret-value";
    process.env.PHO_TEST_USE_MEMORY_STORE = "true";
    __resetPhoTestStoreForTests();
    __resetRateLimitsForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty state for unknown sessions", async () => {
    const result = await call("GET", "/api/test-call/state?sessionId=demo");
    expect(result?.status).toBe(200);
    expect(result?.body).toEqual({ command: null, acknowledgement: null });
  });

  it("rejects invalid session ids", async () => {
    const result = await call("GET", "/api/test-call/state?sessionId=bad id");
    expect(result?.status).toBe(400);
  });

  it("returns 404 when feature disabled", async () => {
    process.env.ENABLE_PHO_TEST_CONTROLLER = "false";
    expect(isFeatureEnabled()).toBe(false);
    const result = await call("GET", "/api/test-call/state?sessionId=demo");
    expect(result?.status).toBe(404);
  });

  it("rejects missing and invalid bearer tokens", async () => {
    const missing = await call("POST", "/api/test-call/command", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "demo", action: "answer" }),
    });
    expect(missing?.status).toBe(401);

    const invalid = await call("POST", "/api/test-call/command", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wrong",
      },
      body: JSON.stringify({ sessionId: "demo", action: "answer" }),
    });
    expect(invalid?.status).toBe(401);
  });

  it("increments revisions monotonically and clears acknowledgements", async () => {
    const first = await call("POST", "/api/test-call/command", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer unit-test-secret-value",
      },
      body: JSON.stringify({ sessionId: "demo", action: "answer" }),
    });
    expect(first?.status).toBe(200);
    expect(first?.body).toMatchObject({ revision: 1, action: "answer" });

    await getPhoTestStore().acknowledge({
      sessionId: "demo",
      revision: 1,
      resultingPhase: "live",
      clientId: "c1",
    });

    const second = await call("POST", "/api/test-call/command", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer unit-test-secret-value",
      },
      body: JSON.stringify({ sessionId: "demo", action: "end" }),
    });
    expect(second?.body).toMatchObject({ revision: 2, action: "end" });

    const state = await call("GET", "/api/test-call/state?sessionId=demo");
    expect(state?.body).toMatchObject({
      command: { revision: 2 },
      acknowledgement: null,
    });
  });

  it("rejects stale and future acknowledgements", async () => {
    await call("POST", "/api/test-call/command", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer unit-test-secret-value",
      },
      body: JSON.stringify({ sessionId: "demo", action: "answer" }),
    });

    const stale = await call("POST", "/api/test-call/ack", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "demo",
        revision: 0,
        resultingPhase: "live",
        clientId: "c1",
      }),
    });
    expect(stale?.status).toBe(400);

    const future = await call("POST", "/api/test-call/ack", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "demo",
        revision: 9,
        resultingPhase: "live",
        clientId: "c1",
      }),
    });
    expect(future?.status).toBe(409);

    const ok = await call("POST", "/api/test-call/ack", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "demo",
        revision: 1,
        resultingPhase: "connecting",
        clientId: "c1",
      }),
    });
    expect(ok?.status).toBe(200);
  });

  it("rejects invalid actions and phases", async () => {
    const badAction = await call("POST", "/api/test-call/command", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer unit-test-secret-value",
      },
      body: JSON.stringify({ sessionId: "demo", action: "PHO_ANSWERED" }),
    });
    expect(badAction?.status).toBe(400);

    await call("POST", "/api/test-call/command", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer unit-test-secret-value",
      },
      body: JSON.stringify({ sessionId: "demo", action: "answer" }),
    });

    const badPhase = await call("POST", "/api/test-call/ack", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "demo",
        revision: 1,
        resultingPhase: "not-a-phase",
        clientId: "c1",
      }),
    });
    expect(badPhase?.status).toBe(400);
  });

  it("rate limits command writes", async () => {
    for (let i = 0; i < 30; i += 1) {
      const result = await call("POST", "/api/test-call/command", {
        headers: {
          "content-type": "application/json",
          authorization: "Bearer unit-test-secret-value",
        },
        body: JSON.stringify({ sessionId: "demo", action: "reset" }),
      });
      expect(result?.status).toBe(200);
    }
    const limited = await call("POST", "/api/test-call/command", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer unit-test-secret-value",
      },
      body: JSON.stringify({ sessionId: "demo", action: "reset" }),
    });
    expect(limited?.status).toBe(429);
  });

  it("rejects oversized bodies", async () => {
    const result = await call("POST", "/api/test-call/command", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer unit-test-secret-value",
      },
      body: JSON.stringify({
        sessionId: "demo",
        action: "answer",
        pad: "x".repeat(5000),
      }),
    });
    expect(result?.status).toBe(413);
  });
});
