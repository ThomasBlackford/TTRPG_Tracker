import { ipcMain, app } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { join, basename } from 'path'

interface CardRow {
  id: string
  type: string
  name: string
  description: string
  image_path: string | null
  tags: string
  fields: string
  is_public: number
  created_at: string
  updated_at: string
}

function rowToCard(row: CardRow) {
  return {
    ...row,
    tags: JSON.parse(row.tags),
    fields: JSON.parse(row.fields)
  }
}

export function registerCardHandlers(): void {
  ipcMain.handle('cards:list', (_e, filter?: { type?: string }) => {
    const db = getDb()
    let query = 'SELECT * FROM cards'
    const params: string[] = []
    if (filter?.type && filter.type !== 'all') {
      query += ' WHERE type = ?'
      params.push(filter.type)
    }
    query += ' ORDER BY updated_at DESC'
    const rows = db.prepare(query).all(...params) as CardRow[]
    return rows.map(rowToCard)
  })

  ipcMain.handle('cards:get', (_e, id: string) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined
    return row ? rowToCard(row) : null
  })

  ipcMain.handle('cards:save', (_e, card: Record<string, unknown>) => {
    const db = getDb()
    const now = new Date().toISOString()
    const id = (card.id as string) || uuidv4()
    const existing = db.prepare('SELECT id FROM cards WHERE id = ?').get(id)

    const tags = JSON.stringify(Array.isArray(card.tags) ? card.tags : [])
    const fields = JSON.stringify(typeof card.fields === 'object' && card.fields ? card.fields : {})

    if (existing) {
      db.prepare(`
        UPDATE cards SET name=?, type=?, description=?, image_path=?, tags=?, fields=?, is_public=?, updated_at=?
        WHERE id=?
      `).run(
        card.name, card.type, card.description ?? '', card.image_path ?? null,
        tags, fields, card.is_public ? 1 : 0, now, id
      )
    } else {
      db.prepare(`
        INSERT INTO cards (id, name, type, description, image_path, tags, fields, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, card.name, card.type, card.description ?? '', card.image_path ?? null,
        tags, fields, card.is_public ? 1 : 0, now, now
      )
    }

    return rowToCard(db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow)
  })

  ipcMain.handle('cards:delete', (_e, id: string) => {
    getDb().prepare('DELETE FROM cards WHERE id = ?').run(id)
  })

  ipcMain.handle('dialog:openImage', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      title: 'Choose Image',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null

    const src = result.filePaths[0]
    const imagesDir = join(app.getPath('userData'), 'images')
    if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })

    const dest = join(imagesDir, `${uuidv4()}_${basename(src)}`)
    copyFileSync(src, dest)
    return dest
  })
}
