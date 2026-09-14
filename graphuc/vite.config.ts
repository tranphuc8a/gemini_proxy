/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // The FastAPI webapp server mounts this build below a nested URL path, so
  // asset URLs must be relative rather than rooted at '/'.
  base: './',
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      // Dev-only: lets the app call the API on the same origin, which is what
      // it does when the FastAPI collection serves it in production.
      '/graphs': { target: 'http://localhost:6789', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
