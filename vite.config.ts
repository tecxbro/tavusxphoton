import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { phoTestApiPlugin } from "./scripts/phoTestApiPlugin.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  // Local / Playwright defaults so the test controller works without a
  // checked-in secret. Production must set real values in Vercel.
  if (!process.env.ENABLE_PHO_TEST_CONTROLLER) {
    process.env.ENABLE_PHO_TEST_CONTROLLER = "true";
  }
  if (!process.env.PHO_TEST_USE_MEMORY_STORE) {
    process.env.PHO_TEST_USE_MEMORY_STORE = "true";
  }
  if (!process.env.TEST_CONTROLLER_SECRET) {
    process.env.TEST_CONTROLLER_SECRET = "local-dev-controller-secret";
  }

  return {
    plugins: [react(), phoTestApiPlugin()],
    server: {
      host: true,
      port: 5173,
    },
  };
});
