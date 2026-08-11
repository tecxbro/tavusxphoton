/**
 * Vercel Node adapter for the shared Tavus proxy in `tavus-api-vite-ssr.ts`.
 * Keeps `TAVUS_API_KEY` server-side; browser never receives secrets.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleTavusRequest } from "../src/lib/tavus/tavus-api-vite-ssr.js";

/** Convert a Vercel Node request into a Fetch API `Request`. */
function toWebRequest(req: VercelRequest): Request {
  const host = req.headers.host || "localhost";
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto =
    typeof protoHeader === "string"
      ? protoHeader.split(",")[0]?.trim() || "https"
      : "https";
  const url = `${proto}://${host}${req.url || "/api/tavus"}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    }
  }

  const method = req.method || "GET";
  const init: RequestInit = { method, headers };

  if (method !== "GET" && method !== "HEAD") {
    if (typeof req.body === "string") {
      init.body = req.body;
    } else if (req.body != null) {
      init.body = JSON.stringify(req.body);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    }
  }

  return new Request(url, init);
}

/**
 * `POST /api/tavus` — create or end a Tavus conversation.
 *
 * @param req - Vercel request (JSON body with `action`).
 * @param res - Vercel response mirrored from {@link handleTavusRequest}.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const webRes = await handleTavusRequest(toWebRequest(req));

  res.status(webRes.status);
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (webRes.status === 204 || webRes.status === 205) {
    res.end();
    return;
  }

  const buffer = Buffer.from(await webRes.arrayBuffer());
  res.send(buffer.length ? buffer : undefined);
}
