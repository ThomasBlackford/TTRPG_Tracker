import { ipcMain } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'

interface MemberRow {
  id: string
  name: string
  player_name: string
  avatar_path: string | null
  initiative: number | null
  sort_order: number
  resources: string
  client_id: string | null
}

function rowToMember(row: MemberRow) {
  return { ...row, resources: JSON.parse(row.resources) }
}

// The party roster is no longer built by hand — a connecting player's synced
// name/initiative is what creates (or updates) their entry. Called whenever
// the sync server processes a snapshot from a client_id it's seen before or
// not. Returns the party_member id so the caller can also bridge live HP
// into an active encounter combatant, if there is one.
export function linkOrCreatePartyMember(
  clientId: string,
  name: string,
  initiative: number | null
): string {
  const db = getDb()
  const trimmedName = name.trim() || 'Unnamed Adventurer'

  const existing = db.prepare('SELECT id FROM party_members WHERE client_id = ?').get(clientId) as
    | { id: string }
    | undefined
  if (existing) {
    db.prepare('UPDATE party_members SET name=?, initiative=? WHERE id=?').run(trimmedName, initiative, existing.id)
    return existing.id
  }

  // If a member with this exact name already exists but was never linked to
  // a synced player (e.g. added by hand before this feature existed), claim
  // it instead of creating a duplicate roster entry.
  const unlinkedMatch = db
    .prepare('SELECT id FROM party_members WHERE client_id IS NULL AND name = ? COLLATE NOCASE')
    .get(trimmedName) as { id: string } | undefined
  if (unlinkedMatch) {
    db.prepare('UPDATE party_members SET client_id=?, initiative=? WHERE id=?').run(
      clientId, initiative, unlinkedMatch.id
    )
    return unlinkedMatch.id
  }

  const id = uuidv4()
  const count = (db.prepare('SELECT COUNT(*) as c FROM party_members').get() as { c: number }).c
  db.prepare(
    `INSERT INTO party_members (id, name, player_name, avatar_path, initiative, sort_order, resources, client_id)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(id, trimmedName, '', null, initiative, count, '[]', clientId)
  return id
}

export function registerPartyHandlers(): void {
  ipcMain.handle('party:getMembers', () => {
    const rows = getDb().prepare('SELECT * FROM party_members ORDER BY sort_order ASC').all() as MemberRow[]
    return rows.map(rowToMember)
  })

  ipcMain.handle('party:saveMember', (_e, member: Record<string, unknown>) => {
    const db = getDb()
    const id = (member.id as string) || uuidv4()
    const existing = db.prepare('SELECT id FROM party_members WHERE id = ?').get(id)
    const resources = JSON.stringify(Array.isArray(member.resources) ? member.resources : [])
    const sortOrder = typeof member.sort_order === 'number' ? member.sort_order : 0

    if (existing) {
      db.prepare(`
        UPDATE party_members SET name=?, player_name=?, avatar_path=?, initiative=?, sort_order=?, resources=?
        WHERE id=?
      `).run(member.name, member.player_name ?? '', member.avatar_path ?? null,
        member.initiative ?? null, sortOrder, resources, id)
    } else {
      db.prepare(`
        INSERT INTO party_members (id, name, player_name, avatar_path, initiative, sort_order, resources)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, member.name, member.player_name ?? '', member.avatar_path ?? null,
        member.initiative ?? null, sortOrder, resources)
    }

    return rowToMember(db.prepare('SELECT * FROM party_members WHERE id = ?').get(id) as MemberRow)
  })

  ipcMain.handle('party:deleteMember', (_e, id: string) => {
    getDb().prepare('DELETE FROM party_members WHERE id = ?').run(id)
  })

  ipcMain.handle('party:updateResources', (_e, id: string, resources: unknown[]) => {
    getDb().prepare('UPDATE party_members SET resources=? WHERE id=?')
      .run(JSON.stringify(resources), id)
  })

  ipcMain.handle('party:getReputation', (_e, memberId: string) => {
    return getDb().prepare(`
      SELECT c.id as faction_id, c.name as faction_name,
             COALESCE(r.score, 0) as score,
             ? as party_member_id
      FROM cards c
      LEFT JOIN reputation r ON r.faction_id = c.id AND r.party_member_id = ?
      WHERE c.type = 'faction'
      ORDER BY c.name COLLATE NOCASE
    `).all(memberId, memberId)
  })

  ipcMain.handle('party:setReputation', (_e, memberId: string, factionId: string, score: number) => {
    getDb().prepare(`
      INSERT INTO reputation (party_member_id, faction_id, score) VALUES (?, ?, ?)
      ON CONFLICT(party_member_id, faction_id) DO UPDATE SET score=excluded.score
    `).run(memberId, factionId, Math.min(100, Math.max(-100, score)))
  })
}
