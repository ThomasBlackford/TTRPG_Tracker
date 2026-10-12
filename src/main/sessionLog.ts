import { getDb } from './db'
import { getMainWin } from './mainWindow'

// An automatic record of what happened at the table: damage and who dealt it,
// conditions, rolls, turns, rewards. Written as things happen, read back on the
// Log page, and (for a fight) condensable into a Timeline entry.

export type LogKind =
  | 'combat' // encounter start / end / round
  | 'turn'
  | 'damage'
  | 'heal'
  | 'death' // dropped, stabilised, died, defeated
  | 'condition'
  | 'roll'
  | 'boss' // legendary actions/resistances, recharges, lair actions
  | 'reward' // XP, coins, items, loot
  | 'table' // notices, handouts, rests
  | 'player' // joined / left

export interface LogEntry {
  id: number
  at: number
  kind: LogKind
  text: string
  group_id: string
  data: unknown
}

interface Row {
  id: number
  at: number
  kind: string
  text: string
  group_id: string
  data: string
}

const MAX_ROWS = 20000

// Events during a fight carry that fight's id so it can be summarised on its
// own; everything else is grouped by day in the UI.
let currentGroup = ''

export function setLogGroup(id: string): void {
  currentGroup = id
}

export function getLogGroup(): string {
  return currentGroup
}

function toEntry(r: Row): LogEntry {
  let data: unknown = null
  try { data = r.data ? JSON.parse(r.data) : null } catch { /* leave null */ }
  return { id: r.id, at: r.at, kind: r.kind as LogKind, text: r.text, group_id: r.group_id, data }
}

export function logEvent(kind: LogKind, text: string, data?: unknown, at = Date.now()): LogEntry | null {
  try {
    const db = getDb()
    const info = db
      .prepare('INSERT INTO session_log (at, kind, text, group_id, data) VALUES (?,?,?,?,?)')
      .run(at, kind, text.slice(0, 400), currentGroup, data === undefined ? '' : JSON.stringify(data))
    const entry: LogEntry = { id: Number(info.lastInsertRowid), at, kind, text, group_id: currentGroup, data: data ?? null }
    if (entry.id % 500 === 0) {
      // Keep the table bounded without ever blocking the event that triggered it.
      db.prepare('DELETE FROM session_log WHERE id < ?').run(entry.id - MAX_ROWS)
    }
    const win = getMainWin()
    if (win && !win.isDestroyed()) win.webContents.send('log:append', entry)
    return entry
  } catch (e) {
    console.error('[sessionLog] could not record event:', e)
    return null
  }
}

export function listLog(opts: { limit?: number; groupId?: string; since?: number } = {}): LogEntry[] {
  const db = getDb()
  const limit = Math.max(1, Math.min(5000, Math.floor(opts.limit ?? 1000)))
  let rows: Row[]
  if (opts.groupId != null) {
    rows = db.prepare('SELECT * FROM session_log WHERE group_id = ? ORDER BY id DESC LIMIT ?').all(opts.groupId, limit) as Row[]
  } else if (opts.since != null) {
    rows = db.prepare('SELECT * FROM session_log WHERE at >= ? ORDER BY id DESC LIMIT ?').all(opts.since, limit) as Row[]
  } else {
    rows = db.prepare('SELECT * FROM session_log ORDER BY id DESC LIMIT ?').all(limit) as Row[]
  }
  return rows.reverse().map(toEntry)
}

export function clearLog(): void {
  getDb().prepare('DELETE FROM session_log').run()
}

function clock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Plain-text rendering of a run of entries — for copying out, or as the body
// of a Timeline event.
export function renderLog(entries: LogEntry[]): string {
  return entries.map((e) => `[${clock(e.at)}] ${e.text}`).join('\n')
}

// A short narrative of one fight: how long it lasted, who went down, the
// biggest hits. This is what lands on the Timeline.
export function summarizeFight(entries: LogEntry[]): { title: string; body: string } {
  const start = entries.find((e) => e.kind === 'combat' && /started/i.test(e.text))
  const end = [...entries].reverse().find((e) => e.kind === 'combat' && /ended/i.test(e.text))
  const rounds = (end?.data as { rounds?: number } | null)?.rounds
  const downs = entries.filter((e) => e.kind === 'death').map((e) => e.text)
  const hits = entries
    .filter((e) => e.kind === 'damage')
    .map((e) => ({ e, amount: (e.data as { amount?: number } | null)?.amount ?? 0 }))
    .filter((h) => h.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
  const lines: string[] = []
  if (start) lines.push(`Fight began ${new Date(start.at).toLocaleString()}${rounds ? `, lasted ${rounds} round${rounds === 1 ? '' : 's'}` : ''}.`)
  if (downs.length) lines.push('', 'Casualties and close calls:', ...downs.map((t) => `- ${t}`))
  if (hits.length) lines.push('', 'Biggest hits:', ...hits.map((h) => `- ${h.e.text}`))
  const rewards = entries.filter((e) => e.kind === 'reward').map((e) => e.text)
  if (rewards.length) lines.push('', 'Rewards:', ...rewards.map((t) => `- ${t}`))
  const name = (start?.data as { title?: string } | null)?.title
  return { title: name ? `Combat: ${name}` : 'Combat', body: lines.join('\n') || 'No notable events recorded.' }
}
