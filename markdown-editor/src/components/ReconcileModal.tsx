import { useRef, useState } from 'react'
import { useEditorStore } from '../store'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { ReconcilePlan } from '../sync/engine'
import { IconCloud } from './Icons'
import './Sync.css'

type DifferChoice = 'both' | 'server' | 'local'

const SHOWN = 6

function Names({ items }: { items: { id: string; name: string }[] }) {
  return (
    <ul className="reconcile-names">
      {items.slice(0, SHOWN).map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
      {items.length > SHOWN && <li>…and {items.length - SHOWN} more</li>}
    </ul>
  )
}

function Question({ plan }: { plan: ReconcilePlan }) {
  const resolveReconcile = useEditorStore((state) => state.resolveReconcile)
  const [differ, setDiffer] = useState<DifferChoice>('both')
  const [deleteServerOnly, setDeleteServerOnly] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, true)

  return (
    <div className="overlay">
      <div ref={panelRef} className="panel sync-panel" role="dialog" aria-modal="true" aria-labelledby="reconcile-title" tabIndex={-1}>
        <div className="sync-head">
          <span className="sync-icon">
            <IconCloud size={18} />
          </span>
          <div>
            <h2 id="reconcile-title">{plan.reason === 'reset' ? 'Sync again with the server' : 'First sync with this server'}</h2>
            <p>This device and the server do not hold the same documents. Choose what to keep; a document that was deleted on the server is removed here too, and you are told which.</p>
          </div>
        </div>

        <div className="sync-body">
          {plan.same > 0 && <p className="sync-note">{plan.same} document{plan.same === 1 ? ' is' : 's are'} the same on both.</p>}

          {plan.uploads.length > 0 && (
            <section aria-label="Only on this device">
              <h3>{plan.uploads.length} only on this device — they will be sent to the server</h3>
              <Names items={plan.uploads} />
            </section>
          )}

          {plan.downloads.length > 0 && (
            <section aria-label="Only on the server">
              <h3>{plan.downloads.length} only on the server — they will be brought here</h3>
              <Names items={plan.downloads} />
              {plan.reason === 'reset' && (
                <label className="reconcile-check">
                  <input type="checkbox" checked={deleteServerOnly} onChange={(event) => setDeleteServerOnly(event.target.checked)} />
                  Delete these from the server instead (this device deleted them earlier)
                </label>
              )}
            </section>
          )}

          {plan.differ.length > 0 && (
            <section aria-label="Different on both">
              <h3>{plan.differ.length} differ, with no common version to compare</h3>
              <Names items={plan.differ} />
              <div className="reconcile-choices" role="radiogroup" aria-label="What to do with the documents that differ">
                <label>
                  <input type="radio" name="reconcile-differ" checked={differ === 'both'} onChange={() => setDiffer('both')} />
                  <span>
                    Keep both <small>The server&apos;s keeps its name; yours becomes “name (this device).md”.</small>
                  </span>
                </label>
                <label>
                  <input type="radio" name="reconcile-differ" checked={differ === 'server'} onChange={() => setDiffer('server')} />
                  <span>
                    Prefer the server&apos;s <small>This device&apos;s texts of those documents are discarded.</small>
                  </span>
                </label>
                <label>
                  <input type="radio" name="reconcile-differ" checked={differ === 'local'} onChange={() => setDiffer('local')} />
                  <span>
                    Prefer this device&apos;s <small>The server keeps its earlier text in its version history.</small>
                  </span>
                </label>
              </div>
            </section>
          )}
        </div>

        <div className="sync-footer">
          <button type="button" className="btn btn-outline" onClick={() => resolveReconcile('cancel')}>
            Cancel (switch sync off)
          </button>
          <button type="button" className="btn btn-primary" onClick={() => resolveReconcile({ differ, deleteServerOnly })}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

/** The first meeting with a server (md-sync F7): shown only when there is something to decide. */
function ReconcileModal() {
  const plan = useEditorStore((state) => state.sync.reconcile)
  if (!plan) return null
  // Keyed by the plan so a second question starts from the defaults.
  return <Question key={`${plan.reason}:${plan.differ.length}:${plan.downloads.length}`} plan={plan} />
}

export default ReconcileModal
