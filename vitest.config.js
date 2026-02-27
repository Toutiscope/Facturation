import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.js"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
    },
  },
});
