import '@testing-library/jest-dom/vitest'

// jsdom implements neither of these, and both are used by the app.
// Configurable, so user-event's setup() can put its own clipboard in place.
if (!('clipboard' in navigator)) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => {} },
    writable: true,
    configurable: true,
  })
}
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock'
  globalThis.URL.revokeObjectURL = () => {}
}
