/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:6789'

  return {
    // The FastAPI webapp server mounts this build below /webapp/postman-lite-pro/,
    // so every asset reference has to be relative.
    base: './',
    plugins: [react()],
    server: {
      port: 5175,
      open: true,
      // Proxying keeps the browser on one origin in development, so the API
      // never needs CORS headers for the dev server. `/api` covers deployments
      // that set a non-empty API_PREFIX.
      proxy: {
        '/postman': { target: apiTarget, changeOrigin: true },
        '/proxy': { target: apiTarget, changeOrigin: true },
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      // Build to dist/ like the other web apps; scripts/build-webapps.mjs is what
      // publishes it into the collection. Writing straight into webapp/ put the
      // app at the wrong path and let emptyOutDir wipe files the collection owns.
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: ['src/lib/**/*.ts', 'src/store.ts'],
        reporter: ['text', 'html'],
      },
    },
  }
})
