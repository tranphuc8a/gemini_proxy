import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
export type Language = 'vi' | 'en';

export const SETTINGS_STORAGE_KEY = 'app-settings';

interface AppState {
  theme: Theme;
  language: Language;
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

/**
 * User preferences, persisted under a single key.
 *
 * This store is the only source of truth for the language: i18n previously read
 * its own `localStorage.language` entry, so the two could disagree — clearing
 * one left the UI in a language the settings menu did not show.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      language: 'vi',
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setLanguage: (language) => set({ language }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
    }
  )
);

/** The persisted language, read without mounting React — used to boot i18n. */
export const readPersistedLanguage = (): Language => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return 'vi';
    const parsed = JSON.parse(raw) as { state?: { language?: Language } };
    return parsed.state?.language === 'en' ? 'en' : 'vi';
  } catch {
    // A private window, or storage the browser refuses to read.
    return 'vi';
  }
};
