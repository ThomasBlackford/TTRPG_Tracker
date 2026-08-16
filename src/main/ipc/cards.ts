import { ipcMain, app } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'
import { copyFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join, basename, resolve, sep } from 'path'

function getImagesDir(): string {
  return join(app.getPath('userData'), 'images')
}

// Best-effort cleanup of a card image copied into our own images dir.
// Never throws — a failed cleanup should never block a save/delete.
function safeDeleteImage(imagePath: string | null | undefined): void {
  if (!imagePath) return
  try {
    const dir = resolve(getImagesDir()) + sep
    const resolved = resolve(imagePath)
    if (!resolved.startsWith(dir)) return // only ever touch our own managed copies
    if (existsSync(resolved)) unlinkSync(resolved)
  } catch {
    // ignore — orphaned file is a minor cost, a crash on delete is not
  }
}

interface CardRow {
  id: string
  type: string
  name: string
  description: string
  image_path: string | null
  tags: string
  fields: string
  is_public: number
  linked_cards: string
  parent_id: string | null
  dm_notes: string
  created_at: string
  updated_at: string
}

function rowToCard(row: CardRow) {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    fields: JSON.parse(row.fields || '{}'),
    linked_cards: JSON.parse(row.linked_cards || '[]'),
    parent_id: row.parent_id ?? null,
    dm_notes: row.dm_notes ?? '',
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
    const existing = db.prepare('SELECT id, image_path FROM cards WHERE id = ?').get(id) as
      { id: string; image_path: string | null } | undefined

    const tags = JSON.stringify(Array.isArray(card.tags) ? card.tags : [])
    const fields = JSON.stringify(typeof card.fields === 'object' && card.fields ? card.fields : {})
    const linked = JSON.stringify(Array.isArray(card.linked_cards) ? card.linked_cards : [])
    const parentId = (card.parent_id as string | null) ?? null
    const dmNotes = (card.dm_notes as string) ?? ''
    const newImagePath = (card.image_path as string | null) ?? null

    if (existing) {
      db.prepare(`
        UPDATE cards SET name=?, type=?, description=?, image_path=?, tags=?, fields=?, is_public=?,
          linked_cards=?, parent_id=?, dm_notes=?, updated_at=?
        WHERE id=?
      `).run(
        card.name, card.type, card.description ?? '', newImagePath,
        tags, fields, card.is_public ? 1 : 0,
        linked, parentId, dmNotes, now, id
      )
      if (existing.image_path && existing.image_path !== newImagePath) {
        safeDeleteImage(existing.image_path)
      }
    } else {
      db.prepare(`
        INSERT INTO cards (id, name, type, description, image_path, tags, fields, is_public,
          linked_cards, parent_id, dm_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, card.name, card.type, card.description ?? '', card.image_path ?? null,
        tags, fields, card.is_public ? 1 : 0,
        linked, parentId, dmNotes, now, now
      )
    }

    return rowToCard(db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow)
  })

  ipcMain.handle('cards:getMany', (_e, ids: string[]) => {
    if (!ids?.length) return []
    const db = getDb()
    const placeholders = ids.map(() => '?').join(',')
    const rows = db.prepare(`SELECT * FROM cards WHERE id IN (${placeholders})`).all(...ids) as CardRow[]
    return rows.map(rowToCard)
  })

  ipcMain.handle('cards:getBacklinks', (_e, cardId: string) => {
    const db = getDb()
    const rows = db.prepare(
      "SELECT * FROM cards WHERE EXISTS (SELECT 1 FROM json_each(linked_cards) WHERE value = ?)"
    ).all(cardId) as CardRow[]
    return rows.map(rowToCard)
  })

  ipcMain.handle('cards:getChildren', (_e, parentId: string) => {
    const db = getDb()
    const rows = db.prepare(
      "SELECT * FROM cards WHERE parent_id = ? ORDER BY name COLLATE NOCASE"
    ).all(parentId) as CardRow[]
    return rows.map(rowToCard)
  })

  ipcMain.handle('cards:delete', (_e, id: string) => {
    const db = getDb()
    const row = db.prepare('SELECT image_path FROM cards WHERE id = ?').get(id) as
      { image_path: string | null } | undefined
    db.prepare('DELETE FROM cards WHERE id = ?').run(id)
    if (row) safeDeleteImage(row.image_path)
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
    const imagesDir = getImagesDir()
    if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })

    const dest = join(imagesDir, `${uuidv4()}_${basename(src)}`)
    copyFileSync(src, dest)
    return dest
  })
}
