# Markdown Editor User Guide

## Quick Start

1. Run `npm install` once.
2. Start the app with `npm run dev`.
3. Open the local URL shown by Vite.
4. Click the lock button and enter the admin key when editing is required.

Anonymous users can browse files and preview Markdown. Admin users can create, edit, rename, copy, move, and delete files.

## The Main Workspace

- **Editor**: Write Markdown in the text area.
- **Preview**: See the rendered document.
- **Both**: Show the editor and preview side by side.
- **Divider**: Drag the bar between panes to change their widths.
- **Hide files / Show files**: Collapse or reopen the file sidebar.
- **Full screen**: Hide the top toolbar for a larger writing area.
- **Exit full screen**: When fullscreen is active, click the green arrow button at the bottom-right. Press `Escape` also exits the usage guide; the green button is the direct fullscreen exit.
- **?**: Open the in-app usage guide. Close it with `x`, click outside, or press `Escape`.

## File Management

1. Select a folder by clicking its name.
2. Click `+` in the Files panel.
3. Choose File or Folder, enter a name, and create it.
4. The new item is created inside the selected folder.
5. Hover a node to see rename, copy, and move actions.
6. To copy or move, first select the destination folder, then click the action on the source node.

The initial example file is stored in the `My Documents` folder. File data is saved to browser localStorage by default.

## Markdown Features

Supported syntax includes:

- GitHub Flavored Markdown
- Headings, lists, blockquotes, links, and images
- Tables and task lists
- Inline HTML
- LaTeX math, for example `$E = mc^2$`
- Mermaid diagrams in `mermaid` code blocks
- Syntax-highlighted code blocks, for example:

````markdown
```typescript
const message = 'Hello Markdown'
```
````

Click **Copy** on a highlighted code block to copy its source.

## Editing Tools

- `Ctrl+Z` or `Cmd+Z`: Undo
- `Ctrl+Y` or `Ctrl+Shift+Z`: Redo
- `Tab`: Insert two spaces
- Scroll either pane to synchronize positions.
- Double-click a position in Preview to focus the corresponding editor area.

## Import and Export

- **Import** accepts `.md` and `.markdown` files and loads the text into the active editor.
- **Export** downloads the current Markdown as `document.md`.
- **PDF**, **PNG**, and **JPG** export the rendered Preview. For best results, switch to Preview mode before exporting a long document.

## Backend Storage

The toolbar supports optional FastAPI synchronization:

1. Start the backend from `backend/fastapi`.
2. Enable `BE On`.
3. Choose `BE JSON` or `BE MySQL`.
4. Use `Load` or `Save`.

Configure the backend with `MARKDOWN_STORAGE_BACKEND=json` or `mysql`. JSON uses `MARKDOWN_JSON_FILE`; MySQL uses the existing database settings. Backend saves require the admin key.

## Theme and Access

- Click the moon/sun button to switch light and dark themes.
- Admin mode enables editing and file operations.
- Click Logout to return to view-only mode.

## Troubleshooting Fullscreen

If the top toolbar is hidden, this is expected. Use the green arrow button in the bottom-right corner to exit fullscreen. If the button is not visible, refresh the page; the saved application state will restore the workspace and the floating `?` help button remains available.
