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
}

export interface ActionHistory {
  action: string;
  timestamp: number;
  details?: string;
}
