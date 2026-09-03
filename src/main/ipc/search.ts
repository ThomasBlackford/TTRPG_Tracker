import { ipcMain } from 'electron'
import { getDb } from '../db'

function searchCards(db: ReturnType<typeof getDb>, q: string) {
  const escaped = q.replace(/["*]/g, ' ').trim() + '*'
  try {
    const rows = db.prepare(`
      SELECT c.id, c.type, c.name, c.description, c.image_path, c.tags, c.is_public
      FROM cards_fts
      JOIN cards c ON c.rowid = cards_fts.rowid
      WHERE cards_fts MATCH ?
      ORDER BY rank
      LIMIT 30
    `).all(escaped) as Array<{
      id: string; type: string; name: string;
      description: string; image_path: string | null;
      tags: string; is_public: number
    }>
    return rows.map(r => ({ kind: 'card' as const, ...r, tags: JSON.parse(r.tags) }))
  } catch {
    // FTS syntax error — fall back to LIKE
    const like = `%${q}%`
    const rows = db.prepare(`
      SELECT id, type, name, description, image_path, tags, is_public
      FROM cards WHERE name LIKE ? OR description LIKE ?
      ORDER BY name LIMIT 30
    `).all(like, like) as Array<{
      id: string; type: string; name: string;
      description: string; image_path: string | null;
      tags: string; is_public: number
    }>
    return rows.map(r => ({ kind: 'card' as const, ...r, tags: JSON.parse(r.tags) }))
  }
}

// Session notes and threads are small in volume for any real campaign, so a
// plain LIKE scan is plenty — no need for the FTS machinery cards use.
function searchSessions(db: ReturnType<typeof getDb>, q: string) {
  const like = `%${q}%`
  const rows = db.prepare(`
    SELECT id, session_number, title, recap, prep_notes, session_date
    FROM session_notes
    WHERE title LIKE ? OR recap LIKE ? OR prep_notes LIKE ?
    ORDER BY session_date DESC LIMIT 15
  `).all(like, like, like) as Array<{
    id: string; session_number: number | null; title: string;
    recap: string; prep_notes: string; session_date: string
  }>
  return rows.map((r) => ({
    kind: 'session' as const,
    id: r.id,
    name: r.session_number != null ? `Session ${r.session_number}: ${r.title}` : r.title,
    description: (r.recap || r.prep_notes).slice(0, 140)
  }))
}

function searchThreads(db: ReturnType<typeof getDb>, q: string) {
  const like = `%${q}%`
  const rows = db.prepare(`
    SELECT id, text, status FROM threads WHERE text LIKE ? ORDER BY status ASC, created_at DESC LIMIT 15
  `).all(like) as Array<{ id: string; text: string; status: string }>
  return rows.map((r) => ({
    kind: 'thread' as const,
    id: r.id,
    name: r.text,
    description: r.status === 'resolved' ? 'Resolved' : 'Open thread'
  }))
}

export function registerSearchHandlers(): void {
  ipcMain.handle('search:query', (_e, q: string) => {
    if (!q.trim()) return []
    const db = getDb()
    return [...searchCards(db, q), ...searchSessions(db, q), ...searchThreads(db, q)]
  })
}
