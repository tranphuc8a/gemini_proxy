import { useState } from 'react'

import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog'

/**
 * Promise-based confirmation: `const [confirm, dialog] = useConfirm()`, then
 * `await confirm({...})` and render `{dialog}`.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, JSX.Element | null] {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null)

  const confirm = (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ options, resolve }))

  const dialog = pending ? (
    <ConfirmDialog
      {...pending.options}
      onConfirm={() => {
        pending.resolve(true)
        setPending(null)
      }}
      onCancel={() => {
        pending.resolve(false)
        setPending(null)
      }}
    />
  ) : null

  return [confirm, dialog]
}
