import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CALL_RESULT_PHASES,
  isCallResultPhase,
  isPhoTestAction,
  isSafeSessionId,
  type PhoTestAction,
  type CallResultPhase,
} from "../../src/contracts/phoTestController.js";
import { getPhoTestStore } from "./phoTestStore.js";
import {
  getControllerSecret,
  isFeatureEnabled,
  MAX_BODY_BYTES,
  rateLimit,
} from "./http.js";

export interface ApiResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

function json(
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): ApiResult {
  return {
    status,
    body,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  };
}

function readBearer(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}

async function readRawBody(
  req: IncomingMessage,
  limit: number,
): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > limit) {
      return { ok: false, status: 413 };
    }
    chunks.push(buf);
  }
  return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.socket.remoteAddress || "unknown";
}

export async function handlePhoTestApi(
  req: IncomingMessage,
  url: URL,
): Promise<ApiResult | null> {
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (!path.startsWith("/api/test-call")) {
    return null;
  }

  if (!isFeatureEnabled()) {
    return json(404, { error: "Not found" });
  }

  if (path === "/api/test-call/state") {
    if (req.method !== "GET") {
      return json(405, { error: "Method not allowed" }, { Allow: "GET" });
    }
    const sessionId = url.searchParams.get("sessionId") ?? "";
    if (!isSafeSessionId(sessionId)) {
      return json(400, { error: "Invalid session id" });
    }
    const state = await getPhoTestStore().getState(sessionId);
    return json(200, state);
  }

  if (path === "/api/test-call/command") {
    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" }, { Allow: "POST" });
    }

    const expected = getControllerSecret();
    if (!expected) {
      return json(503, { error: "Service unavailable" });
    }
    const token = readBearer(
      typeof req.headers.authorization === "string"
        ? req.headers.authorization
        : undefined,
    );
    if (!token || token !== expected) {
      return json(401, { error: "Unauthorized" });
    }

    const contentType = req.headers["content-type"];
    if (
      typeof contentType !== "string" ||
      !contentType.toLowerCase().includes("application/json")
    ) {
      return json(415, { error: "Unsupported media type" });
    }

    if (!rateLimit(`command:${clientIp(req)}`, 30, 60_000)) {
      return json(429, { error: "Too many requests" });
    }

    const raw = await readRawBody(req, MAX_BODY_BYTES);
    if (raw.ok === false) {
      return json(raw.status, {
        error: raw.status === 413 ? "Payload too large" : "Invalid request",
      });
    }

    let body: { sessionId?: unknown; action?: unknown };
    try {
      body = JSON.parse(raw.text || "{}") as {
        sessionId?: unknown;
        action?: unknown;
      };
    } catch {
      return json(400, { error: "Invalid request" });
    }

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : "";
    if (!isSafeSessionId(sessionId)) {
      return json(400, { error: "Invalid session id" });
    }
    if (!isPhoTestAction(body.action)) {
      return json(400, { error: "Invalid action" });
    }

    const command = await getPhoTestStore().issueCommand(
      sessionId,
      body.action as PhoTestAction,
    );
    return json(200, command);
  }

  if (path === "/api/test-call/ack") {
    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" }, { Allow: "POST" });
    }

    const contentType = req.headers["content-type"];
    if (
      typeof contentType !== "string" ||
      !contentType.toLowerCase().includes("application/json")
    ) {
      return json(415, { error: "Unsupported media type" });
    }

    if (!rateLimit(`ack:${clientIp(req)}`, 60, 60_000)) {
      return json(429, { error: "Too many requests" });
    }

    const raw = await readRawBody(req, MAX_BODY_BYTES);
    if (raw.ok === false) {
      return json(raw.status, {
        error: raw.status === 413 ? "Payload too large" : "Invalid request",
      });
    }

    let body: {
      sessionId?: unknown;
      revision?: unknown;
      resultingPhase?: unknown;
      clientId?: unknown;
    };
    try {
      body = JSON.parse(raw.text || "{}") as typeof body;
    } catch {
      return json(400, { error: "Invalid request" });
    }

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : "";
    const revision =
      typeof body.revision === "number" && Number.isInteger(body.revision)
        ? body.revision
        : NaN;
    const clientId =
      typeof body.clientId === "string" ? body.clientId.slice(0, 128) : "";

    if (!isSafeSessionId(sessionId)) {
      return json(400, { error: "Invalid session id" });
    }
    if (!Number.isFinite(revision) || revision < 1) {
      return json(400, { error: "Invalid revision" });
    }
    if (!isCallResultPhase(body.resultingPhase)) {
      return json(400, { error: "Invalid resulting phase" });
    }
    if (!clientId) {
      return json(400, { error: "Invalid client id" });
    }

    // Keep the phase enum referenced so tree-shaking doesn't drop the contract.
    void CALL_RESULT_PHASES;

    const result = await getPhoTestStore().acknowledge({
      sessionId,
      revision,
      resultingPhase: body.resultingPhase as CallResultPhase,
      clientId,
    });

    if (result.ok === false) {
      return json(result.reason === "missing" ? 404 : 409, {
        error: "Acknowledgement rejected",
      });
    }
    return json(200, result.acknowledgement);
  }

  return json(404, { error: "Not found" });
}

export async function writeApiResult(
  res: ServerResponse,
  result: ApiResult,
): Promise<void> {
  for (const [key, value] of Object.entries(result.headers ?? {})) {
    res.setHeader(key, value);
  }
  res.statusCode = result.status;
  res.end(JSON.stringify(result.body));
}
