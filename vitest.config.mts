import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    // Run in a non-Melbourne zone so tests catch any accidental reliance on local time.
    env: { TZ: "America/New_York" },
  },
});
