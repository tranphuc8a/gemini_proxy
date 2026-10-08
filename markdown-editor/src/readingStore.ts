import { create } from 'zustand'
import { resolveTheme, useEditorStore } from './store'
import {
  DEFAULT_READING_SETTINGS,
  READING_FONT,
  clampFontSize,
  clampLineHeight,
  loadReadingSettings,
  saveReadingSettings,
  syncReadFlag,
  type ReadingSettings,
  type ReadingTheme,
  type ReadingWidth
} from './lib/reading'

interface ReadingState extends ReadingSettings {
  open: boolean
  openReading: () => void
  closeReading: () => void
  toggleReading: () => void
  setFontSize: (fontSize: number) => void
  /** Steps the text size by `delta` increments, staying inside the supported range. */
  stepFontSize: (delta: number) => void
  setLineHeight: (lineHeight: number) => void
  setWidth: (width: ReadingWidth) => void
  setReadingTheme: (theme: ReadingTheme) => void
  resetReadingSettings: () => void
}

/** Until the reader picks a theme, reading mode starts in the app's own light or dark. */
function appTheme(): ReadingTheme {
  return resolveTheme(useEditorStore.getState().theme) === 'dark' ? 'dark' : 'light'
}

function settingsOf(state: ReadingSettings): ReadingSettings {
  return { fontSize: state.fontSize, lineHeight: state.lineHeight, width: state.width, theme: state.theme }
}

/**
 * Reading mode lives beside the editor store rather than inside it: none of
 * this is document state, and its settings persist under their own key.
 */
export const useReadingStore = create<ReadingState>((set, get) => {
  /** Every change is saved at once; they are rare, unlike keystrokes. */
  const update = (patch: Partial<ReadingSettings>) => {
    set(patch)
    saveReadingSettings(settingsOf(get()))
  }

  return {
    ...DEFAULT_READING_SETTINGS,
    open: false,

    openReading: () => {
      if (get().open) return
      // Read on every open: another tab may have changed them since.
      set({ ...loadReadingSettings(appTheme()), open: true })
      syncReadFlag(true)
    },

    closeReading: () => {
      if (!get().open) return
      set({ open: false })
      syncReadFlag(false)
    },

    toggleReading: () => (get().open ? get().closeReading() : get().openReading()),

    setFontSize: (fontSize) => update({ fontSize: clampFontSize(fontSize) }),
    stepFontSize: (delta) => update({ fontSize: clampFontSize(get().fontSize + delta * READING_FONT.step) }),
    setLineHeight: (lineHeight) => update({ lineHeight: clampLineHeight(lineHeight) }),
    setWidth: (width) => update({ width }),
    setReadingTheme: (theme) => update({ theme }),
    resetReadingSettings: () => update({ ...DEFAULT_READING_SETTINGS, theme: appTheme() })
  }
})
