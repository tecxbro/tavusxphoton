import type { VercelRequest, VercelResponse } from "@vercel/node";

export const MAX_BODY_BYTES = 4 * 1024;

export function isFeatureEnabled(): boolean {
  return process.env.ENABLE_PHO_TEST_CONTROLLER === "true";
}

export function getControllerSecret(): string | null {
  const secret = process.env.TEST_CONTROLLER_SECRET;
  if (!secret || secret.length < 8) return null;
  return secret;
}

export function setNoStore(res: VercelResponse): void {
  res.setHeader("Cache-Control", "no-store");
}

export function sendJson(
  res: VercelResponse,
  status: number,
  body: unknown,
): void {
  setNoStore(res);
  res.status(status).json(body);
}

export function methodNotAllowed(
  res: VercelResponse,
  allowed: string[],
): void {
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, { error: "Method not allowed" });
}

export function featureDisabled(res: VercelResponse): void {
  sendJson(res, 404, { error: "Not found" });
}

export function readBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  return match[1]?.trim() || null;
}

export function requireBearer(
  req: VercelRequest,
  res: VercelResponse,
): boolean {
  const expected = getControllerSecret();
  if (!expected) {
    sendJson(res, 503, { error: "Service unavailable" });
    return false;
  }
  const provided = readBearerToken(req);
  if (!provided || provided !== expected) {
    sendJson(res, 401, { error: "Unauthorized" });
    return false;
  }
  return true;
}

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim() || "unknown";
  }
  return req.socket?.remoteAddress || "unknown";
}

export function enforceContentTypeJson(
  req: VercelRequest,
  res: VercelResponse,
): boolean {
  const contentType = req.headers["content-type"];
  if (
    typeof contentType !== "string" ||
    !contentType.toLowerCase().includes("application/json")
  ) {
    sendJson(res, 415, { error: "Unsupported media type" });
    return false;
  }
  return true;
}

export function readJsonBody<T>(
  req: VercelRequest,
  res: VercelResponse,
): T | null {
  const raw = req.body;
  if (raw == null) {
    sendJson(res, 400, { error: "Invalid request" });
    return null;
  }

  if (typeof raw === "string") {
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      sendJson(res, 413, { error: "Payload too large" });
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      sendJson(res, 400, { error: "Invalid request" });
      return null;
    }
  }

  if (typeof raw === "object") {
    const serialized = JSON.stringify(raw);
    if (Buffer.byteLength(serialized, "utf8") > MAX_BODY_BYTES) {
      sendJson(res, 413, { error: "Payload too large" });
      return null;
    }
    return raw as T;
  }

  sendJson(res, 400, { error: "Invalid request" });
  return null;
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) {
    return false;
  }
  existing.count += 1;
  return true;
}

/** Test-only helper to clear rate-limit buckets between cases. */
export function __resetRateLimitsForTests(): void {
  rateBuckets.clear();
}
