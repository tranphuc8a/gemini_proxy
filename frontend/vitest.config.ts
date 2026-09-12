import { defineConfig } from 'vitest/config'

/**
 * Test config, kept separate from vite.config.ts.
 *
 * Vitest resolves its own copy of Vite, whose plugin types do not match the
 * rolldown-based Vite this project builds with; sharing one config file makes
 * `tsc` reject the plugin array. Tests do not need the React plugin — esbuild
 * compiles JSX from the `jsx: react-jsx` setting in tsconfig.app.json, and Fast
 * Refresh is a dev-server concern.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
})
