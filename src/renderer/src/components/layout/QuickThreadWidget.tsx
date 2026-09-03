import { useState, useRef, useEffect } from 'react'
import { ListChecks, ArrowRight } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

// Sits next to the Settings button (bottom-left) — the opposite corner from
// the chat widget — so a plot hook or reminder can be jotted down from
// wherever the DM happens to be, without navigating to the Threads page and
// losing their place on the Map or in Encounter.
export function QuickThreadWidget() {
  const { setCurrentPage } = useUIStore()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [justAdded, setJustAdded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 50)
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function handleAdd() {
    if (!text.trim()) return
    await window.api.threads.create({ text: text.trim() })
    setText('')
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1500)
  }

  return (
    <div ref={ref} className="fixed bottom-4 left-16 z-40">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Quick note"
        className={`w-10 h-10 flex items-center justify-center rounded-full border shadow-lg transition-colors ${
          open ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-surface-raised border-border text-slate-400 hover:text-amber-300 hover:border-amber-500/40'
        }`}
      >
        <ListChecks size={16} />
      </button>

      {open && (
        <div className="absolute bottom-12 left-0 w-72 bg-surface-raised border border-border rounded-xl shadow-2xl p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium mb-2">Quick Thread</p>
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              className="input text-xs py-1.5"
              placeholder="Plot hook, promise, reminder..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={!text.trim()}
              className="btn-primary py-1.5 px-2.5 text-xs disabled:opacity-40 flex-shrink-0"
            >
              Add
            </button>
          </div>
          {justAdded && <p className="text-[11px] text-emerald-400 mt-1.5">Added to Threads.</p>}
          <button
            onClick={() => { setCurrentPage('threads'); setOpen(false) }}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors mt-2"
          >
            View all threads <ArrowRight size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
