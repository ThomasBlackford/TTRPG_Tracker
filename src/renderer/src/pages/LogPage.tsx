import { useEffect, useMemo, useState } from 'react'
import { ScrollText, Copy, Trash2, CalendarPlus, ChevronDown, ChevronRight, Search, Swords } from 'lucide-react'
import type { LogEntry, LogKind } from '../types'
import { LOG_KINDS, clock, kindColor } from '../lib/logStyle'
import { confirmAsync } from '../lib/confirm'

interface Group {
  key: string
  combat: boolean
  title: string
  subtitle: string
  entries: LogEntry[]
}

function dayLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

// Fights are grouped by their own id; everything else by the day it happened.
function groupEntries(entries: LogEntry[]): Group[] {
  const map = new Map<string, Group>()
  const order: string[] = []
  for (const e of entries) {
    const key = e.group_id || `day:${new Date(e.at).toDateString()}`
    let g = map.get(key)
    if (!g) {
      const combat = !!e.group_id
      g = {
        key,
        combat,
        title: combat ? `Fight · ${new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : `Out of combat · ${dayLabel(e.at)}`,
        subtitle: combat ? dayLabel(e.at) : '',
        entries: []
      }
      map.set(key, g)
      order.push(key)
    }
    g.entries.push(e)
  }
  for (const g of map.values()) {
    if (!g.combat) continue
    const end = g.entries.find((e) => e.kind === 'combat' && /ended/i.test(e.text))
    const rounds = (end?.data as { rounds?: number } | null)?.rounds
    g.subtitle = `${g.subtitle}${rounds ? ` · ${rounds} round${rounds === 1 ? '' : 's'}` : end ? '' : ' · in progress'}`
  }
  return order.map((k) => map.get(k)!).reverse()
}

export function LogPage() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [hidden, setHidden] = useState<Set<LogKind>>(new Set(['turn']))
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  useEffect(() => {
    window.api.log.list({ limit: 3000 }).then(setEntries)
    return window.api.log.onAppend((e) => setEntries((list) => [...list, e]))
  }, [])

  function flash(text: string, error = false) {
    setStatus({ text, error })
    setTimeout(() => setStatus(null), 4000)
  }

  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () => entries.filter((e) => !hidden.has(e.kind) && (!q || e.text.toLowerCase().includes(q))),
    [entries, hidden, q]
  )
  const groups = useMemo(() => groupEntries(visible), [visible])

  function toggleKind(k: LogKind) {
    setHidden((h) => {
      const next = new Set(h)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function toggleGroup(key: string) {
    setCollapsed((c) => {
      const next = new Set(c)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function copy(g: Group) {
    const text = g.entries.map((e) => `[${clock(e.at)}] ${e.text}`).join('\n')
    await navigator.clipboard.writeText(`${g.title}\n${text}`)
    flash('Copied to the clipboard.')
  }

  async function toTimeline(g: Group) {
    const r = await window.api.log.toTimeline(g.key)
    flash(r.ok ? `Added "${r.title}" to the Timeline.` : r.error ?? 'Could not add it.', !r.ok)
  }

  async function clearAll() {
    if (!(await confirmAsync({ title: 'Clear the whole session log?', message: 'This cannot be undone.', confirmLabel: 'Clear log', danger: true }))) return
    await window.api.log.clear()
    setEntries([])
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-surface-raised flex-shrink-0 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <ScrollText size={18} className="text-amber-400" />
          <div>
            <h2 className="font-display text-xl text-white uppercase tracking-widest">Session Log</h2>
            <p className="text-slate-500 text-xs mt-0.5">Everything that happens at the table, recorded as it happens.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {status && <span className={`text-xs ${status.error ? 'text-red-400' : 'text-emerald-400'}`}>{status.text}</span>}
            <button onClick={clearAll} disabled={entries.length === 0} className="btn-ghost flex items-center gap-1.5 border !border-border !py-1.5 text-xs disabled:opacity-30">
              <Trash2 size={13} /> Clear
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-56">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input className="input text-xs pl-7" placeholder="Search the log…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1">
            {LOG_KINDS.map((k) => {
              const on = !hidden.has(k.kind)
              return (
                <button
                  key={k.kind}
                  onClick={() => toggleKind(k.kind)}
                  className={`px-2 py-1 text-[10px] uppercase tracking-wider border transition-colors ${on ? `${k.color} border-current bg-white/[0.03]` : 'text-slate-600 border-border hover:text-slate-300'}`}
                >
                  {k.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-5 space-y-4">
          {groups.length === 0 ? (
            <div className="text-center py-16">
              <ScrollText size={36} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">{entries.length === 0 ? 'Nothing logged yet.' : 'Nothing matches those filters.'}</p>
              <p className="text-xs text-slate-600 mt-1">Hits, rolls, conditions, turns and rewards are written here automatically.</p>
            </div>
          ) : (
            groups.map((g) => {
              const open = !collapsed.has(g.key)
              return (
                <div key={g.key} className="bg-surface-raised border border-border">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                    <button onClick={() => toggleGroup(g.key)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                      {open ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                      {g.combat && <Swords size={14} className="text-amber-400 flex-shrink-0" />}
                      <span className="text-sm text-slate-100 font-medium truncate">{g.title}</span>
                      <span className="text-xs text-slate-500 truncate">{g.subtitle}</span>
                      <span className="text-[10px] text-slate-600 ml-1">{g.entries.length} events</span>
                    </button>
                    <button onClick={() => copy(g)} className="p-1.5 text-slate-500 hover:text-white border border-border transition-colors" title="Copy as text"><Copy size={12} /></button>
                    {g.combat && (
                      <button onClick={() => toTimeline(g)} className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] uppercase tracking-wider text-slate-400 hover:text-white border border-border hover:border-amber-500/50 transition-colors" title="Write this fight's highlights onto the Timeline">
                        <CalendarPlus size={12} /> To Timeline
                      </button>
                    )}
                  </div>
                  {open && (
                    <div className="px-4 py-3 space-y-1">
                      {g.entries.map((e) => (
                        <p key={e.id} className="text-[13px] leading-snug flex gap-3">
                          <span className="text-slate-600 tabular-nums flex-shrink-0">{clock(e.at)}</span>
                          <span className={kindColor(e.kind)}>{e.text}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
