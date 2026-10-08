import type { Pane } from '../lib/responsive'
import { IconEye, IconPencil } from './Icons'

const PANES: { id: Pane; label: string; icon: React.ReactNode }[] = [
  { id: 'editor', label: 'Editor', icon: <IconPencil size={15} /> },
  { id: 'preview', label: 'Preview', icon: <IconEye size={15} /> }
]

interface PaneSwitchProps {
  active: Pane
  onChange: (pane: Pane) => void
}

/** A phone has room for one pane, so the split view becomes a two-way switch. */
function PaneSwitch({ active, onChange }: PaneSwitchProps) {
  return (
    <div className="pane-switch" role="group" aria-label="Visible pane">
      {PANES.map((pane) => (
        <button
          key={pane.id}
          type="button"
          className={`pane-switch-btn${active === pane.id ? ' is-active' : ''}`}
          aria-pressed={active === pane.id}
          onClick={() => onChange(pane.id)}
        >
          {pane.icon}
          {pane.label}
        </button>
      ))}
    </div>
  )
}

export default PaneSwitch
