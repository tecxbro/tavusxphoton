import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  featureDisabled,
  isFeatureEnabled,
  methodNotAllowed,
  sendJson,
} from "../_lib/http.js";
import { getPhoTestStore } from "../_lib/phoTestStore.js";
import { isSafeSessionId } from "../../src/contracts/phoTestController.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  if (!isFeatureEnabled()) {
    featureDisabled(res);
    return;
  }

  const sessionIdRaw = req.query.sessionId;
  const sessionId =
    typeof sessionIdRaw === "string"
      ? sessionIdRaw
      : Array.isArray(sessionIdRaw)
        ? sessionIdRaw[0]
        : "";

  if (!sessionId || !isSafeSessionId(sessionId)) {
    sendJson(res, 400, { error: "Invalid session id" });
    return;
  }

  const store = getPhoTestStore();
  const state = await store.getState(sessionId);
  sendJson(res, 200, state);
}
