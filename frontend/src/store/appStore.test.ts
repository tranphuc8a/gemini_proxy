import { beforeEach, describe, expect, it } from 'vitest';
import { readPersistedLanguage, SETTINGS_STORAGE_KEY, useAppStore } from './appStore';

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ theme: 'dark', language: 'vi', sidebarCollapsed: false });
});

describe('preferences', () => {
  it('toggles the theme', () => {
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('light');
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('dark');
  });

  it('toggles the sidebar', () => {
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
  });

  it('persists under a single key', () => {
    useAppStore.getState().setLanguage('en');
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain('"language":"en"');
  });
});

describe('readPersistedLanguage', () => {
  it('reads the language back out of the settings store', () => {
    // Regression: i18n used to read a separate `localStorage.language` key, so
    // the two could disagree about what language the UI was in.
    useAppStore.getState().setLanguage('en');
    expect(readPersistedLanguage()).toBe('en');
  });

  it('defaults to Vietnamese with nothing stored', () => {
    expect(readPersistedLanguage()).toBe('vi');
  });

  it('defaults rather than throwing on corrupted storage', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, 'not json at all');
    expect(readPersistedLanguage()).toBe('vi');
  });

  it('rejects a language it does not support', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ state: { language: 'klingon' } }));
    expect(readPersistedLanguage()).toBe('vi');
  });
});
