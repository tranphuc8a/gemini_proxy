/**
 * Where the editor's current selection can be read from.
 *
 * The textarea lives in EditorPane; things that open from elsewhere (the header, the
 * command palette, the toolbar) need its selection without owning the element. The
 * pane registers a reader while it is mounted. A textarea keeps its selection while
 * unfocused, so the reader is right even after the click that opened a dialog.
 */
export interface EditorSelectionRange {
  start: number
  end: number
}

type Reader = () => EditorSelectionRange | null

let reader: Reader | null = null

/** Registers `next` as the reader; returns the function that unregisters it. */
export function registerEditorSelection(next: Reader): () => void {
  reader = next
  return () => {
    if (reader === next) reader = null
  }
}

/** The editor's selection now, or null when no editor is mounted (preview only, reading mode). */
export function readEditorSelection(): EditorSelectionRange | null {
  return reader ? reader() : null
}
