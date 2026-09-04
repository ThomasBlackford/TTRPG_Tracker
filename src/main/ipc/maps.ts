import { ipcMain, app, BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'
import { copyFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join, basename, resolve, sep } from 'path'

function getImagesDir(): string {
  return join(app.getPath('userData'), 'images')
}

// Best-effort cleanup of a map image copied into our own images dir.
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

interface MapRow {
  id: string; name: string; image_path: string | null; description: string
  scale_pixels_per_unit: number; scale_feet_per_unit: number
  grid_offset_x: number; grid_offset_y: number
  created_at: string; updated_at: string
}
interface PinRow  { id: string; map_id: string; x: number; y: number; label: string; card_id: string | null; child_map_id: string | null; color: string; created_at: string }
interface FogRow  { map_id: string; grid_cols: number; grid_rows: number; cells: string; updated_at: string }

let presentationWin: BrowserWindow | null = null

export function getPresentationWin(): BrowserWindow | null { return presentationWin }

function pushToPlayer(channel: string, data: unknown) {
  if (presentationWin && !presentationWin.isDestroyed()) {
    presentationWin.webContents.send(channel, data)
  }
}

export function registerMapHandlers(): void {
  ipcMain.handle('maps:list', () =>
    getDb().prepare('SELECT * FROM maps ORDER BY name COLLATE NOCASE').all() as MapRow[]
  )

  ipcMain.handle('maps:get', (_e, id: string) =>
    getDb().prepare('SELECT * FROM maps WHERE id = ?').get(id) as MapRow | undefined ?? null
  )

  ipcMain.handle('maps:save', (_e, map: Record<string, unknown>) => {
    const db = getDb()
    const now = new Date().toISOString()
    const id = (map.id as string) || uuidv4()
    const existing = db.prepare('SELECT id, image_path FROM maps WHERE id = ?').get(id) as
      { id: string; image_path: string | null } | undefined
    const newImagePath = (map.image_path as string | null) ?? null

    if (existing) {
      db.prepare(`UPDATE maps SET name=?, image_path=?, description=?,
        scale_pixels_per_unit=?, scale_feet_per_unit=?, grid_offset_x=?, grid_offset_y=?,
        updated_at=? WHERE id=?`)
        .run(
          map.name, newImagePath, map.description ?? '',
          map.scale_pixels_per_unit ?? 50, map.scale_feet_per_unit ?? 5,
          map.grid_offset_x ?? 0, map.grid_offset_y ?? 0,
          now, id
        )
      if (existing.image_path && existing.image_path !== newImagePath) {
        safeDeleteImage(existing.image_path)
      }
    } else {
      db.prepare(`INSERT INTO maps (id, name, image_path, description,
        scale_pixels_per_unit, scale_feet_per_unit, grid_offset_x, grid_offset_y,
        created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(
          id, map.name, map.image_path ?? null, map.description ?? '',
          map.scale_pixels_per_unit ?? 50, map.scale_feet_per_unit ?? 5,
          map.grid_offset_x ?? 0, map.grid_offset_y ?? 0,
          now, now
        )
    }
    return db.prepare('SELECT * FROM maps WHERE id = ?').get(id) as MapRow
  })

  ipcMain.handle('maps:delete', (_e, id: string) => {
    const db = getDb()
    const row = db.prepare('SELECT image_path FROM maps WHERE id = ?').get(id) as
      { image_path: string | null } | undefined
    db.prepare('DELETE FROM maps WHERE id = ?').run(id)
    if (row) safeDeleteImage(row.image_path)
  })

  ipcMain.handle('maps:getPins', (_e, mapId: string) =>
    getDb().prepare('SELECT * FROM map_pins WHERE map_id = ? ORDER BY created_at').all(mapId) as PinRow[]
  )

  ipcMain.handle('maps:savePin', (_e, pin: Record<string, unknown>) => {
    const db = getDb()
    const now = new Date().toISOString()
    const id = (pin.id as string) || uuidv4()
    const existing = db.prepare('SELECT id FROM map_pins WHERE id = ?').get(id)

    if (existing) {
      db.prepare('UPDATE map_pins SET x=?, y=?, label=?, card_id=?, child_map_id=?, color=? WHERE id=?')
        .run(pin.x, pin.y, pin.label ?? '', pin.card_id ?? null, pin.child_map_id ?? null, pin.color ?? '#c9a84c', id)
    } else {
      db.prepare('INSERT INTO map_pins (id, map_id, x, y, label, card_id, child_map_id, color, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id, pin.map_id, pin.x ?? 0.5, pin.y ?? 0.5, pin.label ?? '', pin.card_id ?? null, pin.child_map_id ?? null, pin.color ?? '#c9a84c', now)
    }
    return db.prepare('SELECT * FROM map_pins WHERE id = ?').get(id) as PinRow
  })

  ipcMain.handle('maps:deletePin', (_e, id: string) => {
    getDb().prepare('DELETE FROM map_pins WHERE id = ?').run(id)
  })

  // --- Fog of War ---

  ipcMain.handle('maps:getFog', (_e, mapId: string) => {
    const row = getDb().prepare('SELECT * FROM map_fog WHERE map_id = ?').get(mapId) as FogRow | undefined
    if (!row) return null
    return {
      gridCols: row.grid_cols,
      gridRows: row.grid_rows,
      cells: row.cells ? JSON.parse(row.cells) : []
    }
  })

  ipcMain.handle('maps:saveFog', (_e, data: { mapId: string; fogState: { gridCols: number; gridRows: number; cells: number[] } }) => {
    const db = getDb()
    const { mapId, fogState } = data
    const now = new Date().toISOString()
    const cellsJson = JSON.stringify(fogState.cells)
    const existing = db.prepare('SELECT map_id FROM map_fog WHERE map_id = ?').get(mapId)
    if (existing) {
      db.prepare('UPDATE map_fog SET grid_cols=?, grid_rows=?, cells=?, updated_at=? WHERE map_id=?')
        .run(fogState.gridCols, fogState.gridRows, cellsJson, now, mapId)
    } else {
      db.prepare('INSERT INTO map_fog (map_id, grid_cols, grid_rows, cells, updated_at) VALUES (?,?,?,?,?)')
        .run(mapId, fogState.gridCols, fogState.gridRows, cellsJson, now)
    }
    pushToPlayer('maps:fogUpdate', { mapId, fogState })
  })

  ipcMain.handle('maps:deleteFog', (_e, mapId: string) => {
    getDb().prepare('DELETE FROM map_fog WHERE map_id = ?').run(mapId)
    pushToPlayer('maps:fogUpdate', { mapId, fogState: null })
  })

  // Broadcast-only fog update (no DB write) — used while the DM is actively
  // dragging the fog brush, so the player screen updates live instead of
  // only once the stroke ends. The final state is still persisted via
  // maps:saveFog on pointer-up.
  ipcMain.handle('maps:pushFogLive', (_e, data: { mapId: string; fogState: unknown }) => {
    pushToPlayer('maps:fogUpdate', data)
  })

  // --- Session-only push channels (no DB) ---

  ipcMain.handle('maps:pushRuler', (_e, data: unknown) => {
    pushToPlayer('maps:rulerUpdate', data)
  })

  ipcMain.handle('maps:pushSpotlight', (_e, data: unknown) => {
    pushToPlayer('maps:spotlightUpdate', data)
  })

  ipcMain.handle('maps:pushGrid', (_e, data: unknown) => {
    pushToPlayer('maps:gridUpdate', data)
  })

  ipcMain.handle('maps:pushEffect', (_e, data: { id: string; type: string; x?: number; y?: number }) => {
    pushToPlayer('maps:effectUpdate', data)
  })

  ipcMain.handle('maps:pushRay', (_e, data: unknown) => {
    pushToPlayer('maps:rayUpdate', data)
  })

  // Zones are session-only, in-memory state (see MapPage) — this always
  // pushes the FULL current list rather than a delta, same as pushGrid,
  // so the TV can't drift out of sync from a missed incremental update.
  ipcMain.handle('maps:pushZones', (_e, data: unknown) => {
    pushToPlayer('maps:zonesUpdate', data)
  })

  ipcMain.handle('maps:pushAmbientVfx', (_e, data: { rain: boolean; stormLightning: boolean }) => {
    pushToPlayer('maps:ambientVfxUpdate', data)
  })

  // --- Presentation window ---

  ipcMain.handle('maps:openPresentation', (_e, mapId: string) => {
    if (presentationWin && !presentationWin.isDestroyed()) {
      presentationWin.webContents.send('maps:presentUpdate', mapId)
      presentationWin.focus()
      return
    }

    // If a second display is connected (the TV/projector), open the
    // presentation window there and go fullscreen automatically. On a
    // single-monitor setup, fall back to a plain windowed view instead of
    // fullscreening over the DM's own screen.
    const displays = screen.getAllDisplays()
    const primary = screen.getPrimaryDisplay()
    const targetDisplay = displays.find((d) => d.id !== primary.id)

    presentationWin = new BrowserWindow({
      x: targetDisplay?.bounds.x,
      y: targetDisplay?.bounds.y,
      width: targetDisplay?.bounds.width ?? 1280,
      height: targetDisplay?.bounds.height ?? 720,
      title: 'Map — Player View',
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        webSecurity: false
      }
    })

    presentationWin.once('ready-to-show', () => {
      presentationWin?.show()
      if (targetDisplay) presentationWin?.setFullScreen(true)
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      presentationWin.loadURL(
        `${process.env['ELECTRON_RENDERER_URL']}?present=1&mapId=${encodeURIComponent(mapId)}`
      )
    } else {
      presentationWin.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { present: '1', mapId }
      })
    }

    presentationWin.on('closed', () => { presentationWin = null })
  })

  ipcMain.handle('maps:closePresentation', () => {
    if (presentationWin && !presentationWin.isDestroyed()) presentationWin.close()
  })

  ipcMain.handle('maps:toggleFullscreen', () => {
    if (presentationWin && !presentationWin.isDestroyed()) {
      presentationWin.setFullScreen(!presentationWin.isFullScreen())
    }
  })

  ipcMain.handle('maps:setFullscreen', (_e, value: boolean) => {
    if (presentationWin && !presentationWin.isDestroyed()) {
      presentationWin.setFullScreen(value)
    }
  })

  ipcMain.handle('maps:pushHandout', (_e, imagePath: string) => {
    pushToPlayer('maps:handoutUpdate', { imagePath })
  })

  ipcMain.handle('maps:clearHandout', () => {
    pushToPlayer('maps:handoutUpdate', null)
  })

  ipcMain.handle('maps:setScene', (_e, data: { imagePath?: string; title?: string; subtitle?: string }) => {
    pushToPlayer('maps:sceneUpdate', data)
  })

  ipcMain.handle('maps:clearScene', () => {
    pushToPlayer('maps:sceneUpdate', null)
  })

  ipcMain.handle('dialog:openMapImage', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      title: 'Choose Map Image',
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
