import { create } from 'zustand'
import { FileNode, EditorState } from './types'
import { loadMarkdownFiles, saveMarkdownFiles } from './services/markdownStorage'

const ADMIN_KEY = 'markdown-editor-admin-2024'
const STORAGE_KEY = 'markdown-editor-data'

interface StoreState extends EditorState {
  // Content actions
  setContent: (content: string) => void
  undo: () => void
  redo: () => void
  
  // File actions
  setCurrentFile: (fileId: string | null, content?: string) => void
  createFile: (parentId: string | null, name: string) => void
  createFolder: (parentId: string | null, name: string) => void
  deleteFile: (fileId: string) => void
  renameFile: (fileId: string, newName: string) => void
  saveFile: (fileId: string, content: string) => void
  
  // Auth actions
  loginAdmin: (key: string) => boolean
  logout: () => void
  
  // Settings
  toggleDarkMode: () => void
  toggleScrollSync: () => void
  setViewMode: (viewMode: EditorState['viewMode']) => void
  setEditorWidth: (editorWidth: number) => void
  toggleBackendStorage: () => void
  setBackendStorageType: (storageType: EditorState['backendStorageType']) => void
  loadBackendStorage: () => Promise<void>
  saveBackendStorage: () => Promise<void>
  
  // Load/Save
  loadFromStorage: () => void
  saveToStorage: () => void
}

const initialState: EditorState = {
  currentContent: '# Welcome to Markdown Editor\n\nStart typing markdown here...',
  currentFileId: null,
  files: [
    {
      id: 'root',
      name: 'My Documents',
      type: 'folder',
      children: [
        {
          id: 'welcome',
          name: 'welcome.md',
          type: 'file',
          parentId: 'root',
          content: '# Welcome to Markdown Editor\n\nStart typing markdown here...'
        }
      ]
    }
  ],
  history: ['# Welcome to Markdown Editor\n\nStart typing markdown here...'],
  historyIndex: 0,
  isAdmin: false,
  isDarkMode: false,
  scrollSync: true,
  viewMode: 'split',
  editorWidth: 50,
  backendStorage: false,
  backendStorageType: 'json'
}

export const useEditorStore = create<StoreState>((set, get) => ({
  ...initialState,

  setContent: (content: string) => {
    const state = get()
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push(content)
    
    set({
      currentContent: content,
      history: newHistory,
      historyIndex: newHistory.length - 1
    })

    if (state.currentFileId) {
      get().saveFile(state.currentFileId, content)
    }
  },

  undo: () => {
    const state = get()
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1
      set({
        currentContent: state.history[newIndex],
        historyIndex: newIndex
      })
    }
  },

  redo: () => {
    const state = get()
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1
      set({
        currentContent: state.history[newIndex],
        historyIndex: newIndex
      })
    }
  },

  setCurrentFile: (fileId: string | null, content?: string) => {
    if (content !== undefined) {
      set({
        currentFileId: fileId,
        currentContent: content,
        history: [content],
        historyIndex: 0
      })
    } else {
      const file = findFileById(get().files, fileId)
      if (file && file.type === 'file') {
        set({
          currentFileId: fileId,
          currentContent: file.content || '',
          history: [file.content || ''],
          historyIndex: 0
        })
      }
    }
  },

  createFile: (parentId: string | null, name: string) => {
    if (!get().isAdmin) return

    const newFile: FileNode = {
      id: 'file-' + Date.now(),
      name,
      type: 'file',
      content: '',
      parentId: parentId || undefined
    }

    set({
      files: addFileToTree(get().files, newFile, parentId)
    })
  },

  createFolder: (parentId: string | null, name: string) => {
    if (!get().isAdmin) return

    const newFolder: FileNode = {
      id: 'folder-' + Date.now(),
      name,
      type: 'folder',
      children: [],
      parentId: parentId || undefined
    }

    set({
      files: addFileToTree(get().files, newFolder, parentId)
    })
  },

  deleteFile: (fileId: string) => {
    if (!get().isAdmin) return

    set({
      files: deleteFileFromTree(get().files, fileId)
    })

    if (get().currentFileId === fileId) {
      set({
        currentFileId: null,
        currentContent: ''
      })
    }
  },

  renameFile: (fileId: string, newName: string) => {
    if (!get().isAdmin) return

    set({
      files: renameFileInTree(get().files, fileId, newName)
    })
  },

  saveFile: (fileId: string, content: string) => {
    set({
      files: updateFileContent(get().files, fileId, content)
    })
  },

  loginAdmin: (key: string) => {
    if (key === ADMIN_KEY) {
      set({ isAdmin: true })
      return true
    }
    return false
  },

  logout: () => {
    set({ isAdmin: false })
  },

  toggleDarkMode: () => {
    set((state) => ({ isDarkMode: !state.isDarkMode }))
  },

  toggleScrollSync: () => {
    set((state) => ({ scrollSync: !state.scrollSync }))
  },

  setViewMode: (viewMode) => set({ viewMode }),

  setEditorWidth: (editorWidth) => set({ editorWidth: Math.min(80, Math.max(20, editorWidth)) }),

  toggleBackendStorage: () => set((state) => ({ backendStorage: !state.backendStorage })),

  setBackendStorageType: (backendStorageType) => set({ backendStorageType }),

  loadBackendStorage: async () => {
    const files = await loadMarkdownFiles(get().backendStorageType)
    if (files.length) set({ files })
  },

  saveBackendStorage: async () => {
    await saveMarkdownFiles(get().files, get().backendStorageType)
  },

  loadFromStorage: () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        set(data)
      } catch (e) {
        console.error('Failed to load from storage', e)
      }
    }
  },

  saveToStorage: () => {
    const state = get()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
}))

// Helper functions
function findFileById(files: FileNode[], id: string | null): FileNode | null {
  if (!id) return null
  for (const file of files) {
    if (file.id === id) return file
    if (file.children) {
      const found = findFileById(file.children, id)
      if (found) return found
    }
  }
  return null
}

function addFileToTree(files: FileNode[], newFile: FileNode, parentId: string | null): FileNode[] {
  if (!parentId) {
    return [...files, newFile]
  }

  return files.map((file) => {
    if (file.id === parentId && file.type === 'folder') {
      return {
        ...file,
        children: [...(file.children || []), newFile]
      }
    }
    if (file.children) {
      return {
        ...file,
        children: addFileToTree(file.children, newFile, parentId)
      }
    }
    return file
  })
}

function deleteFileFromTree(files: FileNode[], fileId: string): FileNode[] {
  return files
    .filter((file) => file.id !== fileId)
    .map((file) => {
      if (file.children) {
        return {
          ...file,
          children: deleteFileFromTree(file.children, fileId)
        }
      }
      return file
    })
}

function renameFileInTree(files: FileNode[], fileId: string, newName: string): FileNode[] {
  return files.map((file) => {
    if (file.id === fileId) {
      return { ...file, name: newName }
    }
    if (file.children) {
      return {
        ...file,
        children: renameFileInTree(file.children, fileId, newName)
      }
    }
    return file
  })
}

function updateFileContent(files: FileNode[], fileId: string, content: string): FileNode[] {
  return files.map((file) => {
    if (file.id === fileId && file.type === 'file') {
      return { ...file, content }
    }
    if (file.children) {
      return {
        ...file,
        children: updateFileContent(file.children, fileId, content)
      }
    }
    return file
  })
}
