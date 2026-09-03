import { ipcMain } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'

interface SessionRow {
  id: string
  session_number: number | null
  title: string
  content: string
  recap: string
  prep_notes: string
  linked_cards: string
  linked_party_members: string
  session_date: string
  created_at: string
}

function rowToSession(row: SessionRow) {
  return {
    ...row,
    linked_cards: JSON.parse(row.linked_cards),
    linked_party_members: JSON.parse(row.linked_party_members)
  }
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
    const existing = db.prepare('SELECT * FROM session_notes WHERE id = ?').get(id) as SessionRow | undefined
    const linkedCards = JSON.stringify(Array.isArray(note.linked_cards) ? note.linked_cards : [])
    const linkedMembers = JSON.stringify(Array.isArray(note.linked_party_members) ? note.linked_party_members : [])
    const sessionDate = (note.session_date as string) || now.split('T')[0]
    const recap = 'recap' in note ? (note.recap as string) : existing?.recap ?? ''
    const prepNotes = 'prep_notes' in note ? (note.prep_notes as string) : existing?.prep_notes ?? ''

    if (existing) {
      db.prepare(`
        UPDATE session_notes SET session_number=?, title=?, recap=?, prep_notes=?, linked_cards=?, linked_party_members=?, session_date=?
        WHERE id=?
      `).run(note.session_number ?? null, note.title, recap, prepNotes, linkedCards, linkedMembers, sessionDate, id)
    } else {
      db.prepare(`
        INSERT INTO session_notes (id, session_number, title, recap, prep_notes, linked_cards, linked_party_members, session_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, note.session_number ?? null, note.title, recap, prepNotes, linkedCards, linkedMembers, sessionDate, now)
    }

    return rowToSession(db.prepare('SELECT * FROM session_notes WHERE id = ?').get(id) as SessionRow)
  })

  ipcMain.handle('sessions:delete', (_e, id: string) => {
    getDb().prepare('DELETE FROM session_notes WHERE id = ?').run(id)
  })
}
