import { ipcMain } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'

interface SessionRow {
  id: string
  session_number: number | null
  title: string
  content: string
  linked_cards: string
  session_date: string
  created_at: string
}

function rowToSession(row: SessionRow) {
  return { ...row, linked_cards: JSON.parse(row.linked_cards) }
}

export function registerSessionHandlers(): void {
  ipcMain.handle('sessions:list', () => {
    const rows = getDb()
      .prepare('SELECT * FROM session_notes ORDER BY session_date DESC, created_at DESC')
      .all() as SessionRow[]
    return rows.map(rowToSession)
  })

  ipcMain.handle('sessions:get', (_e, id: string) => {
    const row = getDb().prepare('SELECT * FROM session_notes WHERE id = ?').get(id) as SessionRow | undefined
    return row ? rowToSession(row) : null
  })

  ipcMain.handle('sessions:save', (_e, note: Record<string, unknown>) => {
    const db = getDb()
    const id = (note.id as string) || uuidv4()
    const now = new Date().toISOString()
    const existing = db.prepare('SELECT id FROM session_notes WHERE id = ?').get(id)
    const linkedCards = JSON.stringify(Array.isArray(note.linked_cards) ? note.linked_cards : [])
    const sessionDate = (note.session_date as string) || now.split('T')[0]

    if (existing) {
      db.prepare(`
        UPDATE session_notes SET session_number=?, title=?, content=?, linked_cards=?, session_date=?
        WHERE id=?
      `).run(note.session_number ?? null, note.title, note.content ?? '', linkedCards, sessionDate, id)
    } else {
      db.prepare(`
        INSERT INTO session_notes (id, session_number, title, content, linked_cards, session_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, note.session_number ?? null, note.title, note.content ?? '', linkedCards, sessionDate, now)
    }

    return rowToSession(db.prepare('SELECT * FROM session_notes WHERE id = ?').get(id) as SessionRow)
  })

  ipcMain.handle('sessions:delete', (_e, id: string) => {
    getDb().prepare('DELETE FROM session_notes WHERE id = ?').run(id)
  })
}
