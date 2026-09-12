/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // The FastAPI webapp server mounts this build below a nested URL path.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Vite 8 minifies with rolldown/oxc; it no longer ships esbuild.
    minify: true,
    rollupOptions: {
      output: {
        // Mermaid and the PDF/canvas exporters are imported on demand, so they
        // split themselves out. This only separates the always-loaded vendors
        // so a change to the app code does not invalidate all of them.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          // Prism grammars are deliberately left alone: the async-light build
          // dynamic-imports one per language, and grouping them would pull
          // every grammar into the initial load.
          if (/react-syntax-highlighter|refractor|prismjs/.test(id)) return
          if (/react-markdown|remark|rehype|micromark|mdast|hast|unist|unified|vfile|katex|property-information/.test(id)) {
            return 'markdown'
          }
        }
      }
    }
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
      reporter: ['text', 'html']
    }
  }
})
