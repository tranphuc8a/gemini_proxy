import { useCallback, useState } from 'react'

import { ConfirmDialog, type ConfirmRequest } from './ConfirmDialog'

type Pending = ConfirmRequest & { resolve: (ok: boolean) => void }

/**
 * `await confirm({...})` instead of `window.confirm`, so a destructive action
 * can demand that the user types the name of what they are about to destroy.
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [typed, setTyped] = useState('')

  const confirm = useCallback(
    (request: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        setTyped('')
        setPending({ ...request, resolve })
      }),
    [],
  )

  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok)
      setPending(null)
      setTyped('')
    },
    [pending],
  )

  const dialog = pending ? (
    <ConfirmDialog
      {...pending}
      typed={typed}
      onTyped={setTyped}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null

  return { confirm, dialog }
}
