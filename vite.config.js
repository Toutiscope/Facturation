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
          options.reload();
        },
        vite: {
          build: {
            rollupOptions: {
              output: {
                entryFileNames: "preload.js",
              },
            },
          },
        },
      },
    ]),

    renderer(), // rend le preload API disponible côté renderer
  ],

  root: path.resolve(__dirname, "src/renderer"),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
    },
  },

  base: "./",

  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },

  server: {
    port: 5173,
  },
});
