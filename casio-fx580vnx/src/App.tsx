/**
 * The whole calculator: the machine on the left, the workspace on the right.
 *
 * A physical fx-580VN X has to fit everything through a two-line screen, so it
 * hides matrices, statistics and equations behind mode menus you navigate
 * blind. Here the keypad keeps its shape — muscle memory is the point of
 * simulating it — and the mode's workspace sits beside it instead of behind it.
 */

import { useState } from 'react'

import { Display } from './components/Display'
import { HistoryPanel } from './components/HistoryPanel'
import { Keypad } from './components/Keypad'
import { MemoryPanel } from './components/MemoryPanel'
import { SetupPanel } from './components/SetupPanel'
import { BasePanel } from './components/panels/BasePanel'
import { EquationPanel } from './components/panels/EquationPanel'
import { MatrixPanel } from './components/panels/MatrixPanel'
import { SolvePanel } from './components/panels/SolvePanel'
import { StatPanel } from './components/panels/StatPanel'
import { TablePanel } from './components/panels/TablePanel'
import type { KeyAction } from './keypad'
import { useStore, type Mode } from './store'
import './styles/app.css'

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'comp', label: 'COMP', hint: 'Tính toán thông thường' },
  { id: 'complex', label: 'CMPLX', hint: 'Số phức' },
  { id: 'base', label: 'BASE-N', hint: 'Đổi hệ cơ số' },
  { id: 'matrix', label: 'MATRIX', hint: 'Ma trận' },
  { id: 'stat', label: 'STAT', hint: 'Thống kê' },
  { id: 'table', label: 'TABLE', hint: 'Bảng giá trị' },
  { id: 'equation', label: 'EQN', hint: 'Giải phương trình' },
]

export default function App() {
  const mode = useStore((state) => state.mode)
  const setMode = useStore((state) => state.setMode)
  const clearAll = useStore((state) => state.clearAll)
  const press = useStore((state) => state.press)
  const execute = useStore((state) => state.execute)

  const memoryAdd = useStore((state) => state.memoryAdd)

  const [dialog, setDialog] = useState<'setup' | 'calc' | 'solve' | 'memory' | null>(null)

  function onAction(action: KeyAction) {
    switch (action) {
      case 'setup':
        setDialog('setup')
        break
      case 'calc':
        setDialog('calc')
        break
      case 'solve':
        setDialog('solve')
        break
      case 'sto':
        // STO is written `→` on the entry line: `5→A`.
        press('→')
        break
      case 'rcl':
        setDialog('memory')
        break
      case 'sd':
        // S⇔D cycles the answer that is showing; the display owns that
        // button, so the key just re-runs the entry to bring an answer back.
        execute()
        break
      case 'mplus':
        memoryAdd(1)
        break
      case 'mminus':
        memoryAdd(-1)
        break
      case 'off':
        clearAll()
        break
      default:
        break
    }
  }

  return (
    <div className="app">
      <header className="app-head">
        <div className="app-title">
          <h1>CASIO fx-580VN X</h1>
          <p>Bản mô phỏng máy tính khoa học — tính toán chính xác bằng số hữu tỉ</p>
        </div>
        <nav className="mode-bar" aria-label="Chế độ">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mode${mode === item.id ? ' is-active' : ''}`}
              onClick={() => setMode(item.id)}
              title={item.hint}
              aria-pressed={mode === item.id}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-body">
        <div className="machine">
          <Display />
          <Keypad onAction={onAction} />
        </div>

        <div className="workspace">
          <Workspace mode={mode} />
        </div>
      </main>

      {dialog === 'setup' ? <SetupPanel onClose={() => setDialog(null)} /> : null}
      {dialog === 'memory' ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="RCL">
          <div className="panel-dialog">
            <MemoryPanel />
            <div className="panel-actions">
              <button type="button" className="button" onClick={() => setDialog(null)}>Đóng</button>
            </div>
          </div>
        </div>
      ) : null}
      {dialog === 'calc' || dialog === 'solve' ? (
        <SolvePanel intent={dialog} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  )
}

function Workspace({ mode }: { mode: Mode }) {
  switch (mode) {
    case 'matrix':
    case 'vector':
      return <MatrixPanel />
    case 'stat':
      return <StatPanel />
    case 'table':
      return <TablePanel />
    case 'equation':
      return <EquationPanel />
    case 'base':
      return <BasePanel />
    case 'complex':
      return (
        <>
          <ComplexHelp />
          <HistoryPanel />
        </>
      )
    default:
      return (
        <>
          <HistoryPanel />
          <MemoryPanel />
        </>
      )
  }
}

function ComplexHelp() {
  const press = useStore((state) => state.press)
  const examples = [
    { text: '(1+2i)×(3-4i)', hint: 'Nhân hai số phức' },
    { text: 'Abs(3+4i)', hint: 'Mô-đun' },
    { text: 'Arg(1+i)', hint: 'Acgumen (theo đơn vị góc hiện tại)' },
    { text: 'Conjg(3+4i)', hint: 'Số phức liên hợp' },
    { text: '2∠60', hint: 'Nhập dạng lượng giác r∠θ' },
  ]

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Số phức</h2>
        <p>Gõ <code>i</code> bằng phím ALPHA hoặc bàn phím. Kết quả hiển thị dạng đại số, bấm vào để xem dạng lượng giác.</p>
      </header>
      <ul className="example-list">
        {examples.map((example) => (
          <li key={example.text}>
            <button type="button" onClick={() => press(example.text)}>
              <code>{example.text}</code>
              <span>{example.hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
