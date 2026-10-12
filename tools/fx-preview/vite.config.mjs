import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))

// A tiny standalone page that renders the VFX library frame by frame — no
// Electron, no app. The effects are pure functions of time, so a still frame is exact.
export default defineConfig({
  root: here,
  server: { port: 5197, strictPort: false, fs: { allow: [resolve(here, '../..')] } },
  logLevel: 'warn'
})
