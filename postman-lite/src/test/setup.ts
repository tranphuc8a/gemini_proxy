import '@testing-library/jest-dom/vitest'

// jsdom implements neither of these, and both are used by the app.
if (!('clipboard' in navigator)) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, writable: true })
}
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock'
  globalThis.URL.revokeObjectURL = () => {}
}
