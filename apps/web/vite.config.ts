import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@imc/shared-types": fileURLToPath(
        new URL("../../packages/shared-types/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:3002",
        ws: true,
        changeOrigin: true,
      },
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
