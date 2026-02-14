import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Plugin Vite qui copie les fichiers de polices AFM de PDFKit
 * dans dist-electron/data/ après chaque build du main process.
 * PDFKit utilise fs.readFileSync(__dirname + '/data/...') pour charger
 * ses polices intégrées, ce qui casse quand le code est bundlé.
 */
function copyPdfkitDataPlugin() {
  const src = path.resolve(__dirname, "node_modules/pdfkit/js/data");
  const dest = path.resolve(__dirname, "dist-electron/data");

  return {
    name: "copy-pdfkit-data",
    writeBundle() {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      for (const file of fs.readdirSync(src)) {
        fs.copyFileSync(path.join(src, file), path.join(dest, file));
      }
    },
  };
}

export default defineConfig({
  plugins: [
    vue(),

    electron([
      {
        entry: path.resolve(__dirname, "src/main/index.js"),
        vite: {
          plugins: [copyPdfkitDataPlugin()],
        },
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
