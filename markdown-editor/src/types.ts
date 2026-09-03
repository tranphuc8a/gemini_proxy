export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  parentId?: string;
}

export interface EditorState {
  currentContent: string;
  currentFileId: string | null;
  files: FileNode[];
  history: string[];
  historyIndex: number;
  isAdmin: boolean;
  isDarkMode: boolean;
  scrollSync: boolean;
  viewMode: 'split' | 'editor' | 'preview';
  editorWidth: number;
  backendStorage: boolean;
  backendStorageType: 'json' | 'mysql';
}

export interface ActionHistory {
  action: string;
  timestamp: number;
  details?: string;
}
