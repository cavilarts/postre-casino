import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";

const backend = process.env.BACKEND_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [solid()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": backend,
      "/ws": { target: backend.replace(/^http/, "ws"), ws: true },
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
