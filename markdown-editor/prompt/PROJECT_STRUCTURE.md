# 📐 Markdown Editor - Project Structure & Design

## 🎯 Project Overview

A full-featured markdown editor built entirely in the frontend using React, TypeScript, and Vite. No backend server required for core functionality.

## 📁 Directory Structure

```
markdown-editor/
│
├── src/                              # Source code directory
│   │
│   ├── components/                   # React components
│   │   ├── Header.tsx               # Main header with toolbar
│   │   ├── Header.css               # Header styling
│   │   │
│   │   ├── Sidebar.tsx              # Left sidebar for file management
│   │   ├── Sidebar.css              # Sidebar styling
│   │   │
│   │   ├── FileTree.tsx             # File tree component
│   │   ├── FileTree.css             # File tree styling
│   │   │
│   │   ├── Editor.tsx               # Markdown editor textarea
│   │   ├── Editor.css               # Editor styling
│   │   │
│   │   ├── Preview.tsx              # Markdown preview pane
│   │   ├── Preview.css              # Preview styling (GitHub theme)
│   │   │
│   │   ├── AuthModal.tsx            # Admin login modal
│   │   └── AuthModal.css            # Auth modal styling
│   │
│   ├── App.tsx                      # Main application component
│   ├── App.css                      # App layout and theming
│   │
│   ├── main.tsx                     # React entry point
│   ├── index.css                    # Global styles (GitHub markdown theme)
│   │
│   ├── store.ts                     # Zustand state management
│   └── types.ts                     # TypeScript interfaces
│
├── index.html                        # HTML entry point
├── vite.config.ts                    # Vite build configuration
├── tsconfig.json                     # TypeScript compiler options
├── tsconfig.node.json                # TypeScript for build tools
├── package.json                      # Project metadata & dependencies
├── eslint.config.js                  # ESLint configuration
├── .gitignore                        # Git ignore patterns
├── README.md                         # User documentation
├── PROJECT_STRUCTURE.md              # This file
└── dist/                             # Production build output (generated)
```

## 🏗️ Architecture

### Component Hierarchy

```
App
├── AuthModal          # Fixed position auth button/modal
├── Header            # Top toolbar
│   ├── Undo/Redo buttons
│   ├── Scroll sync toggle
│   ├── Dark mode toggle
│   └── Logout button (if admin)
│
├── Sidebar           # Left file navigator
│   ├── New file form (admin only)
│   └── FileTree
│       └── FileTreeItem (recursive)
│           ├── Expand button (folders)
│           ├── File/folder name
│           ├── Actions (rename, delete - admin only)
│           └── FileTree (children)
│
└── Editor-Preview Container
    ├── Editor
    │   └── Textarea with markdown input
    │
    └── Preview
        └── Rendered markdown (GitHub theme)
```

## 🔄 State Management (Zustand)

### Store Structure (`src/store.ts`)

```typescript
EditorState = {
  // Content
  currentContent: string
  
  // File Management
  currentFileId: string | null
  files: FileNode[]
  
  // History (Undo/Redo)
  history: string[]
  historyIndex: number
  
  // User State
  isAdmin: boolean
  
  // UI State
  isDarkMode: boolean
  scrollSync: boolean
}
```

### Core Actions
- `setContent()` - Update editor content and history
- `undo()` / `redo()` - Navigate history
- `setCurrentFile()` - Load file into editor
- `createFile()` / `createFolder()` - Create new items (admin)
- `deleteFile()` / `renameFile()` - Modify files (admin)
- `loginAdmin()` / `logout()` - Authentication
- `toggleDarkMode()` / `toggleScrollSync()` - UI settings
- `loadFromStorage()` / `saveToStorage()` - Persistence

## 📊 Data Structures

### FileNode (Recursive Tree)
```typescript
interface FileNode {
  id: string              // Unique identifier
  name: string            // Display name
  type: 'file' | 'folder' // Node type
  content?: string        // File content (files only)
  children?: FileNode[]   // Child nodes (folders only)
  parentId?: string       // Parent reference
}
```

### File Tree Operations
- **Tree Traversal**: Recursive functions to find, add, update nodes
- **Flattening**: Convert tree to flat array for rendering
- **Manipulation**: Helper functions for CRUD operations

## 💾 Data Persistence

### Storage Strategy
- **Primary**: Browser localStorage (5-10MB limit per domain)
- **Key**: `markdown-editor-data`
- **Frequency**: Auto-save every 5 seconds
- **Format**: JSON serialization of complete app state

### Stored Data
```json
{
  "currentContent": "...",
  "files": [...],
  "history": [...],
  "isDarkMode": false,
  "scrollSync": true
}
```

## 🎨 Styling Approach

### CSS Organization
1. **Global Styles** (`index.css`)
   - Resets and typography
   - GitHub markdown theme baseline
   - Dark mode support
   - Scrollbar customization

2. **Component Styles** (`*.css` per component)
   - Scoped to component using class names
   - BEM naming convention (e.g., `.editor-wrapper`, `.editor-header`)
   - Dark mode variants with `.app.dark-mode` selector

3. **Theme System**
   - CSS classes control light/dark mode
   - Applied to root `.app` element
   - Automatic cascade to all children
   - No CSS variables needed (for broad browser support)

### GitHub Markdown Theme
- Mimics GitHub's markdown rendering style
- Proper heading hierarchy with borders
- Table styling with alternating rows
- Code block highlighting background
- Blockquote left-border accent
- Link colors matching GitHub (blue light, cyan dark)

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Tab` | Indent (2 spaces) |
| `Enter` | Confirm in modals/forms |

## 🔐 Authentication Flow

### Admin Key System
```
User clicks 🔐 button
    ↓
AuthModal appears
    ↓
User enters secret key
    ↓
Key compared with hardcoded value
    ↓
If match: isAdmin = true, UI enables edit features
If not: Error message shown
```

### Admin Key Location
- **Defined in**: `src/store.ts`
- **Current value**: `markdown-editor-admin-2024`
- **For production**: Move to environment variables

### Protected Actions (Admin Only)
- Create files/folders
- Edit file content
- Rename files
- Delete files

## 📋 Component Details

### Header (`Header.tsx`)
- **Undo/Redo buttons** with disabled state based on history
- **Scroll sync toggle** to enable/disable scroll synchronization
- **Dark mode toggle** for theme switching
- **User status** showing admin/view-only
- **Logout button** (only for admins)

### Sidebar (`Sidebar.tsx`)
- **File tree** with folder expansion
- **New file/folder form** (admin only)
- **Icon-based UI** for quick visual recognition
- **Responsive scrolling** for many files

### FileTree (`FileTree.tsx`)
- **Recursive component** for nested file structure
- **Inline rename** with edit input
- **Context actions** (edit, delete) shown on hover
- **Selection highlight** for current file
- **Keyboard support** for expand/collapse

### Editor (`Editor.tsx`)
- **Textarea element** for markdown input
- **Tab handling** to insert spaces instead of focus shift
- **Read-only mode** for non-admin users
- **Keyboard shortcut handling** for undo/redo
- **Syntax highlighting placeholder** (can add later)

### Preview (`Preview.tsx`)
- **react-markdown** with multiple plugins
- **GFM support** via remark-gfm
- **Math rendering** via KaTeX
- **Mermaid diagrams** inline code block support
- **Scroll sync** with editor (percentage-based)
- **External links** open in new tabs

### AuthModal (`AuthModal.tsx`)
- **Fixed position button** bottom-right corner
- **Modal overlay** with backdrop blur
- **Password input** for admin key
- **Error feedback** on invalid key
- **Hint text** pointing to store.ts

## 🔄 Scroll Synchronization

### How It Works
1. **Editor scroll event** triggers percentage calculation
2. **Percentage** = scrollTop / (scrollHeight - clientHeight)
3. **Preview scroll** updated to same percentage
4. **Bidirectional** support with debouncing

### Implementation
```typescript
// When preview scrolls
const scrollPercentage = element.scrollTop / (element.scrollHeight - element.clientHeight)
editorElement.scrollTop = scrollPercentage * (editorElement.scrollHeight - editorElement.clientHeight)
```

## 🎬 Undo/Redo System

### History Management
```
history: ['state0', 'state1', 'state2', 'state3']
historyIndex: 2

undo() → historyIndex: 1 (show 'state1')
redo() → historyIndex: 2 (show 'state2')
setContent() → truncate history at index, add new state
```

### Features
- **Full content history** (not just deltas)
- **Keyboard shortcuts** for quick undo/redo
- **Disabled state** when at history boundaries
- **Automatic truncation** when editing after undo

## 🚀 Build & Deployment

### Build Process
1. **TypeScript Compilation** → JavaScript
2. **Module Resolution** → bundling dependencies
3. **Code Splitting** → optimized chunks
4. **Asset Optimization** → image/CSS minification
5. **Source Map Generation** (dev only)

### Output Structure
```
dist/
├── index.html          # Minified HTML
├── assets/
│   ├── index-xxx.js    # Main bundle
│   └── index-xxx.css   # Global styles
└── ...other chunks
```

### Production Considerations
- Serve `dist/` folder contents
- Configure server to serve `index.html` for SPA routing
- Enable gzip compression
- Set cache headers appropriately
- Use CDN for static assets

## 🧪 Testing Strategy

### Unit Tests (Future)
- Store actions and state mutations
- File tree operations
- History management
- Markdown rendering edge cases

### Integration Tests (Future)
- Admin login flow
- File creation and editing
- Scroll synchronization
- Theme switching

### E2E Tests (Future)
- Full user workflows
- File management operations
- Keyboard shortcuts
- Authentication scenarios

## 📈 Performance Optimizations

### Current
- React.memo for component memoization
- Zustand for efficient state updates
- CSS transitions for smooth UI
- Lazy image loading in preview

### Potential Improvements
- Virtual scrolling for large file trees
- Code splitting with React.lazy()
- Markdown rendering memoization
- IndexedDB for larger storage needs
- Service Worker for offline support

## 🔗 External Dependencies

### Runtime
- **react**: UI framework
- **react-dom**: DOM rendering
- **react-markdown**: Markdown parser
- **remark-gfm**: GitHub markdown plugin
- **remark-math**: Math formula plugin
- **rehype-katex**: KaTeX rendering
- **mermaid**: Diagram rendering
- **zustand**: State management

### Build
- **vite**: Fast build tool
- **@vitejs/plugin-react**: React support
- **typescript**: Type checking
- **eslint**: Code linting

## 📚 File Naming Conventions

### Components
- `PascalCase.tsx` for component files
- `camelCase.css` for styles
- One component per file
- Styles in same directory

### Non-Components
- `camelCase.ts` for utilities
- `types.ts` for interfaces
- `store.ts` for state management

### CSS Classes
- `.component-element` (kebab-case)
- `.component-element--modifier` (BEM)
- `.app.dark-mode .selector` for dark mode

## 🎓 Development Workflow

### Adding a Feature
1. Update `types.ts` if needed
2. Add store action in `store.ts`
3. Create component file(s)
4. Create component styles
5. Import and use in parent component
6. Test in dev mode
7. Build and verify production

### Debugging
- Use React DevTools browser extension
- Check browser console for errors
- Inspect localStorage in DevTools
- Monitor state changes in Zustand DevTools

## 🌟 Key Design Decisions

### Why Zustand?
- Lightweight (~2KB)
- No boilerplate (actions, reducers)
- TypeScript support
- Subscriptions for auto-save

### Why Vite?
- Extremely fast build times
- Native ES modules
- Perfect for React development
- Optimized production builds

### Why react-markdown + plugins?
- Safe HTML rendering
- Extensible plugin system
- Good GitHub markdown support
- No heavy dependencies

### Frontend Only?
- Faster development
- No server setup needed
- Educational purpose
- Easy to add backend later

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Production Ready
