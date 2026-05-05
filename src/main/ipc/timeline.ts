import { ipcMain } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'

interface EventRow {
  id: string
  title: string
  description: string
  day_number: number | null
  date_display: string
  linked_cards: string
  created_at: string
  updated_at: string
}

function rowToEvent(row: EventRow) {
  return {
    ...row,
    day_number: row.day_number ?? null,
    linked_cards: JSON.parse(row.linked_cards || '[]') as string[],
  }
}

export function registerTimelineHandlers(): void {
  ipcMain.handle('timeline:list', () => {
    const rows = getDb()
      .prepare('SELECT * FROM timeline_events ORDER BY day_number ASC NULLS LAST, created_at ASC')
      .all() as EventRow[]
    return rows.map(rowToEvent)
  })

  ipcMain.handle('timeline:save', (_e, event: Record<string, unknown>) => {
    const db = getDb()
    const now = new Date().toISOString()
    const id = (event.id as string) || uuidv4()
    const existing = db.prepare('SELECT id FROM timeline_events WHERE id = ?').get(id)
    const linked = JSON.stringify(Array.isArray(event.linked_cards) ? event.linked_cards : [])
    const dayNum = event.day_number != null ? Number(event.day_number) || null : null

    if (existing) {
      db.prepare(`
        UPDATE timeline_events
        SET title=?, description=?, day_number=?, date_display=?, linked_cards=?, updated_at=?
        WHERE id=?
      `).run(
        event.title, event.description ?? '', dayNum,
        event.date_display ?? '', linked, now, id
      )
    } else {
      db.prepare(`
        INSERT INTO timeline_events (id, title, description, day_number, date_display, linked_cards, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(id, event.title, event.description ?? '', dayNum, event.date_display ?? '', linked, now, now)
    }

    return rowToEvent(db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(id) as EventRow)
  })

  ipcMain.handle('timeline:delete', (_e, id: string) => {
    getDb().prepare('DELETE FROM timeline_events WHERE id = ?').run(id)
  })
}
