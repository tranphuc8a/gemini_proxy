/**
 * Run an algorithm and step through it.
 *
 * The canvas reads `algorithm.step` and highlights accordingly, so this panel
 * only picks the algorithm, chooses a start, and moves the cursor. Playback is
 * a timer that advances the same cursor — there is no separate "playing"
 * rendering path, which is what keeps scrubbing and playing in agreement.
 */

import { useEffect, useRef } from 'react'
import { useEditor } from '../store'
import { ALGORITHMS } from '../lib/algorithms'
import type { AlgorithmId } from '../lib/algorithms'
import './AlgorithmPanel.css'

interface AlgorithmPanelProps {
  open: boolean
  onClose: () => void
}

function AlgorithmPanel({ open, onClose }: AlgorithmPanelProps) {
  const document_ = useEditor((state) => state.document)
  const algorithm = useEditor((state) => state.algorithm)
  const run = useEditor((state) => state.runAlgorithm)
  const setStep = useEditor((state) => state.setAlgorithmStep)
  const setStart = useEditor((state) => state.setAlgorithmStart)
  const stop = useEditor((state) => state.stopAlgorithm)

  const playingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // The timer is cleared on unmount and whenever the run changes, so closing the
  // panel mid-playback cannot leave one ticking against a stale result.
  useEffect(() => {
    return () => {
      if (playingRef.current) clearInterval(playingRef.current)
    }
  }, [])

  if (!open) return null

  const result = algorithm.result
  const steps = result?.steps ?? []
  const current = steps[algorithm.step]

  const play = () => {
    if (playingRef.current) {
      clearInterval(playingRef.current)
      playingRef.current = null
      return
    }
    playingRef.current = setInterval(() => {
      const state = useEditor.getState()
      const total = state.algorithm.result?.steps.length ?? 0
      if (state.algorithm.step >= total - 1) {
        if (playingRef.current) clearInterval(playingRef.current)
        playingRef.current = null
        return
      }
      state.setAlgorithmStep(state.algorithm.step + 1)
    }, 700)
  }

  const spec = ALGORITHMS.find((item) => item.id === algorithm.id)

  return (
    <div className="algorithm-panel panel-card">
      <header className="row">
        <h3 className="grow">Chạy thuật toán</h3>
        <button
          className="btn btn-icon"
          onClick={() => {
            if (playingRef.current) {
              clearInterval(playingRef.current)
              playingRef.current = null
            }
            stop()
            onClose()
          }}
          aria-label="Đóng"
        >
          ✕
        </button>
      </header>

      <div className="field-inline">
        <div className="field grow">
          <label htmlFor="algorithm">Thuật toán</label>
          <select
            id="algorithm"
            value={algorithm.id ?? ''}
            onChange={(event) => run(event.target.value as AlgorithmId)}
          >
            <option value="" disabled>Chọn…</option>
            {ALGORITHMS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>

        {spec?.needsStart && (
          <div className="field">
            <label htmlFor="start-node">Đỉnh xuất phát</label>
            <select
              id="start-node"
              value={algorithm.startNode ?? ''}
              onChange={(event) => {
                setStart(event.target.value || null)
                if (algorithm.id) run(algorithm.id)
              }}
            >
              <option value="">(đỉnh đầu tiên)</option>
              {document_.nodes.map((node) => (
                <option key={node.id} value={node.id}>{node.label || node.id.slice(0, 6)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {spec && <p className="hint">{spec.note}</p>}

      {result && (
        <>
          <div className="row">
            <button className="btn btn-sm" onClick={() => setStep(0)} disabled={!steps.length}>⏮</button>
            <button className="btn btn-sm" onClick={() => setStep(algorithm.step - 1)} disabled={algorithm.step === 0}>◀</button>
            <button className="btn btn-sm btn-primary" onClick={play} disabled={steps.length < 2}>▶ Phát</button>
            <button className="btn btn-sm" onClick={() => setStep(algorithm.step + 1)} disabled={algorithm.step >= steps.length - 1}>▶</button>
            <button className="btn btn-sm" onClick={() => setStep(steps.length - 1)} disabled={!steps.length}>⏭</button>
            <span className="hint">{steps.length ? `${algorithm.step + 1} / ${steps.length}` : '—'}</span>
          </div>

          <input
            className="scrubber"
            type="range"
            min={0}
            max={Math.max(0, steps.length - 1)}
            value={algorithm.step}
            onChange={(event) => setStep(Number(event.target.value))}
          />

          {current && <p className="step-message">{current.message}</p>}
          {result.summary && <p className="summary">{result.summary}</p>}

          <details className="log">
            <summary>Nhật ký đầy đủ ({steps.length} bước)</summary>
            <ol>
              {steps.map((step, index) => (
                <li key={index} className={index === algorithm.step ? 'is-current' : undefined}>
                  <button onClick={() => setStep(index)}>{step.message}</button>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}

      {!result && <p className="hint">Chọn một thuật toán để bắt đầu. Canvas sẽ tô sáng theo từng bước.</p>}
    </div>
  )
}

export default AlgorithmPanel
