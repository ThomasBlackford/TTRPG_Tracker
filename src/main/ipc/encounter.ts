import { ipcMain } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'
import { getPresentationWin } from './maps'
import { getMainWin } from '../mainWindow'
import { getPlayers, isPlayerOnline, sendCommand } from '../server'

interface CombatantRow {
  id: string
  name: string
  type: string
  party_member_id: string | null
  hp_current: number | null
  hp_max: number | null
  ac: number | null
  initiative: number | null
  conditions: string
  sort_order: number
  init_mod: number
  xp: number
  effects: string
  concentrating: number
}

interface StateRow {
  id: number
  is_active: number
  round: number
  current_index: number
}

interface PartyMemberRow {
  id: string
  name: string
  client_id: string | null
  initiative: number | null
  sort_order: number
}

// A timed effect on a creature ("Hold Person — 10 rounds"). Counts down at the
// end of the affected creature's own turn and drops off at zero.
interface Effect {
  id: string
  label: string
  rounds: number | null // null = until removed by hand
}

function getSortedCombatants(db: ReturnType<typeof getDb>): CombatantRow[] {
  return db
    .prepare('SELECT * FROM encounter_combatants ORDER BY initiative DESC NULLS LAST, sort_order ASC')
    .all() as CombatantRow[]
}

function getStateRow(db: ReturnType<typeof getDb>): StateRow | undefined {
  return db.prepare('SELECT * FROM encounter_state WHERE id = 1').get() as StateRow | undefined
}

function parseEffects(raw: string): Effect[] {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? (v as Effect[]) : []
  } catch {
    return []
  }
}

function buildState(db: ReturnType<typeof getDb>) {
  const stateRow = getStateRow(db)
  const rows = getSortedCombatants(db)
  return {
    isActive: (stateRow?.is_active ?? 0) === 1,
    round: stateRow?.round ?? 1,
    currentIndex: stateRow?.current_index ?? 0,
    combatants: rows.map((r) => ({
      ...r,
      type: r.type as 'party' | 'monster',
      conditions: JSON.parse(r.conditions || '[]') as string[],
      effects: parseEffects(r.effects),
      concentrating: r.concentrating === 1,
      clientId: clientIdFor(db, r.party_member_id)
    })),
  }
}

function clientIdFor(db: ReturnType<typeof getDb>, partyMemberId: string | null): string | null {
  if (!partyMemberId) return null
  const row = db.prepare('SELECT client_id FROM party_members WHERE id=?').get(partyMemberId) as
    | { client_id: string | null }
    | undefined
  return row?.client_id ?? null
}

// Pushes to both the TV (with monster HP stripped) and the DM's own window.
// The DM's own window normally gets fresh state back directly from whatever
// IPC call it just made — this push is what covers updates that originate
// elsewhere, like a party member's HP changing because their own Companion
// app synced a new value while an encounter is active.
function broadcastEncounterUpdate(db: ReturnType<typeof getDb>) {
  const state = buildState(db)

  const presentationWin = getPresentationWin()
  if (presentationWin && !presentationWin.isDestroyed()) {
    const safeState = {
      ...state,
      combatants: state.combatants.map((c) =>
        c.type === 'monster' ? { ...c, hp_current: null, hp_max: null } : c
      ),
    }
    presentationWin.webContents.send('encounter:update', safeState)
  }

  const mainWin = getMainWin()
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('encounter:update', state)
  }
}

// Called when a connected player's HP changes — if they're currently in an
// active encounter, their combatant HP follows live instead of the DM
// re-typing it. A no-op if they aren't in the current fight.
export function syncPartyCombatantHp(
  partyMemberId: string,
  hpCurrent: number | null,
  hpMax: number | null
): void {
  const db = getDb()
  const combatant = db
    .prepare("SELECT id FROM encounter_combatants WHERE party_member_id = ? AND type = 'party'")
    .get(partyMemberId) as { id: string } | undefined
  if (!combatant) return

  db.prepare('UPDATE encounter_combatants SET hp_current=?, hp_max=? WHERE id=?').run(
    hpCurrent, hpMax, combatant.id
  )
  broadcastEncounterUpdate(db)
}

// A party member's HP lives entirely in the sync snapshot, not in
// party_members — so adding someone to an encounter (or starting one) needs
// to pull whatever the server already has for them right now. Without this,
// anyone who synced a while ago and hasn't touched their sheet since would
// show up with blank HP until their next unrelated update.
function getLiveHp(clientId: string | null): { hp_current: number | null; hp_max: number | null } {
  if (!clientId) return { hp_current: null, hp_max: null }
  const live = getPlayers().find((p) => p.clientId === clientId)
  return live
    ? { hp_current: live.snapshot.hp_current, hp_max: live.snapshot.hp_max }
    : { hp_current: null, hp_max: null }
}

function d20(): number {
  return Math.floor(Math.random() * 20) + 1
}

// "Goblin 3" and "Goblin" share a base name — that's what a grouped
// initiative roll keys on.
function baseName(name: string): string {
  return name.replace(/\s+\d+$/, '').trim().toLowerCase()
}

// Tells the player whose turn it is (and who's next) — quietly skipped for
// monsters and for players who aren't connected.
function notifyTurn(db: ReturnType<typeof getDb>, round: number): void {
  const state = buildState(db)
  const cur = state.combatants[state.currentIndex]
  const next = state.combatants.length > 1 ? state.combatants[(state.currentIndex + 1) % state.combatants.length] : null
  if (cur?.clientId && isPlayerOnline(cur.clientId)) {
    sendCommand(cur.clientId, { cmd: 'turn', state: 'your_turn', round })
  }
  if (next?.clientId && next !== cur && isPlayerOnline(next.clientId)) {
    sendCommand(next.clientId, { cmd: 'turn', state: 'up_next', round })
  }
}

export function registerEncounterHandlers(): void {
  ipcMain.handle('encounter:getState', () => buildState(getDb()))

  ipcMain.handle('encounter:start', () => {
    const db = getDb()
    db.prepare('DELETE FROM encounter_combatants').run()
    db.prepare('DELETE FROM encounter_state WHERE id = 1').run()
    db.prepare(
      'INSERT INTO encounter_state (id, is_active, round, current_index) VALUES (1, 1, 1, 0)'
    ).run()

    const members = db
      .prepare('SELECT id, name, client_id, initiative, sort_order FROM party_members ORDER BY sort_order')
      .all() as PartyMemberRow[]

    members.forEach((m, i) => {
      const { hp_current, hp_max } = getLiveHp(m.client_id)
      db.prepare(
        'INSERT INTO encounter_combatants (id, name, type, party_member_id, hp_current, hp_max, initiative, sort_order, conditions) VALUES (?,?,?,?,?,?,?,?,?)'
      ).run(uuidv4(), m.name, 'party', m.id, hp_current, hp_max, m.initiative ?? null, i, '[]')
    })

    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  ipcMain.handle('encounter:end', () => {
    const db = getDb()
    db.prepare('DELETE FROM encounter_combatants').run()
    db.prepare(
      'UPDATE encounter_state SET is_active=0, round=1, current_index=0 WHERE id=1'
    ).run()
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  ipcMain.handle('encounter:addPartyMember', (_e, memberId: string) => {
    const db = getDb()
    const member = db
      .prepare('SELECT id, name, client_id, initiative FROM party_members WHERE id=?')
      .get(memberId) as PartyMemberRow | undefined
    if (!member) return buildState(db)

    const exists = db
      .prepare('SELECT 1 FROM encounter_combatants WHERE party_member_id=?')
      .get(memberId)
    if (exists) return buildState(db)

    const count = (
      db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }
    ).c
    const { hp_current, hp_max } = getLiveHp(member.client_id)
    db.prepare(
      'INSERT INTO encounter_combatants (id, name, type, party_member_id, hp_current, hp_max, initiative, sort_order, conditions) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(uuidv4(), member.name, 'party', member.id, hp_current, hp_max, member.initiative ?? null, count, '[]')

    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  // Adds one or several copies of a monster. With count > 1 they're numbered
  // ("Goblin 1", "Goblin 2", …); `rollInitiative` rolls d20 + modifier for
  // each, or once for the whole group when `grouped` is set (the usual
  // shortcut for a pack of identical creatures).
  ipcMain.handle(
    'encounter:addMonster',
    (
      _e,
      data: {
        name: string
        hp_max?: number
        ac?: number
        initiative?: number
        init_mod?: number
        xp?: number
        count?: number
        rollInitiative?: boolean
        grouped?: boolean
      }
    ) => {
      const db = getDb()
      const qty = Math.max(1, Math.min(30, Math.floor(data.count ?? 1)))
      const mod = data.init_mod ?? 0
      const groupRoll = data.rollInitiative && data.grouped ? d20() + mod : null
      let count = (db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }).c

      // Continue numbering from any existing copies so adding "2 more goblins"
      // mid-fight doesn't create a second "Goblin 1".
      const existingSame = (db.prepare('SELECT name FROM encounter_combatants').all() as { name: string }[])
        .filter((r) => baseName(r.name) === data.name.trim().toLowerCase()).length
      const numbered = qty > 1 || existingSame > 0

      for (let i = 0; i < qty; i++) {
        const init =
          groupRoll != null ? groupRoll
          : data.rollInitiative ? d20() + mod
          : data.initiative ?? null
        db.prepare(
          'INSERT INTO encounter_combatants (id, name, type, hp_current, hp_max, ac, initiative, sort_order, conditions, init_mod, xp) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        ).run(
          uuidv4(),
          numbered ? `${data.name.trim()} ${existingSame + i + 1}` : data.name.trim(),
          'monster',
          data.hp_max ?? null,
          data.hp_max ?? null,
          data.ac ?? null,
          init,
          count++,
          '[]',
          mod,
          data.xp ?? 0
        )
      }
      const state = buildState(db)
      broadcastEncounterUpdate(db)
      return state
    }
  )

  // Rolls d20 + modifier for monsters that don't have an initiative yet (or
  // all of them with `force`). Party members roll on their own devices.
  ipcMain.handle('encounter:rollMonsterInitiative', (_e, opts: { force?: boolean; grouped?: boolean }) => {
    const db = getDb()
    const monsters = getSortedCombatants(db).filter((c) => c.type === 'monster' && (opts.force || c.initiative == null))
    const groupRolls = new Map<string, number>()
    for (const m of monsters) {
      let roll: number
      if (opts.grouped) {
        const key = baseName(m.name)
        if (!groupRolls.has(key)) groupRolls.set(key, d20())
        roll = groupRolls.get(key)! + m.init_mod
      } else {
        roll = d20() + m.init_mod
      }
      db.prepare('UPDATE encounter_combatants SET initiative=? WHERE id=?').run(roll, m.id)
    }
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  ipcMain.handle(
    'encounter:updateCombatant',
    (
      _e,
      id: string,
      changes: Partial<{
        hp_current: number | null
        hp_max: number | null
        conditions: string[]
        effects: Effect[]
        concentrating: boolean
        initiative: number | null
        init_mod: number
        xp: number
        name: string
        ac: number | null
      }>
    ) => {
      const db = getDb()
      const existing = db
        .prepare('SELECT * FROM encounter_combatants WHERE id=?')
        .get(id) as CombatantRow | undefined
      if (!existing) return buildState(db)

      const name = 'name' in changes ? (changes.name ?? existing.name) : existing.name
      const hp = 'hp_current' in changes ? changes.hp_current ?? null : existing.hp_current
      const hpMax = 'hp_max' in changes ? changes.hp_max ?? null : existing.hp_max
      const conditions =
        'conditions' in changes
          ? JSON.stringify(changes.conditions ?? [])
          : existing.conditions
      const effects = 'effects' in changes ? JSON.stringify(changes.effects ?? []) : existing.effects
      const concentrating = 'concentrating' in changes ? (changes.concentrating ? 1 : 0) : existing.concentrating
      const initiative =
        'initiative' in changes ? changes.initiative ?? null : existing.initiative
      const initMod = 'init_mod' in changes ? changes.init_mod ?? 0 : existing.init_mod
      const xp = 'xp' in changes ? changes.xp ?? 0 : existing.xp
      const ac = 'ac' in changes ? changes.ac ?? null : existing.ac

      db.prepare(
        'UPDATE encounter_combatants SET name=?, hp_current=?, hp_max=?, conditions=?, effects=?, concentrating=?, initiative=?, init_mod=?, xp=?, ac=? WHERE id=?'
      ).run(name, hp, hpMax, conditions, effects, concentrating, initiative, initMod, xp, ac, id)

      const state = buildState(db)
      broadcastEncounterUpdate(db)
      return state
    }
  )

  // Damage or healing from the DM. A party member whose app is connected gets
  // it pushed to their sheet (their snapshot then flows back and updates this
  // row, so both sides stay one source of truth); monsters and offline
  // players are adjusted here directly.
  ipcMain.handle(
    'encounter:applyHp',
    (_e, id: string, amount: number, mode: 'normal' | 'half' | 'double' = 'normal') => {
      const db = getDb()
      const c = db.prepare('SELECT * FROM encounter_combatants WHERE id=?').get(id) as CombatantRow | undefined
      if (!c || !Number.isFinite(amount) || amount === 0) return { ...buildState(db), note: undefined as string | undefined }

      const isDamage = amount < 0
      const scaled = isDamage
        ? -Math.max(0, Math.floor(Math.abs(amount) * (mode === 'half' ? 0.5 : mode === 'double' ? 2 : 1)))
        : amount
      if (scaled === 0) return { ...buildState(db), note: 'Resisted to 0 damage.' as string | undefined }

      let note: string | undefined
      const clientId = clientIdFor(db, c.party_member_id)
      if (clientId && isPlayerOnline(clientId)) {
        sendCommand(clientId, { cmd: 'hp_delta', amount: scaled })
        note = `${isDamage ? 'Damage' : 'Healing'} sent to ${c.name}'s sheet.`
      } else {
        const base = c.hp_current ?? 0
        let next = base + scaled
        next = Math.max(0, next)
        if (c.hp_max != null) next = Math.min(c.hp_max, next)
        db.prepare('UPDATE encounter_combatants SET hp_current=? WHERE id=?').run(next, id)
      }

      if (isDamage && c.concentrating === 1) {
        const dc = Math.max(10, Math.floor(Math.abs(scaled) / 2))
        note = `${c.name} is concentrating — Constitution save, DC ${dc}.`
      }

      broadcastEncounterUpdate(db)
      return { ...buildState(db), note }
    }
  )

  ipcMain.handle('encounter:removeCombatant', (_e, id: string) => {
    const db = getDb()
    const stateRow = getStateRow(db)
    const before = getSortedCombatants(db)
    const removedIdx = before.findIndex((c) => c.id === id)

    db.prepare('DELETE FROM encounter_combatants WHERE id=?').run(id)
    db.prepare('DELETE FROM map_tokens WHERE combatant_id=?').run(id)

    if (stateRow && removedIdx !== -1 && removedIdx < stateRow.current_index) {
      const newIdx = Math.max(0, stateRow.current_index - 1)
      db.prepare('UPDATE encounter_state SET current_index=? WHERE id=1').run(newIdx)
    }

    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  ipcMain.handle('encounter:nextTurn', () => {
    const db = getDb()
    const stateRow = getStateRow(db)
    if (!stateRow) return { ...buildState(db), expired: [] as { name: string; label: string }[] }

    const combatants = getSortedCombatants(db)
    const count = combatants.length
    if (count === 0) return { ...buildState(db), expired: [] as { name: string; label: string }[] }

    // End of the outgoing creature's turn: tick its timed effects down.
    const expired: { name: string; label: string }[] = []
    const outgoing = combatants[Math.min(stateRow.current_index, count - 1)]
    const effects = parseEffects(outgoing.effects)
    if (effects.length > 0) {
      const kept: Effect[] = []
      for (const e of effects) {
        if (e.rounds == null) { kept.push(e); continue }
        const left = e.rounds - 1
        if (left <= 0) expired.push({ name: outgoing.name, label: e.label })
        else kept.push({ ...e, rounds: left })
      }
      db.prepare('UPDATE encounter_combatants SET effects=? WHERE id=?').run(JSON.stringify(kept), outgoing.id)
    }

    let nextIdx = stateRow.current_index + 1
    let nextRound = stateRow.round
    if (nextIdx >= count) {
      nextIdx = 0
      nextRound++
    }
    db.prepare('UPDATE encounter_state SET current_index=?, round=? WHERE id=1').run(
      nextIdx,
      nextRound
    )

    const state = buildState(db)
    broadcastEncounterUpdate(db)
    notifyTurn(db, nextRound)
    return { ...state, expired }
  })

  ipcMain.handle('encounter:prevTurn', () => {
    const db = getDb()
    const stateRow = getStateRow(db)
    if (!stateRow) return buildState(db)

    const count = (
      db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }
    ).c
    if (count === 0) return buildState(db)

    let prevIdx = stateRow.current_index - 1
    let prevRound = stateRow.round
    if (prevIdx < 0) {
      prevIdx = count - 1
      prevRound = Math.max(1, prevRound - 1)
    }
    db.prepare('UPDATE encounter_state SET current_index=?, round=? WHERE id=1').run(
      prevIdx,
      prevRound
    )

    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  // ── Monster templates (the DM's own reusable stat blocks) ────────────────
  ipcMain.handle('monsters:list', () =>
    getDb().prepare('SELECT * FROM monster_templates ORDER BY name COLLATE NOCASE').all()
  )

  ipcMain.handle(
    'monsters:save',
    (_e, m: { id?: string; name: string; ac?: number | null; hp?: number | null; init_mod?: number; cr?: string; xp?: number; notes?: string }) => {
      const db = getDb()
      const id = m.id ?? uuidv4()
      const existing = db.prepare('SELECT 1 FROM monster_templates WHERE id=?').get(id)
      if (existing) {
        db.prepare('UPDATE monster_templates SET name=?, ac=?, hp=?, init_mod=?, cr=?, xp=?, notes=? WHERE id=?').run(
          m.name, m.ac ?? null, m.hp ?? null, m.init_mod ?? 0, m.cr ?? '', m.xp ?? 0, m.notes ?? '', id
        )
      } else {
        db.prepare(
          'INSERT INTO monster_templates (id, name, ac, hp, init_mod, cr, xp, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
        ).run(id, m.name, m.ac ?? null, m.hp ?? null, m.init_mod ?? 0, m.cr ?? '', m.xp ?? 0, m.notes ?? '', new Date().toISOString())
      }
      return db.prepare('SELECT * FROM monster_templates WHERE id=?').get(id)
    }
  )

  ipcMain.handle('monsters:delete', (_e, id: string) => {
    getDb().prepare('DELETE FROM monster_templates WHERE id=?').run(id)
  })
}
