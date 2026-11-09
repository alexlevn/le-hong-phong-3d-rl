import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 3674, strictPort: true },
  preview: { port: 3674, strictPort: true },
  optimizeDeps: { include: ["three"] },
  build: { chunkSizeWarningLimit: 800 },
});
