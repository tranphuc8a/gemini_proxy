import { useEditorStore } from '../store'
import { findNode } from '../lib/tree'
import { exportMarkdown } from '../lib/exporters'
import './StorageBanner.css'

/**
 * Red, unmissable, and only while it is true: the browser refused the last
 * save because its storage quota is full.
 *
 * "Not saved" in the status bar undersold this. The copy kept in the browser is
 * the one from before the limit was reached, so a reload brings that back and
 * silently drops every edit made since. The banner says so plainly, offers the
 * way out (export the document), and goes away by itself once a save works.
 */
function StorageBanner() {
  const failure = useEditorStore((state) => state.storageFailure)
  const scope = useEditorStore((state) => state.storageFailureScope)
  const flushPersist = useEditorStore((state) => state.flushPersist)

  if (failure !== 'quota') return null

  const exportCurrent = () => {
    const { files, currentFileId, currentContent } = useEditorStore.getState()
    exportMarkdown(findNode(files, currentFileId)?.name ?? 'document.md', currentContent)
  }

  // The documents went in and only the settings (theme, layout) did not: nothing written is at risk.
  if (scope === 'settings') {
    return (
      <div className="storage-banner" role="alert">
        <p className="storage-banner-text">
          <strong>Browser storage is full — your settings are not saved.</strong> Your documents are. Delete large files you
          no longer need, then save again.
        </p>
        <div className="storage-banner-actions">
          <button type="button" className="btn storage-banner-btn" onClick={flushPersist}>
            Try saving again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="storage-banner" role="alert">
      <p className="storage-banner-text">
        <strong>Browser storage is full — your latest changes are not saved.</strong> Reloading or closing this tab now
        brings back an older copy of every document changed since. Export the open document (and any other you changed),
        or delete large files you no longer need, then save again.
      </p>
      <div className="storage-banner-actions">
        <button type="button" className="btn storage-banner-btn" onClick={exportCurrent}>
          Export open document
        </button>
        <button type="button" className="btn storage-banner-btn" onClick={flushPersist}>
          Try saving again
        </button>
      </div>
    </div>
  )
}

export default StorageBanner
