import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceContentTypeJson,
  featureDisabled,
  getClientIp,
  isFeatureEnabled,
  methodNotAllowed,
  rateLimit,
  readJsonBody,
  sendJson,
} from "../_lib/http.js";
import { getPhoTestStore } from "../_lib/phoTestStore.js";
import {
  isCallResultPhase,
  isSafeSessionId,
} from "../../src/contracts/phoTestController.js";

interface AckBody {
  sessionId?: unknown;
  revision?: unknown;
  resultingPhase?: unknown;
  clientId?: unknown;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  if (!isFeatureEnabled()) {
    featureDisabled(res);
    return;
  }

  if (!enforceContentTypeJson(req, res)) return;

  const ip = getClientIp(req);
  if (!rateLimit(`ack:${ip}`, 60, 60_000)) {
    sendJson(res, 429, { error: "Too many requests" });
    return;
  }

  const body = readJsonBody<AckBody>(req, res);
  if (!body) return;

  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId : "";
  const revision =
    typeof body.revision === "number" && Number.isInteger(body.revision)
      ? body.revision
      : NaN;
  const resultingPhase = body.resultingPhase;
  const clientId =
    typeof body.clientId === "string" ? body.clientId.slice(0, 128) : "";

  if (!sessionId || !isSafeSessionId(sessionId)) {
    sendJson(res, 400, { error: "Invalid session id" });
    return;
  }

  if (!Number.isFinite(revision) || revision < 1) {
    sendJson(res, 400, { error: "Invalid revision" });
    return;
  }

  if (!isCallResultPhase(resultingPhase)) {
    sendJson(res, 400, { error: "Invalid resulting phase" });
    return;
  }

  if (!clientId) {
    sendJson(res, 400, { error: "Invalid client id" });
    return;
  }

  const store = getPhoTestStore();
  const result = await store.acknowledge({
    sessionId,
    revision,
    resultingPhase,
    clientId,
  });

  if (result.ok === false) {
    const status = result.reason === "missing" ? 404 : 409;
    sendJson(res, status, { error: "Acknowledgement rejected" });
    return;
  }

  sendJson(res, 200, result.acknowledgement);
}
