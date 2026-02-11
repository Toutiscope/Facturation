import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vue(),

    electron([
      {
        entry: path.resolve(__dirname, "src/main/index.js"),
      },
      {
        entry: path.resolve(__dirname, "src/preload/index.js"),
        onstart: (options) => {
          options.renderer = false; // ⚡ important : preload ne doit pas être bundlé côté renderer
        },
      },
    ]),

    renderer(), // rend le preload API disponible côté renderer
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
    },
  },

  base: "./",

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/renderer/index.html"),
    },
  },

  server: {
    port: 5173,
  },
});
