import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerSearchHandlers(): void {
  ipcMain.handle('search:query', (_e, q: string) => {
    if (!q.trim()) return []
    const db = getDb()
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

      return rows.map(r => ({
        ...r,
        tags: JSON.parse(r.tags)
      }))
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
      return rows.map(r => ({ ...r, tags: JSON.parse(r.tags) }))
    }
  })
}
