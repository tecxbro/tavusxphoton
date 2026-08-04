import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { handleTavusRequest } from "../src/lib/tavus/tavus-api-vite-ssr.ts";

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function toWebRequest(req: IncomingMessage, url: URL): Promise<Request> {
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
    const body = await readBody(req);
    if (body.length > 0) {
      init.body = body;
    }
  }

  return new Request(url, init);
}

async function writeWebResponse(
  res: ServerResponse,
  webRes: Response,
): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!res.getHeader("Cache-Control")) {
    res.setHeader("Cache-Control", "no-store");
  }

  if (webRes.status === 204 || webRes.status === 205) {
    res.end();
    return;
  }

  const buffer = Buffer.from(await webRes.arrayBuffer());
  res.end(buffer);
}

/**
 * Serves `POST /api/tavus` during Vite dev so the same
 * `handleTavusRequest` used by the Vercel adapter is available locally.
 */
export function tavusApiPlugin(): Plugin {
  return {
    name: "tavus-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const host = req.headers.host || "127.0.0.1";
          const url = new URL(req.url || "/", `http://${host}`);
          if (url.pathname !== "/api/tavus") {
            next();
            return;
          }

          const webReq = await toWebRequest(req, url);
          const webRes = await handleTavusRequest(webReq);
          await writeWebResponse(res, webRes);
        } catch (error) {
          console.error("[tavus-api]", error);
          res.statusCode = 500;
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Internal error" }));
        }
      });
    },
  };
}
