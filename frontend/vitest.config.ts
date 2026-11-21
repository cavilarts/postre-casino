import { defineConfig } from "vitest/config";

// Unit tests cover pure modules, so they run in Node without the Solid/Tailwind plugins.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
