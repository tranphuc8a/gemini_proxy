import type { SyncState } from './engine'

export interface SyncDescription {
  label: string
  tone: 'ok' | 'busy' | 'warn' | 'error'
  title: string
}

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** "just now" · "5 min ago" · "3 h ago" · "2 d ago". */
export function ago(thenMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - thenMs) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

/** What the status bar says about the sync, in the order of what the person should look at first. */
export function describeSync(sync: SyncState, nowMs: number): SyncDescription {
  if (sync.conflicts.length) {
    return {
      label: `⚠ ${plural(sync.conflicts.length, 'conflict', 'conflicts')}`,
      tone: 'warn',
      title: 'The same lines changed on two devices. Click to choose which text to keep.'
    }
  }
  switch (sync.phase) {
    case 'reconcile':
      return { label: 'Waiting for your answer', tone: 'warn', title: 'This device and the server hold different documents. Answer the question to continue.' }
    case 'syncing':
      return { label: sync.pending ? `Syncing… (${sync.pending})` : 'Syncing…', tone: 'busy', title: 'Sending and receiving changes' }
    case 'offline':
      return {
        label: sync.pending ? `Offline — ${plural(sync.pending, 'change', 'changes')} queued` : 'Offline',
        tone: 'warn',
        title: sync.error ?? 'No connection. Changes are kept here and sent when it returns.'
      }
    case 'private':
      return { label: 'Unlock admin to sync', tone: 'warn', title: sync.error ?? "This server's documents are private." }
    case 'error':
      return { label: sync.pending ? `Sync problem — ${plural(sync.pending, 'change', 'changes')} waiting` : 'Sync problem', tone: 'error', title: `${sync.error ?? 'The sync failed'} — retrying` }
    case 'off':
      return { label: 'Sync starting…', tone: 'busy', title: 'Backend sync is on and starting' }
    case 'idle':
      break
  }
  if (sync.blocked.length) {
    return { label: `⚠ ${sync.blocked.length} refused`, tone: 'warn', title: 'The server refused some documents. Click for details.' }
  }
  if (sync.pending) return { label: plural(sync.pending, 'change waiting', 'changes waiting'), tone: 'busy', title: 'Will be sent in a moment' }
  if (sync.readOnly) {
    return { label: sync.lastSync ? `Up to date · ${ago(sync.lastSync, nowMs)}` : 'Receiving', tone: 'ok', title: 'View only: this device receives changes and sends none' }
  }
  return { label: sync.lastSync ? `Synced ${ago(sync.lastSync, nowMs)}` : 'Sync on', tone: 'ok', title: sync.lastSync ? new Date(sync.lastSync).toLocaleString() : 'Backend sync is on' }
}
