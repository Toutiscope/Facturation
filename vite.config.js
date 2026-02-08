import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [
    vue(),
    electron([
      {
        entry: path.resolve(__dirname, 'src/main/index.js'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron/main'),
            minify: false,
            rollupOptions: {
              external: ['electron', 'electron-log']
            }
          }
        }
      },
      {
        entry: path.resolve(__dirname, 'src/preload/index.js'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron/preload'),
            rollupOptions: {
              external: ['electron']
            }
          }
        },
        onstart(options) {
          options.reload()
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer')
    }
  },
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
})
