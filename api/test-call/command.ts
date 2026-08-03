import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceContentTypeJson,
  featureDisabled,
  getClientIp,
  isFeatureEnabled,
  methodNotAllowed,
  rateLimit,
  readJsonBody,
  requireBearer,
  sendJson,
} from "../_lib/http.js";
import { getPhoTestStore } from "../_lib/phoTestStore.js";
import {
  isPhoTestAction,
  isSafeSessionId,
} from "../../src/contracts/phoTestController.js";

interface CommandBody {
  sessionId?: unknown;
  action?: unknown;
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

  if (!requireBearer(req, res)) return;
  if (!enforceContentTypeJson(req, res)) return;

  const ip = getClientIp(req);
  if (!rateLimit(`command:${ip}`, 30, 60_000)) {
    sendJson(res, 429, { error: "Too many requests" });
    return;
  }

  const body = readJsonBody<CommandBody>(req, res);
  if (!body) return;

  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId : "";
  const action = body.action;

  if (!sessionId || !isSafeSessionId(sessionId)) {
    sendJson(res, 400, { error: "Invalid session id" });
    return;
  }

  if (!isPhoTestAction(action)) {
    sendJson(res, 400, { error: "Invalid action" });
    return;
  }

  const store = getPhoTestStore();
  const command = await store.issueCommand(sessionId, action);
  sendJson(res, 200, command);
}
