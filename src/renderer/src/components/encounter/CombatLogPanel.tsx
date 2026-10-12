import { useEffect, useRef, useState } from 'react'
import { ScrollText } from 'lucide-react'
import type { LogEntry } from '../../types'
import { clock, kindColor } from '../../lib/logStyle'

// The last few things that happened, live — the full history is on the Log page.
export function CombatLogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.log.list({ limit: 40 }).then(setEntries)
    return window.api.log.onAppend((e) => setEntries((list) => [...list, e].slice(-60)))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [entries])

  return (
    <div className="mt-6 pt-4 border-t border-border">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-2">
        <ScrollText size={11} /> Combat log
      </p>
      <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
        {entries.length === 0 ? (
          <p className="text-[11px] text-slate-600">Nothing yet — hits, rolls and turns appear here as they happen.</p>
        ) : (
          entries.map((e) => (
            <p key={e.id} className="text-[11px] leading-snug">
              <span className="text-slate-600 mr-1.5">{clock(e.at)}</span>
              <span className={kindColor(e.kind)}>{e.text}</span>
            </p>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
