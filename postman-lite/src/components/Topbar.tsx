import { useStore } from '../store'
import type { SendMode } from '../types'
import { IconCloud, IconMoon, IconSettings, IconSidebar, IconSun } from './Icons'

interface TopbarProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenSettings: () => void
  onOpenWorkspace: () => void
  onOpenEnvironments: () => void
}

const SEND_MODE_HINT: Record<SendMode, string> = {
  auto: 'Auto: gửi thẳng, nếu bị CORS chặn thì tự chuyển qua proxy backend',
  direct: 'Direct: gửi thẳng từ trình duyệt — dính CORS và bị bỏ header Cookie',
  proxy: 'Proxy: backend gửi hộ — không dính CORS, gửi được mọi header',
}

export function Topbar({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSettings,
  onOpenWorkspace,
  onOpenEnvironments,
}: TopbarProps) {
  const environments = useStore((s) => s.environments)
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId)
  const setActiveEnvironment = useStore((s) => s.setActiveEnvironment)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const workspace = useStore((s) => s.workspace)
  const syncing = useStore((s) => s.syncing)
  const proxyAvailable = useStore((s) => s.proxyAvailable)
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen)

  const proxyNeeded = settings.sendMode !== 'direct'

  return (
    <header className="topbar">
      <button
        className="btn btn-ghost"
        onClick={onToggleSidebar}
        title="Ẩn/hiện sidebar (Ctrl+B)"
        aria-pressed={!sidebarCollapsed}
      >
        <IconSidebar />
      </button>

      <div className="brand">
        <span className="brand-mark">🛰️</span>
        <span className="brand-text">Postman Lite Pro</span>
      </div>

      <button className="btn btn-sm" onClick={() => setCommandPaletteOpen(true)} title="Command palette">
        <span className="faint">Ctrl</span>
        <span className="faint">K</span>
      </button>

      <div className="topbar-spacer" />

      {proxyNeeded && proxyAvailable === false ? (
        <span className="chip chip-danger" title="Bật backend FastAPI và đặt PROXY_ENABLED=true">
          proxy offline
        </span>
      ) : null}

      <select
        className="env-select"
        value={settings.sendMode}
        onChange={(e) => updateSettings({ sendMode: e.target.value as SendMode })}
        title={SEND_MODE_HINT[settings.sendMode]}
        aria-label="Chế độ gửi"
      >
        <option value="auto">Auto</option>
        <option value="direct">Direct</option>
        <option value="proxy">Proxy</option>
      </select>

      <select
        className="env-select"
        value={activeEnvironmentId ?? ''}
        onChange={(e) => setActiveEnvironment(e.target.value || null)}
        aria-label="Environment"
      >
        <option value="">Không environment</option>
        {environments.map((environment) => (
          <option key={environment.id} value={environment.id}>
            {environment.name}
          </option>
        ))}
      </select>

      <button className="btn btn-sm" onClick={onOpenEnvironments} title="Quản lý environments">
        Env
      </button>

      <button className="btn btn-sm" onClick={onOpenWorkspace} title="Đồng bộ workspace lên backend">
        <IconCloud />
        {syncing ? 'Đang đồng bộ…' : workspace ? workspace.name : 'Workspace'}
      </button>

      <button
        className="btn btn-ghost"
        onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        title={settings.theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      >
        {settings.theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>

      <button className="btn btn-ghost" onClick={onOpenSettings} title="Cài đặt">
        <IconSettings />
      </button>
    </header>
  )
}
