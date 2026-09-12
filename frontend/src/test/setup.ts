import '@testing-library/jest-dom/vitest';
// Initialise i18n for every test, so components render real copy rather than
// falling back to raw translation keys.
import '../i18n';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// findBy*/waitFor default to 1s, which is not enough for an antd modal or
// dropdown portal to settle while the rest of the suite runs in parallel.
configure({ asyncUtilTimeout: 10_000 });

// jsdom implements neither of these, and both are used by the chat viewport.
Element.prototype.scrollIntoView = vi.fn();

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
