/**
 * The SETUP menu: angle unit and display format.
 *
 * Small, but the angle unit is the single most common source of a wrong answer
 * on this machine — the indicator on the display is two characters wide and
 * nobody looks at it. Here the current choice is a filled button.
 */

import type { AngleMode } from '../engine/evaluate'
import { useStore, type DisplayFormat } from '../store'

const ANGLES: { id: AngleMode; label: string; hint: string }[] = [
  { id: 'deg', label: 'Độ (D)', hint: 'Một vòng = 360°' },
  { id: 'rad', label: 'Radian (R)', hint: 'Một vòng = 2π' },
  { id: 'gra', label: 'Grad (G)', hint: 'Một vòng = 400 grad' },
]

const FORMATS: { id: DisplayFormat; label: string; hint: string }[] = [
  { id: 'norm', label: 'Norm', hint: 'Tự chọn, 10 chữ số có nghĩa' },
  { id: 'fix', label: 'Fix', hint: 'Cố định số chữ số thập phân' },
  { id: 'sci', label: 'Sci', hint: 'Ký hiệu khoa học' },
]

export function SetupPanel({ onClose }: { onClose: () => void }) {
  const angle = useStore((state) => state.angle)
  const setAngle = useStore((state) => state.setAngle)
  const format = useStore((state) => state.format)
  const digits = useStore((state) => state.digits)
  const setFormat = useStore((state) => state.setFormat)

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="SETUP">
      <section className="panel panel-dialog">
        <header className="panel-head">
          <h2>SETUP</h2>
          <button type="button" className="button is-quiet" onClick={onClose}>Đóng</button>
        </header>

        <h3>Đơn vị góc</h3>
        <div className="chip-row">
          {ANGLES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip${angle === item.id ? ' is-active' : ''}`}
              onClick={() => setAngle(item.id)}
              title={item.hint}
            >
              {item.label}
            </button>
          ))}
        </div>

        <h3>Dạng hiển thị</h3>
        <div className="chip-row">
          {FORMATS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip${format === item.id ? ' is-active' : ''}`}
              onClick={() => setFormat(item.id)}
              title={item.hint}
            >
              {item.label}
            </button>
          ))}
        </div>

        {format !== 'norm' ? (
          <label className="panel-stack">
            {format === 'fix' ? 'Số chữ số thập phân' : 'Số chữ số có nghĩa'}
            <input
              type="range"
              min={format === 'fix' ? 0 : 1}
              max={9}
              value={digits}
              onChange={(event) => setFormat(format, Number(event.target.value))}
            />
            <output>{digits}</output>
          </label>
        ) : null}

        <p className="panel-note">
          Kết quả luôn được tính chính xác bằng số hữu tỉ; các thiết lập này chỉ đổi cách hiển thị.
        </p>
      </section>
    </div>
  )
}
