import { useEditorStore } from '../store'
import { useReadingStore } from '../readingStore'
import { findNode } from '../lib/tree'
import ReadingSurface from './ReadingSurface'

/**
 * Distraction-free reading of the open document: the reading surface fed from the editor's store.
 *
 * It covers the app instead of replacing it, so leaving restores the previous view exactly -- scroll positions, caret
 * and all. Read-only by design: it works for anonymous visitors, and task boxes cannot be ticked from here. The
 * presentation itself (bar, contents, text settings, article) is ReadingSurface, which a read-only link's page shares.
 */
function ReadingView() {
  const content = useEditorStore((state) => state.currentContent)
  // A name, not the tree: the tree is replaced on every edit made anywhere.
  const fileName = useEditorStore((state) => findNode(state.files, state.currentFileId)?.name)
  const fileId = useEditorStore((state) => state.currentFileId)
  const closeReading = useReadingStore((state) => state.closeReading)

  return (
    <ReadingSurface
      content={content}
      title={fileName ? fileName.replace(/\.(md|markdown|txt)$/i, '') : undefined}
      documentKey={fileId}
      onClose={closeReading}
      ariaLabelPrefix="Reading mode: "
    />
  )
}

export default ReadingView
