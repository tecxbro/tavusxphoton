import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { tavusApiPlugin } from "./scripts/tavusApiPlugin.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Shell / process env wins. Only fill keys that are not already set
  // (so `TAVUS_TEST_MODE=false npm run dev` overrides `.env.local`).
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  // Default to test mode when unset (safe for local builds without the
  // start-the-server skill). The skill sets TAVUS_TEST_MODE=false in the shell.
  if (process.env.TAVUS_TEST_MODE === undefined) {
    process.env.TAVUS_TEST_MODE = "true";
  }

  return {
    plugins: [react(), tavusApiPlugin()],
    server: {
      host: true,
      port: 5173,
    },
  };
});
