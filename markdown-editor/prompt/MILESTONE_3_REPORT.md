# Milestone 3 Update

## Implemented

- Reorganized toolbar with view controls, sidebar toggle, fullscreen, import/export, backend storage, and preview export actions.
- Fixed nested file and folder creation by creating nodes inside the selected folder.
- Added copy and move actions for files and folders. Select a destination folder, then use the node action.
- Upgraded Mermaid to `11.17.2` and re-render diagrams after content changes and pane resize.
- Added Editor, Both, and Preview modes.
- Added collapsible sidebar and fullscreen workspace mode.
- Added bidirectional scroll synchronization.
- Added preview double-click focus behavior for the editor.
- Added syntax-highlighted language code blocks and Copy buttons.
- Added rendered preview export to PDF, PNG, and JPG.
- Added responsive toolbar wrapping and mobile split layout support.

## Validation

- `npm run type-check`: passed.
- `npm run build`: should be run after dependency installation to validate the production bundle.

## Backend Storage Note

The existing milestone 2 backend storage API remains available. JSON/MySQL selection is configured in the frontend and passed as the `backend` query parameter. MySQL requires the existing database configuration and the `markdown_files` table.
