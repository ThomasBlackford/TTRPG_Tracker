import { ipcMain, nativeImage } from 'electron'
import { statSync } from 'fs'
import { getDb } from '../db'
import { broadcastRaw, clearSticky } from '../server'

// Shows the DM's current map on the players' own screens — the picture, the
// fog the DM has left, and the visible tokens. The picture is sent once (and
// again only if the map changes); tokens and fog are small and sent whenever
// they move, a little throttled so dragging the fog brush doesn't flood the
// network.

interface MapRow {
  id: string
  name: string
  image_path: string | null
  scale_pixels_per_unit: number
  grid_offset_x: number
  grid_offset_y: number
}

const MAX_SIDE = 1800
const IMAGE_KEY = 'map_image'
const OVERLAY_KEY = 'map_overlay'
const THROTTLE_MS = 150

let sharedMapId: string | null = null
let liveFog: { mapId: string; cols: number; rows: number; cells: number[] } | null = null
const imageCache = new Map<string, { dataUrl: string; width: number; height: number; origW: number; origH: number }>()
let sharedOrig: { w: number; h: number } | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let dirty = false

export function sharedMap(): string | null {
  return sharedMapId
}

function loadImage(map: MapRow): { dataUrl: string; width: number; height: number; origW: number; origH: number } | null {
  if (!map.image_path) return null
  let mtime = 0
  try { mtime = statSync(map.image_path).mtimeMs } catch { return null }
  const key = `${map.id}:${mtime}`
  const hit = imageCache.get(key)
  if (hit) return hit
  try {
    let img = nativeImage.createFromPath(map.image_path)
    if (img.isEmpty()) return null
    const { width, height } = img.getSize()
    const longest = Math.max(width, height)
    if (longest > MAX_SIDE) {
      const k = MAX_SIDE / longest
      img = img.resize({ width: Math.round(width * k), height: Math.round(height * k), quality: 'good' })
    }
    const size = img.getSize()
    const out = { dataUrl: `data:image/jpeg;base64,${img.toJPEG(82).toString('base64')}`, width: size.width, height: size.height, origW: width, origH: height }
    imageCache.clear() // only the shared map's picture is worth keeping
    imageCache.set(key, out)
    return out
  } catch (e) {
    console.error('[mapShare] could not prepare the map image:', e)
    return null
  }
}

function fogFor(mapId: string): { cols: number; rows: number; cells: string } | null {
  if (liveFog && liveFog.mapId === mapId) {
    return { cols: liveFog.cols, rows: liveFog.rows, cells: liveFog.cells.map((c) => (c === 0 ? '0' : '1')).join('') }
  }
  const row = getDb().prepare('SELECT * FROM map_fog WHERE map_id = ?').get(mapId) as
    | { grid_cols: number; grid_rows: number; cells: string }
    | undefined
  if (!row || !row.cells) return null
  let cells: number[] = []
  try { cells = JSON.parse(row.cells) } catch { return null }
  if (cells.length === 0) return null
  return { cols: row.grid_cols, rows: row.grid_rows, cells: cells.map((c) => (c === 0 ? '0' : '1')).join('') }
}

function overlayFor(mapId: string) {
  const db = getDb()
  const map = db.prepare('SELECT * FROM maps WHERE id = ?').get(mapId) as MapRow | undefined
  const tokens = (
    db
      .prepare(
        `SELECT t.id, t.name, t.x, t.y, t.size, t.color, t.kind, t.party_member_id, p.client_id AS client_id
         FROM map_tokens t LEFT JOIN party_members p ON p.id = t.party_member_id
         WHERE t.map_id = ? AND t.hidden = 0 ORDER BY t.created_at`
      )
      .all(mapId) as { id: string; name: string; x: number; y: number; size: number; color: string; kind: string; client_id: string | null }[]
  ).map((t) => ({ id: t.id, name: t.name, x: t.x, y: t.y, size: t.size, color: t.color, kind: t.kind, clientId: t.client_id }))

  // The scale is in pixels of the ORIGINAL picture, but everything sent is a
  // fraction of it, so the downscale for the wire doesn't matter.
  let grid: { w: number; h: number; ox: number; oy: number } | null = null
  if (map && sharedOrig && map.scale_pixels_per_unit > 0) {
    grid = {
      w: map.scale_pixels_per_unit / sharedOrig.w,
      h: map.scale_pixels_per_unit / sharedOrig.h,
      ox: map.grid_offset_x / sharedOrig.w,
      oy: map.grid_offset_y / sharedOrig.h
    }
  }
  return { type: 'map_overlay', mapId, tokens, fog: fogFor(mapId), grid }
}

function sendOverlay(): void {
  if (!sharedMapId) return
  broadcastRaw(overlayFor(sharedMapId), { stickyKey: OVERLAY_KEY })
}

// Cheap to call as often as tokens/fog change.
export function refreshShared(mapId?: string): void {
  if (!sharedMapId || (mapId && mapId !== sharedMapId)) return
  if (timer) { dirty = true; return }
  sendOverlay()
  timer = setTimeout(() => {
    timer = null
    if (dirty) { dirty = false; refreshShared() }
  }, THROTTLE_MS)
}

export function noteFog(mapId: string, fogState: { gridCols: number; gridRows: number; cells: number[] } | null, persisted: boolean): void {
  if (persisted || !fogState) liveFog = null
  else liveFog = { mapId, cols: fogState.gridCols, rows: fogState.gridRows, cells: fogState.cells }
  refreshShared(mapId)
}

function shareNow(mapId: string): { ok: boolean; error?: string } {
  const map = getDb().prepare('SELECT * FROM maps WHERE id = ?').get(mapId) as MapRow | undefined
  if (!map) return { ok: false, error: 'That map no longer exists.' }
  const image = loadImage(map)
  if (!image) return { ok: false, error: 'This map has no usable image to share.' }
  sharedMapId = mapId
  sharedOrig = { w: image.origW, h: image.origH }
  liveFog = null
  broadcastRaw(
    { type: 'map_image', mapId, name: map.name, dataUrl: image.dataUrl, width: image.width, height: image.height },
    { stickyKey: IMAGE_KEY }
  )
  broadcastRaw(overlayFor(mapId), { stickyKey: OVERLAY_KEY })
  return { ok: true }
}

function stopSharing(): void {
  sharedMapId = null
  liveFog = null
  clearSticky(IMAGE_KEY)
  clearSticky(OVERLAY_KEY)
  broadcastRaw({ type: 'map_clear' })
}

export function registerMapShareHandlers(): void {
  ipcMain.handle('mapShare:set', (_e, mapId: string | null) => {
    if (!mapId) {
      stopSharing()
      return { ok: true, sharing: null as string | null }
    }
    const r = shareNow(mapId)
    return { ...r, sharing: r.ok ? mapId : sharedMapId }
  })
  ipcMain.handle('mapShare:status', () => ({ sharing: sharedMapId }))
}
