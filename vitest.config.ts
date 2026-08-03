import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/tests/setup.ts"],
    include: [
      "src/tests/unit/**/*.{test,spec}.{ts,tsx}",
      "api/tests/**/*.{test,spec}.{ts,tsx}",
    ],
  },
});
