import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "studio-html-entry",
      // Keep the source template separate from the committed Pages entry point.
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/" || req.url?.startsWith("/?")) {
            req.url = "/studio.html" + req.url.slice(1);
          }
          next();
        });
      },
    },
  ],
  base: "./",
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL("./studio.html", import.meta.url)),
    },
  },
  server: {
    watch: {ignored: ["**/test-results/**", "**/playwright-report/**"]},
    port: 5173,
    strictPort: true,
    https:
      mode === "https"
        ? {
            key: readFileSync(".cert/key.pem"),
            cert: readFileSync(".cert/cert.pem"),
          }
        : undefined,
  },
}));
