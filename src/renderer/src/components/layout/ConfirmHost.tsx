import { useEffect, useRef, useState } from 'react'
import { registerConfirmHandler } from '../../lib/confirm'
import type { ConfirmOptions } from '../../lib/confirm'

interface Pending {
  opts: ConfirmOptions
  resolve: (ok: boolean) => void
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  pendingRef.current = pending

  useEffect(() => {
    registerConfirmHandler(
      (opts) =>
        new Promise<boolean>((resolve) => {
          // A new prompt replaces a stale one rather than stacking.
          pendingRef.current?.resolve(false)
          setPending({ opts, resolve })
        })
    )
    return () => registerConfirmHandler(null)
  }, [])

  useEffect(() => {
    if (!pending) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') answer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  function answer(ok: boolean) {
    pending?.resolve(ok)
    setPending(null)
  }

  if (!pending) return null
  const { opts } = pending
  return (
    <div
      className="modal-backdrop p-4 z-[70]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) answer(false) }}
    >
      <div className="modal max-w-sm p-5" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="font-display text-base font-semibold text-white">{opts.title}</h2>
        {opts.message && <p className="text-sm text-slate-400 mt-2 leading-relaxed">{opts.message}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => answer(false)} className="btn-ghost text-sm py-1.5" autoFocus>Cancel</button>
          <button
            onClick={() => answer(true)}
            className={opts.danger ? 'btn-danger text-sm py-1.5' : 'btn-primary text-sm py-1.5'}
          >
            {opts.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
