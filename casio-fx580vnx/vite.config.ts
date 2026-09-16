/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Served from a nested path inside the FastAPI collection.
  base: './',
  plugins: [react()],
  server: { port: 5176 },
  build: { outDir: 'dist', sourcemap: false, minify: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
