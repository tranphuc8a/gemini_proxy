import { FileNode } from '../types'

const API_URL = import.meta.env.VITE_MARKDOWN_API_URL || 'http://localhost:6789/api/v1/markdown/files'
const ADMIN_KEY = 'markdown-editor-admin-2024'

export async function loadMarkdownFiles(storageType: 'json' | 'mysql'): Promise<FileNode[]> {
  const response = await fetch(`${API_URL}?backend=${storageType}`)
  if (!response.ok) throw new Error(`Backend load failed (${response.status})`)
  const data = await response.json() as { files: FileNode[] }
  return data.files
}

export async function saveMarkdownFiles(files: FileNode[], storageType: 'json' | 'mysql'): Promise<void> {
  const response = await fetch(`${API_URL}?backend=${storageType}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify({ files })
  })
  if (!response.ok) throw new Error(`Backend save failed (${response.status})`)
}
