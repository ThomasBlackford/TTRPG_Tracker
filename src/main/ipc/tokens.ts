import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db'
import { getPresentationWin } from './maps'

interface TokenRow {
  id: string
  map_id: string
  name: string
  x: number
  y: number
  size: number
  color: string
  kind: string
  combatant_id: string | null
  party_member_id: string | null
  hidden: number
  image_path: string | null
  created_at: string
}

function listTokens(mapId: string) {
  return (getDb().prepare('SELECT * FROM map_tokens WHERE map_id=? ORDER BY created_at').all(mapId) as TokenRow[]).map((t) => ({
    ...t,
    hidden: t.hidden === 1
  }))
}

// The TV only ever gets tokens the DM hasn't hidden — a hidden token is how a
// DM stages an ambush without the table seeing it on the map.
function pushTokensToPlayers(mapId: string): void {
  const win = getPresentationWin()
  if (!win || win.isDestroyed()) return
  win.webContents.send('maps:tokensUpdate', {
    mapId,
    tokens: listTokens(mapId).filter((t) => !t.hidden)
  })
}

const PARTY_COLOR = '#3b82f6'
const MONSTER_COLOR = '#a3142a'

export function registerTokenHandlers(): void {
  ipcMain.handle('tokens:list', (_e, mapId: string) => listTokens(mapId))

  ipcMain.handle(
    'tokens:save',
    (_e, token: Partial<Omit<TokenRow, 'hidden'>> & { id?: string; map_id: string; hidden?: boolean }) => {
      const db = getDb()
      const id = token.id ?? uuidv4()
      const existing = db.prepare('SELECT * FROM map_tokens WHERE id=?').get(id) as TokenRow | undefined
      if (existing) {
        db.prepare('UPDATE map_tokens SET name=?, x=?, y=?, size=?, color=?, kind=?, hidden=?, image_path=? WHERE id=?').run(
          token.name ?? existing.name,
          token.x ?? existing.x,
          token.y ?? existing.y,
          token.size ?? existing.size,
          token.color ?? existing.color,
          token.kind ?? existing.kind,
          token.hidden == null ? existing.hidden : token.hidden ? 1 : 0,
          token.image_path === undefined ? existing.image_path : token.image_path,
          id
        )
      } else {
        db.prepare(
          'INSERT INTO map_tokens (id, map_id, name, x, y, size, color, kind, combatant_id, party_member_id, hidden, image_path, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).run(
          id, token.map_id, token.name ?? 'Token', token.x ?? 0.5, token.y ?? 0.5, token.size ?? 1,
          token.color ?? MONSTER_COLOR, token.kind ?? 'monster', token.combatant_id ?? null,
          token.party_member_id ?? null, token.hidden ? 1 : 0, token.image_path ?? null, new Date().toISOString()
        )
      }
      pushTokensToPlayers(token.map_id)
      return listTokens(token.map_id)
    }
  )

  ipcMain.handle('tokens:delete', (_e, id: string) => {
    const db = getDb()
    const row = db.prepare('SELECT map_id FROM map_tokens WHERE id=?').get(id) as { map_id: string } | undefined
    db.prepare('DELETE FROM map_tokens WHERE id=?').run(id)
    if (row) pushTokensToPlayers(row.map_id)
    return row ? listTokens(row.map_id) : []
  })

  // Drops a token for every combatant in the current encounter that doesn't
  // already have one on this map, so the map and the initiative order line up
  // without placing each creature by hand.
  ipcMain.handle('tokens:placeCombatants', (_e, mapId: string) => {
    const db = getDb()
    const combatants = db
      .prepare('SELECT id, name, type, party_member_id FROM encounter_combatants ORDER BY initiative DESC NULLS LAST, sort_order')
      .all() as { id: string; name: string; type: string; party_member_id: string | null }[]
    const have = new Set(
      (db.prepare('SELECT combatant_id FROM map_tokens WHERE map_id=? AND combatant_id IS NOT NULL').all(mapId) as { combatant_id: string }[]).map(
        (r) => r.combatant_id
      )
    )
    let slot = (db.prepare('SELECT COUNT(*) as c FROM map_tokens WHERE map_id=?').get(mapId) as { c: number }).c
    for (const c of combatants) {
      if (have.has(c.id)) continue
      db.prepare(
        'INSERT INTO map_tokens (id, map_id, name, x, y, size, color, kind, combatant_id, party_member_id, hidden, image_path, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
      ).run(
        uuidv4(), mapId, c.name,
        0.08 + (slot % 8) * 0.07, 0.1 + Math.floor(slot / 8) * 0.08, 1,
        c.type === 'party' ? PARTY_COLOR : MONSTER_COLOR, c.type, c.id, c.party_member_id, 0, null,
        new Date().toISOString()
      )
      slot++
    }
    pushTokensToPlayers(mapId)
    return listTokens(mapId)
  })

  // Re-sent when the TV window opens or the DM switches maps.
  ipcMain.handle('tokens:push', (_e, mapId: string) => {
    pushTokensToPlayers(mapId)
  })
}
