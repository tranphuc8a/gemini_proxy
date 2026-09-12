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
    // Component tests here mount antd plus i18n plus the markdown pipeline, and
    // individual cases already run 2-4s. Vitest's 5s default left them tipping
    // over the limit whenever the suite ran in parallel on a loaded machine.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
})
