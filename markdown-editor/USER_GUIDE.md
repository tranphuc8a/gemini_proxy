# Markdown Editor User Guide

## Quick start

```powershell
cd markdown-editor
npm install
npm run dev
```

Open the URL Vite prints (usually <http://localhost:5173>).

Everyone can read, search, and export. Editing is gated: click **View only** in the
top-right, enter the admin key (`markdown-editor-admin-2024` by default) and the chip
turns into **Admin**. The unlock lasts for the browser session only — it is never
written to storage, so a reload returns you to view-only.

## The workspace

| Area | What it does |
| --- | --- |
| Header | File menu, backend sync, view mode, theme, full screen, role |
| Sidebar | **Files** tree and **Outline** of the current document |
| Editor | Markdown source, with a formatting toolbar and line numbers |
| Preview | Live GitHub-flavoured rendering |
| Status bar | File name, save state, word/line counts, reading time, zoom |

- Switch panes with the **Editor / Both / Preview** control, or <kbd>Ctrl</kbd>+<kbd>\\</kbd>.
- Drag the divider between the panes to resize; double-click it to snap back to 50/50.
- Drag the sidebar's right edge to resize it; double-click to reset.
- <kbd>F11</kbd> hides the header for distraction-free writing; <kbd>Esc</kbd> or the
  status-bar button brings it back.

## Command palette

<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> opens a searchable list of every command,
every file, and every heading in the current document. Typing is fuzzy, so `tsb` finds
*Toggle sidebar*. <kbd>Ctrl</kbd>+<kbd>K</kbd> opens it too, except while the editor has
focus — there it inserts a link instead.

## Files

- Click a folder to select it; new files and folders are created inside the selection.
- **Drag and drop** to reorganise. Drop a node on the empty space below the tree to move
  it to the top level. Dropping a folder into its own subtree is refused.
- Hover a row for rename, duplicate and delete. <kbd>F2</kbd> renames, <kbd>Del</kbd>
  deletes, arrow keys expand and collapse.
- Duplicate names are resolved automatically: a second `notes.md` becomes `notes (2).md`.
- The filter box at the top narrows the tree and keeps parent folders visible.

## Writing

The formatting toolbar covers headings, bold, italic, strikethrough, inline code, code
blocks, lists, task lists, quotes, links, images, tables and horizontal rules. Every
button has a keyboard equivalent — press <kbd>Ctrl</kbd>+<kbd>/</kbd> for the full list.

Behaviours worth knowing:

- Formatting **toggles**: pressing <kbd>Ctrl</kbd>+<kbd>B</kbd> on already-bold text removes it.
- <kbd>Enter</kbd> continues the list or quote you are in, renumbering ordered lists.
  Pressing it on an empty item outdents, then leaves the list.
- <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> indents and outdents every selected line.
- Typing a bracket or quote with text selected **wraps** the selection instead of replacing it.
- Pasting a URL over selected text turns it into a link. Pasting or dropping an image
  embeds it. Dropping a `.md` file inserts its text.
- <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates lines, <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>
  moves them, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> deletes them.
- Undo groups a burst of typing into one step rather than one step per keystroke.

## Find and replace

<kbd>Ctrl</kbd>+<kbd>F</kbd> finds, <kbd>Ctrl</kbd>+<kbd>H</kbd> adds replace. Toggle
**Aa** for case sensitivity, **ab** for whole words and **.\*** for regular expressions.
<kbd>Enter</kbd> steps forward, <kbd>Shift</kbd>+<kbd>Enter</kbd> back. Anonymous
visitors can search; replacing needs admin.

## Preview

Renders GitHub-flavoured Markdown: tables, task lists, footnotes, strikethrough, KaTeX
maths (`$…$` and `$$…$$`), Mermaid diagrams in a ` ```mermaid ` fence, syntax-highlighted
code, and inline HTML (sanitised, so a shared document cannot inject scripts).

- **Scroll sync** keeps the panes on the same *source line*, not the same percentage, so
  they stay together across tall tables and diagrams. Toggle it with the link button.
- **Double-click** a block in the preview to put the caret on the line that produced it.
  Double-click in the editor to scroll the preview to the matching spot.
- **Tick a checkbox** in the preview and the `- [ ]` in the source flips with it.
- Hover a heading for its anchor link; hover a code block for a **Copy** button.
- A malformed diagram shows the parser's message and its source instead of failing silently.

## Import and export

The **File** menu handles both:

- **Import** reads `.md`, `.markdown` and `.txt` into a new file in the selected folder.
- **Export Markdown / HTML / PDF / PNG / JPG** — exports are named after the current file.
  The HTML export is self-contained, styles included, and opens offline.
- **Print** (<kbd>Ctrl</kbd>+<kbd>P</kbd>) uses a dedicated print stylesheet that drops the
  chrome and avoids breaking code blocks and tables across pages. For text-heavy documents
  it gives a better PDF than the image-based export.

## Backend storage

Off by default; everything is kept in this browser's local storage and the status bar
shows the last successful save. Enable **Sync → Backend sync** to use the FastAPI API
instead:

- **Load from backend** replaces the tree with the server's copy. Anyone can load.
- **Save to backend** pushes the tree up. This needs admin, because the API requires the
  `X-Admin-Key` header.
- Choose **JSON file** or **MySQL** to match `MARKDOWN_STORAGE_BACKEND` on the server.
- Failures are reported in plain language: unreachable API, rejected key, or timeout.

Point the frontend elsewhere with `VITE_MARKDOWN_API_URL`, and change the admin key with
`VITE_MARKDOWN_ADMIN_KEY` (it must match the server's `MARKDOWN_ADMIN_KEY`).

## Appearance

The theme follows your system by default. The moon/sun button pins light or dark;
*Theme: follow the system* in the command palette hands control back. Editor font size is
adjustable from the status bar, and line numbers and word wrap each have a toggle in the
editor's header.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Stuck in full screen | <kbd>Esc</kbd>, or **Exit full screen** in the status bar |
| Status bar says *Not saved* | Browser storage is full or blocked (private windows block it). Export your work |
| Nothing to preview | The file is empty, or the view mode is set to *Editor* |
| Copy button says *Blocked* | The clipboard needs a secure context; the text is selected for manual copying |
| Backend buttons greyed out | Enable **Sync → Backend sync** first; saving also needs admin |
