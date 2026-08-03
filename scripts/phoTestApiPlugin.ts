import type { Plugin } from "vite";
import {
  handlePhoTestApi,
  writeApiResult,
} from "../api/_lib/dispatch.ts";

/**
 * Serves `/api/test-call/*` during Vite dev / Playwright so the same
 * handlers used by Vercel Functions are available locally.
 */
export function phoTestApiPlugin(): Plugin {
  return {
    name: "pho-test-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const host = req.headers.host || "127.0.0.1";
          const url = new URL(req.url || "/", `http://${host}`);
          if (!url.pathname.startsWith("/api/test-call")) {
            next();
            return;
          }
          const result = await handlePhoTestApi(req, url);
          if (!result) {
            next();
            return;
          }
          await writeApiResult(res, result);
        } catch (error) {
          console.error("[pho-test-api]", error);
          res.statusCode = 500;
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Internal error" }));
        }
      });
    },
  };
}
