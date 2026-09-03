import { ipcMain } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'

interface ThreadRow {
  id: string
  text: string
  status: 'open' | 'resolved'
  linked_card_id: string | null
  linked_member_id: string | null
  created_at: string
  resolved_at: string | null
  sort_order: number
}

export function registerThreadHandlers(): void {
  // Open threads first (newest first within each), resolved ones trail at
  // the bottom — a DM scanning the board cares about what's still live.
  ipcMain.handle('threads:list', () => {
    return getDb()
      .prepare(`SELECT * FROM threads ORDER BY status ASC, created_at DESC`)
      .all() as ThreadRow[]
  })

  // The whole point of this handler is to be fast to call from the
  // floating quick-add widget — just text, everything else optional.
  ipcMain.handle(
    'threads:create',
    (_e, data: { text: string; linked_card_id?: string | null; linked_member_id?: string | null }) => {
      const db = getDb()
      const id = uuidv4()
      const now = new Date().toISOString()
      const count = (db.prepare('SELECT COUNT(*) as c FROM threads').get() as { c: number }).c
      db.prepare(
        `INSERT INTO threads (id, text, status, linked_card_id, linked_member_id, created_at, sort_order)
         VALUES (?, 'open', ?, ?, ?, ?, ?)`
      ).run(id, data.text.trim(), data.linked_card_id ?? null, data.linked_member_id ?? null, now, count)
      return db.prepare('SELECT * FROM threads WHERE id = ?').get(id) as ThreadRow
    }
  )

  ipcMain.handle('threads:update', (_e, id: string, changes: Record<string, unknown>) => {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM threads WHERE id = ?').get(id) as ThreadRow | undefined
    if (!existing) return null

    const text = 'text' in changes ? (changes.text as string) : existing.text
    const status = 'status' in changes ? (changes.status as 'open' | 'resolved') : existing.status
    const linkedCardId = 'linked_card_id' in changes ? (changes.linked_card_id as string | null) : existing.linked_card_id
    const linkedMemberId =
      'linked_member_id' in changes ? (changes.linked_member_id as string | null) : existing.linked_member_id
    // Resolving/reopening a thread stamps or clears resolved_at automatically
    // rather than trusting the caller to track it.
    const resolvedAt =
      status === 'resolved'
        ? existing.status === 'resolved'
          ? existing.resolved_at
          : new Date().toISOString()
        : null

    db.prepare(
      `UPDATE threads SET text=?, status=?, linked_card_id=?, linked_member_id=?, resolved_at=? WHERE id=?`
    ).run(text, status, linkedCardId, linkedMemberId, resolvedAt, id)

    return db.prepare('SELECT * FROM threads WHERE id = ?').get(id) as ThreadRow
  })

  ipcMain.handle('threads:delete', (_e, id: string) => {
    getDb().prepare('DELETE FROM threads WHERE id = ?').run(id)
  })
}
