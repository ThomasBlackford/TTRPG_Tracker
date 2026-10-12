import { ipcMain } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'
import { getPresentationWin } from './maps'
import { getMainWin } from '../mainWindow'
import { getPlayers, isPlayerOnline, sendCommand } from '../server'
import type { CompanionSnapshot, PlayerSnapshot, RollResult } from '../server'
import { getSetting } from '../settings'
import { logEvent, setLogGroup, getLogGroup, listLog, summarizeFight } from '../sessionLog'
import { pushTokensToPlayers } from './tokens'
import { pushUndo, resetUndo, stepBack, stepForward, takeSnapshot, undoInfo } from '../encounterUndo'
import type { PlayerCmd } from '../encounterUndo'

type Db = ReturnType<typeof getDb>

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
  legendary_max: number
  legendary_current: number
  legres_max: number
  legres_current: number
  recharges: string
  is_lair: number
  companion_id: string | null
  owner_client_id: string | null
  concentration_spell: string
  statblock: string
}

interface StateRow {
  id: number
  is_active: number
  round: number
  current_index: number
  log_id: string
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

// An ability that comes back on a die roll ("Fire Breath (Recharge 5-6)").
interface Recharge {
  id: string
  name: string
  min: number // recharges on this roll or higher (d6)
  ready: boolean
}

export interface MonsterInit {
  name: string
  hp_max?: number
  ac?: number
  initiative?: number
  init_mod?: number
  xp?: number
  count?: number
  rollInitiative?: boolean
  grouped?: boolean
  legendary_actions?: number
  legendary_resistances?: number
  recharges?: { name: string; min: number }[]
  lair?: boolean
  statblock?: unknown
}

function getSortedCombatants(db: Db): CombatantRow[] {
  return db
    .prepare('SELECT * FROM encounter_combatants ORDER BY initiative DESC NULLS LAST, sort_order ASC')
    .all() as CombatantRow[]
}

function getStateRow(db: Db): StateRow | undefined {
  return db.prepare('SELECT * FROM encounter_state WHERE id = 1').get() as StateRow | undefined
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw || '')
    return (v ?? fallback) as T
  } catch {
    return fallback
  }
}

function parseEffects(raw: string): Effect[] {
  const v = parseJson<unknown>(raw, [])
  return Array.isArray(v) ? (v as Effect[]) : []
}

function buildState(db: Db) {
  const stateRow = getStateRow(db)
  const rows = getSortedCombatants(db)
  return {
    isActive: (stateRow?.is_active ?? 0) === 1,
    round: stateRow?.round ?? 1,
    currentIndex: stateRow?.current_index ?? 0,
    undo: undoInfo(),
    combatants: rows.map((r) => ({
      ...r,
      type: r.type as 'party' | 'monster',
      conditions: parseJson<string[]>(r.conditions, []),
      effects: parseEffects(r.effects),
      concentrating: r.concentrating === 1,
      recharges: parseJson<Recharge[]>(r.recharges, []),
      is_lair: r.is_lair === 1,
      statblock: r.statblock ? parseJson<unknown>(r.statblock, null) : null,
      clientId: r.owner_client_id ?? clientIdFor(db, r.party_member_id)
    }))
  }
}

function clientIdFor(db: Db, partyMemberId: string | null): string | null {
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
function broadcastEncounterUpdate(db: Db) {
  const state = buildState(db)

  const presentationWin = getPresentationWin()
  if (presentationWin && !presentationWin.isDestroyed()) {
    const safeState = {
      ...state,
      combatants: state.combatants
        // The lair entry is a DM reminder, not a creature the table sees.
        .filter((c) => !c.is_lair)
        .map((c) => (c.type === 'monster' ? { ...c, hp_current: null, hp_max: null, statblock: null } : { ...c, statblock: null }))
    }
    presentationWin.webContents.send('encounter:update', safeState)
  }

  const mainWin = getMainWin()
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('encounter:update', state)
  }
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

function d6(): number {
  return Math.floor(Math.random() * 6) + 1
}

// "Goblin 3" and "Goblin" share a base name — that's what a grouped
// initiative roll keys on.
function baseName(name: string): string {
  return name.replace(/\s+\d+$/, '').trim().toLowerCase()
}

// Tells the player whose turn it is (and who's next) — quietly skipped for
// monsters and for players who aren't connected.
function notifyTurn(db: Db, round: number): void {
  const state = buildState(db)
  const cur = state.combatants[state.currentIndex]
  const next = state.combatants.length > 1 ? state.combatants[(state.currentIndex + 1) % state.combatants.length] : null
  if (cur?.clientId && !cur.companion_id && isPlayerOnline(cur.clientId)) {
    sendCommand(cur.clientId, { cmd: 'turn', state: 'your_turn', round })
  }
  if (next?.clientId && !next.companion_id && next !== cur && isPlayerOnline(next.clientId)) {
    sendCommand(next.clientId, { cmd: 'turn', state: 'up_next', round })
  }
}

// ── Companions ──────────────────────────────────────────────────────────────
// A player's familiar, animal companion or summon takes its own place in the
// initiative order; its hit points stay on the owner's sheet.

function insertCompanion(db: Db, ownerClientId: string, companion: CompanionSnapshot, count: number): void {
  const init = d20() + (companion.init_mod ?? 0)
  db.prepare(
    `INSERT INTO encounter_combatants (id, name, type, party_member_id, hp_current, hp_max, ac, initiative, sort_order, conditions, init_mod, companion_id, owner_client_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    uuidv4(), companion.name, 'party', null, companion.hp_current, companion.hp_max, companion.ac, init, count, '[]',
    companion.init_mod ?? 0, companion.id, ownerClientId
  )
  logEvent('combat', `${companion.name} joins the fight (initiative ${init}).`)
}

function addCompanionsFor(db: Db, clientId: string | null): void {
  if (!clientId) return
  const live = getPlayers().find((p) => p.clientId === clientId)
  const companions = live?.snapshot.companions ?? []
  for (const c of companions) {
    if (!c.active) continue
    const exists = db.prepare('SELECT 1 FROM encounter_combatants WHERE owner_client_id=? AND companion_id=?').get(clientId, c.id)
    if (exists) continue
    const count = (db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }).c
    insertCompanion(db, clientId, c, count)
  }
}

// ── Starting a fight ────────────────────────────────────────────────────────

function autoInitiative(): boolean {
  return getSetting('encounter.autoInitiative') !== '0'
}

// Asks the connected players to roll their own initiative. `onlyMissing`
// leaves out anyone who already has a number.
function requestInitiative(db: Db, onlyMissing: boolean): number {
  let asked = 0
  for (const c of getSortedCombatants(db)) {
    if (c.type !== 'party' || c.companion_id || !c.party_member_id) continue
    if (onlyMissing && c.initiative != null) continue
    const clientId = clientIdFor(db, c.party_member_id)
    if (!clientId || !isPlayerOnline(clientId)) continue
    const res = sendCommand(clientId, {
      cmd: 'roll_request',
      rollId: uuidv4(),
      label: 'Initiative',
      kind: 'initiative',
      dc: null
    })
    if (res.ok) asked++
  }
  return asked
}

function startEncounter(db: Db): void {
  db.prepare('DELETE FROM encounter_combatants').run()
  db.prepare('DELETE FROM encounter_state WHERE id = 1').run()
  const gid = uuidv4()
  db.prepare('INSERT INTO encounter_state (id, is_active, round, current_index, log_id) VALUES (1, 1, 1, 0, ?)').run(gid)
  setLogGroup(gid)
  resetUndo()

  const members = db
    .prepare('SELECT id, name, client_id, initiative, sort_order FROM party_members ORDER BY sort_order')
    .all() as PartyMemberRow[]

  const auto = autoInitiative()
  members.forEach((m, i) => {
    const { hp_current, hp_max } = getLiveHp(m.client_id)
    // Players who are online roll fresh; last fight's number would be stale.
    const fresh = auto && !!m.client_id && isPlayerOnline(m.client_id)
    db.prepare(
      'INSERT INTO encounter_combatants (id, name, type, party_member_id, hp_current, hp_max, initiative, sort_order, conditions) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(uuidv4(), m.name, 'party', m.id, hp_current, hp_max, fresh ? null : (m.initiative ?? null), i, '[]')
  })
  for (const m of members) addCompanionsFor(db, m.client_id)

  logEvent('combat', 'Encounter started.', { title: 'Encounter' })
  if (auto) {
    const asked = requestInitiative(db, true)
    if (asked > 0) logEvent('combat', `Asked ${asked} player${asked === 1 ? '' : 's'} to roll initiative.`)
  }
}

// Adds one or several copies of a monster. With count > 1 they're numbered
// ("Goblin 1", "Goblin 2", …); `rollInitiative` rolls d20 + modifier for
// each, or once for the whole group when `grouped` is set (the usual
// shortcut for a pack of identical creatures).
function insertMonsters(db: Db, data: MonsterInit): void {
  const qty = Math.max(1, Math.min(30, Math.floor(data.count ?? 1)))
  const mod = data.init_mod ?? 0
  const groupRoll = data.rollInitiative && data.grouped ? d20() + mod : null
  let count = (db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }).c

  // Continue numbering from any existing copies so adding "2 more goblins"
  // mid-fight doesn't create a second "Goblin 1".
  const existingSame = (db.prepare('SELECT name FROM encounter_combatants').all() as { name: string }[])
    .filter((r) => baseName(r.name) === data.name.trim().toLowerCase()).length
  const numbered = qty > 1 || existingSame > 0

  const legendary = Math.max(0, Math.floor(data.legendary_actions ?? 0))
  const legRes = Math.max(0, Math.floor(data.legendary_resistances ?? 0))
  const statblock = data.statblock ? JSON.stringify(data.statblock) : ''

  for (let i = 0; i < qty; i++) {
    const init =
      groupRoll != null ? groupRoll
      : data.rollInitiative ? d20() + mod
      : data.initiative ?? null
    const recharges: Recharge[] = (data.recharges ?? []).map((r) => ({ id: uuidv4(), name: r.name, min: r.min, ready: true }))
    db.prepare(
      `INSERT INTO encounter_combatants
       (id, name, type, hp_current, hp_max, ac, initiative, sort_order, conditions, init_mod, xp,
        legendary_max, legendary_current, legres_max, legres_current, recharges, statblock)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
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
      data.xp ?? 0,
      legendary, legendary, legRes, legRes, JSON.stringify(recharges), statblock
    )
  }
  logEvent('combat', `${qty > 1 ? `${qty} × ` : ''}${data.name.trim()} joined the fight.`)

  if (data.lair) insertLair(db, data.name.trim(), count++)
}

function insertLair(db: Db, ownerName: string, sortOrder: number): void {
  const exists = db.prepare('SELECT 1 FROM encounter_combatants WHERE is_lair = 1 AND name = ?').get(`${ownerName} — Lair`)
  if (exists) return
  db.prepare(
    `INSERT INTO encounter_combatants (id, name, type, initiative, sort_order, conditions, is_lair)
     VALUES (?,?,?,?,?,?,1)`
  ).run(uuidv4(), `${ownerName} — Lair`, 'monster', 20, sortOrder, '[]')
}

// A fight, from the Encounter builder. Quantity, numbering and initiative are
// the same as adding monsters by hand.
export interface SavedEntry extends MonsterInit {
  count: number
}

export function launchEncounter(db: Db, entries: SavedEntry[]): void {
  startEncounter(db)
  for (const e of entries) insertMonsters(db, { ...e, rollInitiative: true, grouped: e.count > 1 })
}

// ── Concentration & snapshots ───────────────────────────────────────────────

const lastDmHp = new Map<string, number>() // clientId → when the DM last pushed damage/healing to them
const lastVitals = new Map<string, { hp: number | null; successes: number; failures: number }>()

// Dropping to 0, stabilising and dying happen on the player's sheet whoever
// caused them, so they're noticed here, from consecutive snapshots.
function logVitalsChange(clientId: string, snapshot: PlayerSnapshot): void {
  const now = { hp: snapshot.hp_current, successes: snapshot.death_save_successes ?? 0, failures: snapshot.death_save_failures ?? 0 }
  const prev = lastVitals.get(clientId)
  lastVitals.set(clientId, now)
  if (!prev) return
  const name = snapshot.name || 'A player'
  if (prev.hp != null && prev.hp > 0 && now.hp != null && now.hp <= 0) logEvent('death', `${name} dropped to 0 HP.`)
  if (prev.successes < 3 && now.successes >= 3 && (now.hp ?? 1) <= 0) logEvent('death', `${name} stabilised.`)
  if (prev.failures < 3 && now.failures >= 3) logEvent('death', `${name} has died.`)
  if (prev.hp != null && prev.hp <= 0 && now.hp != null && now.hp > 0) logEvent('death', `${name} is back on their feet (${now.hp} HP).`)
}

// Called for every snapshot from a connected player. Mirrors their sheet into
// the fight (HP, AC, conditions, concentration, companions) and, when they
// changed something themselves, tells the log. The previous values are the
// combatant's own row, so there's no separate cache to go stale.
export function syncFromSnapshot(partyMemberId: string, clientId: string, snapshot: PlayerSnapshot): void {
  const db = getDb()
  logVitalsChange(clientId, snapshot)
  const state = getStateRow(db)
  if (!state || state.is_active !== 1) return

  const c = db
    .prepare("SELECT * FROM encounter_combatants WHERE party_member_id = ? AND type = 'party' AND companion_id IS NULL")
    .get(partyMemberId) as CombatantRow | undefined
  if (c) {
    const prevHp = c.hp_current
    const conditions = Array.isArray(snapshot.conditions) ? snapshot.conditions : []
    const prevConditions = parseJson<string[]>(c.conditions, [])
    const concentrating = snapshot.concentration ? 1 : 0
    db.prepare(
      'UPDATE encounter_combatants SET hp_current=?, hp_max=?, ac=COALESCE(?, ac), conditions=?, concentrating=?, concentration_spell=? WHERE id=?'
    ).run(
      snapshot.hp_current, snapshot.hp_max, snapshot.ac ?? null, JSON.stringify(conditions), concentrating,
      snapshot.concentration ?? '', c.id
    )

    // The player did this themselves (a DM-applied change was logged at the time).
    const dmRecent = Date.now() - (lastDmHp.get(clientId) ?? 0) < 4000
    if (!dmRecent && prevHp != null && snapshot.hp_current != null && prevHp !== snapshot.hp_current) {
      const diff = snapshot.hp_current - prevHp
      logEvent(diff < 0 ? 'damage' : 'heal', `${c.name} ${diff < 0 ? 'took' : 'regained'} ${Math.abs(diff)} HP (now ${snapshot.hp_current}/${snapshot.hp_max ?? '?'}).`, {
        amount: Math.abs(diff), target: c.name
      })
    }
    for (const cond of conditions) if (!prevConditions.includes(cond)) logEvent('condition', `${c.name} is ${cond}.`)
    for (const cond of prevConditions) if (!conditions.includes(cond)) logEvent('condition', `${c.name} is no longer ${cond}.`)
  }

  // Companions: keep HP/AC/name in step, bring in newly summoned ones, drop
  // dismissed ones.
  const companions = snapshot.companions ?? []
  const mine = db.prepare('SELECT * FROM encounter_combatants WHERE owner_client_id = ? AND companion_id IS NOT NULL').all(clientId) as CombatantRow[]
  for (const row of mine) {
    const live = companions.find((x) => x.id === row.companion_id)
    if (!live || !live.active) {
      db.prepare('DELETE FROM encounter_combatants WHERE id=?').run(row.id)
      db.prepare('DELETE FROM map_tokens WHERE combatant_id=?').run(row.id)
      logEvent('combat', `${row.name} leaves the fight.`)
    } else {
      db.prepare('UPDATE encounter_combatants SET name=?, hp_current=?, hp_max=?, ac=? WHERE id=?').run(
        live.name, live.hp_current, live.hp_max, live.ac, row.id
      )
      if (live.hp_current != null && live.hp_current <= 0 && row.hp_current != null && row.hp_current > 0) logEvent('death', `${live.name} dropped to 0 HP.`)
    }
  }
  if (c) addCompanionsFor(db, clientId)

  broadcastEncounterUpdate(db)
}

// Initiative rolled on a player's own device.
export function applyInitiativeRoll(roll: RollResult): void {
  const db = getDb()
  const member = db.prepare('SELECT id, name FROM party_members WHERE client_id = ?').get(roll.clientId) as { id: string; name: string } | undefined
  if (!member) return
  db.prepare('UPDATE party_members SET initiative = ? WHERE id = ?').run(roll.total, member.id)
  const state = getStateRow(db)
  if (state?.is_active === 1) {
    db.prepare("UPDATE encounter_combatants SET initiative=? WHERE party_member_id=? AND companion_id IS NULL").run(roll.total, member.id)
    broadcastEncounterUpdate(db)
  }
}

export function registerEncounterHandlers(): void {
  // Picks the current fight's log group back up after a restart.
  try {
    const s = getStateRow(getDb())
    if (s?.is_active === 1 && s.log_id) setLogGroup(s.log_id)
  } catch { /* database not ready — tests register handlers first */ }

  ipcMain.handle('encounter:getState', () => buildState(getDb()))

  ipcMain.handle('encounter:start', () => {
    const db = getDb()
    startEncounter(db)
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  ipcMain.handle('encounter:end', () => {
    const db = getDb()
    const stateRow = getStateRow(db)
    const defeated = getSortedCombatants(db).filter((c) => c.type === 'monster' && !c.is_lair && c.hp_current != null && c.hp_current <= 0).length
    logEvent('combat', `Encounter ended after ${stateRow?.round ?? 1} round${(stateRow?.round ?? 1) === 1 ? '' : 's'}${defeated ? ` — ${defeated} defeated` : ''}.`, {
      rounds: stateRow?.round ?? 1
    })
    db.prepare('DELETE FROM encounter_combatants').run()
    db.prepare('UPDATE encounter_state SET is_active=0, round=1, current_index=0, log_id=\'\' WHERE id=1').run()
    setLogGroup('')
    resetUndo()
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

    const before = takeSnapshot(db)
    const count = (
      db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }
    ).c
    const { hp_current, hp_max } = getLiveHp(member.client_id)
    const fresh = autoInitiative() && !!member.client_id && isPlayerOnline(member.client_id)
    db.prepare(
      'INSERT INTO encounter_combatants (id, name, type, party_member_id, hp_current, hp_max, initiative, sort_order, conditions) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(uuidv4(), member.name, 'party', member.id, hp_current, hp_max, fresh ? null : (member.initiative ?? null), count, '[]')
    addCompanionsFor(db, member.client_id)
    if (fresh) requestInitiative(db, true)
    logEvent('combat', `${member.name} joined the fight.`)
    pushUndo({ label: `Add ${member.name}`, before })

    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  ipcMain.handle('encounter:addMonster', (_e, data: MonsterInit) => {
    const db = getDb()
    const before = takeSnapshot(db)
    insertMonsters(db, data)
    pushUndo({ label: `Add ${data.name.trim()}`, before })
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  // A "Lair actions" turn on initiative 20 — a reminder that the place itself acts.
  ipcMain.handle('encounter:addLair', (_e, ownerName?: string) => {
    const db = getDb()
    const before = takeSnapshot(db)
    const count = (db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }).c
    insertLair(db, (ownerName ?? 'Lair').trim() || 'Lair', count)
    pushUndo({ label: 'Add lair actions', before })
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  // Rolls d20 + modifier for monsters that don't have an initiative yet (or
  // all of them with `force`). Party members roll on their own devices.
  ipcMain.handle('encounter:rollMonsterInitiative', (_e, opts: { force?: boolean; grouped?: boolean }) => {
    const db = getDb()
    const before = takeSnapshot(db)
    const monsters = getSortedCombatants(db).filter((c) => c.type === 'monster' && !c.is_lair && (opts.force || c.initiative == null))
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
    if (monsters.length) pushUndo({ label: 'Roll monster initiative', before })
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  // Asks every connected player who hasn't rolled to roll initiative (or
  // everyone, with `all`).
  ipcMain.handle('encounter:requestInitiative', (_e, opts?: { all?: boolean }) => {
    const db = getDb()
    const asked = requestInitiative(db, !opts?.all)
    if (asked > 0) logEvent('combat', `Asked ${asked} player${asked === 1 ? '' : 's'} to roll initiative.`)
    return { asked }
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
        concentration_spell: string
        initiative: number | null
        init_mod: number
        xp: number
        name: string
        ac: number | null
        legendary_max: number
        legendary_current: number
        legres_max: number
        legres_current: number
        recharges: Recharge[]
      }>,
      label?: string
    ) => {
      const db = getDb()
      const existing = db
        .prepare('SELECT * FROM encounter_combatants WHERE id=?')
        .get(id) as CombatantRow | undefined
      if (!existing) return buildState(db)
      const before = takeSnapshot(db)

      const name = 'name' in changes ? (changes.name ?? existing.name) : existing.name
      const hp = 'hp_current' in changes ? changes.hp_current ?? null : existing.hp_current
      const hpMax = 'hp_max' in changes ? changes.hp_max ?? null : existing.hp_max
      const conditions =
        'conditions' in changes
          ? JSON.stringify(changes.conditions ?? [])
          : existing.conditions
      const effects = 'effects' in changes ? JSON.stringify(changes.effects ?? []) : existing.effects
      const concentrating = 'concentrating' in changes ? (changes.concentrating ? 1 : 0) : existing.concentrating
      const spell = 'concentration_spell' in changes ? (changes.concentration_spell ?? '') : concentrating ? existing.concentration_spell : ''
      const initiative =
        'initiative' in changes ? changes.initiative ?? null : existing.initiative
      const initMod = 'init_mod' in changes ? changes.init_mod ?? 0 : existing.init_mod
      const xp = 'xp' in changes ? changes.xp ?? 0 : existing.xp
      const ac = 'ac' in changes ? changes.ac ?? null : existing.ac
      const num = (k: 'legendary_max' | 'legendary_current' | 'legres_max' | 'legres_current'): number =>
        k in changes ? Math.max(0, Math.floor(Number(changes[k]) || 0)) : existing[k]
      const legMax = num('legendary_max')
      const legCur = Math.min(legMax, num('legendary_current'))
      const resMax = num('legres_max')
      const resCur = Math.min(resMax, num('legres_current'))
      const recharges = 'recharges' in changes ? JSON.stringify(changes.recharges ?? []) : existing.recharges

      db.prepare(
        `UPDATE encounter_combatants SET name=?, hp_current=?, hp_max=?, conditions=?, effects=?, concentrating=?, concentration_spell=?,
         initiative=?, init_mod=?, xp=?, ac=?, legendary_max=?, legendary_current=?, legres_max=?, legres_current=?, recharges=? WHERE id=?`
      ).run(name, hp, hpMax, conditions, effects, concentrating, spell, initiative, initMod, xp, ac, legMax, legCur, resMax, resCur, recharges, id)

      // What's worth a line in the log.
      if ('conditions' in changes) {
        const was = parseJson<string[]>(existing.conditions, [])
        const now = changes.conditions ?? []
        for (const cond of now) if (!was.includes(cond)) logEvent('condition', `${existing.name} is ${cond}.`)
        for (const cond of was) if (!now.includes(cond)) logEvent('condition', `${existing.name} is no longer ${cond}.`)
      }
      if ('concentrating' in changes && !!changes.concentrating !== (existing.concentrating === 1)) {
        logEvent('table', changes.concentrating ? `${existing.name} is concentrating${spell ? ` on ${spell}` : ''}.` : `${existing.name} stopped concentrating.`)
      }
      if ('hp_current' in changes && existing.type === 'monster' && hp != null && existing.hp_current != null && hp !== existing.hp_current) {
        const diff = hp - existing.hp_current
        logEvent(diff < 0 ? 'damage' : 'heal', `${existing.name} ${diff < 0 ? 'lost' : 'regained'} ${Math.abs(diff)} HP.`, { amount: Math.abs(diff), target: existing.name })
        if (hp <= 0) logEvent('death', `${existing.name} was defeated.`)
      }

      pushUndo({ label: label ?? `Edit ${existing.name}`, before })
      const state = buildState(db)
      broadcastEncounterUpdate(db)
      return state
    }
  )

  // Damage or healing from the DM. A party member whose app is connected gets
  // it pushed to their sheet (their snapshot then flows back and updates this
  // row, so both sides stay one source of truth); monsters and offline
  // players are adjusted here directly. `sourceId` is who dealt it, for the log.
  ipcMain.handle(
    'encounter:applyHp',
    (_e, id: string, amount: number, mode: 'normal' | 'half' | 'double' = 'normal', sourceId?: string | null) => {
      const db = getDb()
      const c = db.prepare('SELECT * FROM encounter_combatants WHERE id=?').get(id) as CombatantRow | undefined
      if (!c || !Number.isFinite(amount) || amount === 0) return { ...buildState(db), note: undefined as string | undefined }

      const isDamage = amount < 0
      const scaled = isDamage
        ? -Math.max(0, Math.floor(Math.abs(amount) * (mode === 'half' ? 0.5 : mode === 'double' ? 2 : 1)))
        : amount
      if (scaled === 0) return { ...buildState(db), note: 'Resisted to 0 damage.' as string | undefined }

      const before = takeSnapshot(db)
      const undoCmds: PlayerCmd[] = []
      const redoCmds: PlayerCmd[] = []
      let note: string | undefined
      let concentrationCheck: { combatantId: string; name: string; spell: string; dc: number; clientId: string | null } | undefined

      const source = sourceId && sourceId !== id ? (db.prepare('SELECT name FROM encounter_combatants WHERE id=?').get(sourceId) as { name: string } | undefined)?.name : undefined
      const dmgText = `${Math.abs(scaled)}${mode === 'half' ? ' (halved)' : mode === 'double' ? ' (doubled)' : ''}`

      const ownerId = c.companion_id ? c.owner_client_id : clientIdFor(db, c.party_member_id)
      let wentDown = false
      if (ownerId && isPlayerOnline(ownerId)) {
        const cmd = c.companion_id
          ? ({ cmd: 'companion_hp', companionId: c.companion_id, amount: scaled } as const)
          : ({ cmd: 'hp_delta', amount: scaled } as const)
        sendCommand(ownerId, cmd)
        lastDmHp.set(ownerId, Date.now())
        const inverse = c.companion_id
          ? ({ cmd: 'companion_hp', companionId: c.companion_id, amount: -scaled } as const)
          : ({ cmd: 'hp_delta', amount: -scaled } as const)
        redoCmds.push({ clientId: ownerId, command: cmd })
        undoCmds.push({ clientId: ownerId, command: inverse })
        note = `${isDamage ? 'Damage' : 'Healing'} sent to ${c.name}'s sheet.`
      } else {
        const base = c.hp_current ?? 0
        let next = base + scaled
        next = Math.max(0, next)
        if (c.hp_max != null) next = Math.min(c.hp_max, next)
        db.prepare('UPDATE encounter_combatants SET hp_current=? WHERE id=?').run(next, id)
        wentDown = base > 0 && next <= 0
        if (wentDown && c.concentrating === 1) {
          // Dropping to 0 ends concentration outright — no save to make.
          db.prepare("UPDATE encounter_combatants SET concentrating=0, concentration_spell='' WHERE id=?").run(id)
        }
      }

      logEvent(
        isDamage ? 'damage' : 'heal',
        isDamage
          ? `${source ? `${source} hit ` : ''}${c.name} for ${dmgText} damage.`
          : `${c.name} healed ${Math.abs(scaled)}.`,
        { amount: Math.abs(scaled), target: c.name, source: source ?? null }
      )
      if (wentDown) logEvent('death', c.type === 'monster' ? `${c.name} was defeated.` : `${c.name} dropped to 0 HP.`)

      if (isDamage && c.concentrating === 1 && !wentDown) {
        const dc = Math.max(10, Math.floor(Math.abs(scaled) / 2))
        concentrationCheck = { combatantId: id, name: c.name, spell: c.concentration_spell, dc, clientId: ownerId && isPlayerOnline(ownerId) ? ownerId : null }
        note = `${c.name} is concentrating — Constitution save, DC ${dc}.`
      }

      pushUndo({ label: `${isDamage ? 'Damage' : 'Heal'} ${c.name}`, before, undoCmds, redoCmds })
      broadcastEncounterUpdate(db)
      return { ...buildState(db), note, concentrationCheck }
    }
  )

  // The result of a concentration save the DM rolled (or adjudicated). Failing
  // ends the spell; for a player the sheet is told to drop it.
  ipcMain.handle('encounter:resolveConcentration', (_e, id: string, passed: boolean) => {
    const db = getDb()
    const c = db.prepare('SELECT * FROM encounter_combatants WHERE id=?').get(id) as CombatantRow | undefined
    if (!c) return buildState(db)
    if (!passed) {
      const before = takeSnapshot(db)
      db.prepare("UPDATE encounter_combatants SET concentrating=0, concentration_spell='' WHERE id=?").run(id)
      const ownerId = c.companion_id ? c.owner_client_id : clientIdFor(db, c.party_member_id)
      if (ownerId && isPlayerOnline(ownerId)) sendCommand(ownerId, { cmd: 'drop_concentration' })
      logEvent('table', `${c.name} lost concentration${c.concentration_spell ? ` on ${c.concentration_spell}` : ''}.`)
      pushUndo({ label: `${c.name} loses concentration`, before })
    } else {
      logEvent('table', `${c.name} kept concentration.`)
    }
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  // Bring a downed player back from the brink without healing them (Spare the
  // Dying, a successful Medicine check).
  ipcMain.handle('encounter:stabilize', (_e, id: string) => {
    const db = getDb()
    const c = db.prepare('SELECT * FROM encounter_combatants WHERE id=?').get(id) as CombatantRow | undefined
    if (c) {
      const clientId = clientIdFor(db, c.party_member_id)
      if (clientId && isPlayerOnline(clientId)) sendCommand(clientId, { cmd: 'stabilize' })
      logEvent('death', `${c.name} was stabilised.`)
    }
    return buildState(db)
  })

  // ── Boss-fight tracking ───────────────────────────────────────────────────

  ipcMain.handle('encounter:spendLegendary', (_e, id: string, cost = 1) => {
    const db = getDb()
    const c = db.prepare('SELECT * FROM encounter_combatants WHERE id=?').get(id) as CombatantRow | undefined
    if (!c || c.legendary_max <= 0) return buildState(db)
    const before = takeSnapshot(db)
    const next = Math.max(0, c.legendary_current - Math.max(1, Math.floor(cost)))
    db.prepare('UPDATE encounter_combatants SET legendary_current=? WHERE id=?').run(next, id)
    logEvent('boss', `${c.name} spent ${cost} legendary action${cost === 1 ? '' : 's'} (${next} left).`)
    pushUndo({ label: `${c.name} legendary action`, before })
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  ipcMain.handle('encounter:useLegendaryResistance', (_e, id: string) => {
    const db = getDb()
    const c = db.prepare('SELECT * FROM encounter_combatants WHERE id=?').get(id) as CombatantRow | undefined
    if (!c || c.legres_max <= 0) return buildState(db)
    const before = takeSnapshot(db)
    const next = Math.max(0, c.legres_current - 1)
    db.prepare('UPDATE encounter_combatants SET legres_current=? WHERE id=?').run(next, id)
    logEvent('boss', `${c.name} used a Legendary Resistance (${next} left).`)
    pushUndo({ label: `${c.name} legendary resistance`, before })
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  // Marks a recharge ability spent (true → ready false) or ready again by hand.
  ipcMain.handle('encounter:setRecharge', (_e, id: string, rechargeId: string, ready: boolean) => {
    const db = getDb()
    const c = db.prepare('SELECT * FROM encounter_combatants WHERE id=?').get(id) as CombatantRow | undefined
    if (!c) return buildState(db)
    const before = takeSnapshot(db)
    const list = parseJson<Recharge[]>(c.recharges, [])
    const target = list.find((r) => r.id === rechargeId)
    if (!target) return buildState(db)
    target.ready = ready
    db.prepare('UPDATE encounter_combatants SET recharges=? WHERE id=?').run(JSON.stringify(list), id)
    logEvent('boss', ready ? `${c.name}'s ${target.name} is ready.` : `${c.name} used ${target.name}.`)
    pushUndo({ label: `${c.name} ${target.name}`, before })
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  ipcMain.handle('encounter:removeCombatant', (_e, id: string) => {
    const db = getDb()
    const stateRow = getStateRow(db)
    const before = takeSnapshot(db)
    const sorted = getSortedCombatants(db)
    const removedIdx = sorted.findIndex((c) => c.id === id)
    const removed = sorted[removedIdx]

    db.prepare('DELETE FROM encounter_combatants WHERE id=?').run(id)
    db.prepare('DELETE FROM map_tokens WHERE combatant_id=?').run(id)

    if (stateRow && removedIdx !== -1 && removedIdx < stateRow.current_index) {
      const newIdx = Math.max(0, stateRow.current_index - 1)
      db.prepare('UPDATE encounter_state SET current_index=? WHERE id=1').run(newIdx)
    }
    if (removed) {
      logEvent('combat', `${removed.name} left the fight.`)
      pushUndo({ label: `Remove ${removed.name}`, before })
    }

    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  ipcMain.handle('encounter:nextTurn', () => {
    const db = getDb()
    const stateRow = getStateRow(db)
    const blank = { expired: [] as { name: string; label: string }[], recharged: [] as { name: string; ability: string; roll: number; ready: boolean }[], lair: null as string | null }
    if (!stateRow) return { ...buildState(db), ...blank }

    const combatants = getSortedCombatants(db)
    const count = combatants.length
    if (count === 0) return { ...buildState(db), ...blank }
    const before = takeSnapshot(db)

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
      for (const x of expired) logEvent('condition', `${x.label} ended on ${x.name}.`)
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
    if (nextRound !== stateRow.round) logEvent('turn', `Round ${nextRound} begins.`)

    // Start of the incoming creature's turn: legendary actions refresh, spent
    // recharge abilities roll to come back, a lair entry announces itself.
    const incoming = combatants[nextIdx]
    const recharged: { name: string; ability: string; roll: number; ready: boolean }[] = []
    let lair: string | null = null
    if (incoming) {
      logEvent('turn', `${incoming.name}'s turn.`)
      if (incoming.is_lair) {
        lair = incoming.name
        logEvent('boss', `Lair actions (${incoming.name}).`)
      }
      if (incoming.legendary_max > 0 && incoming.legendary_current !== incoming.legendary_max) {
        db.prepare('UPDATE encounter_combatants SET legendary_current=legendary_max WHERE id=?').run(incoming.id)
      }
      const list = parseJson<Recharge[]>(incoming.recharges, [])
      let changed = false
      for (const r of list) {
        if (r.ready) continue
        const roll = d6()
        const ready = roll >= r.min
        recharged.push({ name: incoming.name, ability: r.name, roll, ready })
        logEvent('boss', `${incoming.name} rolled ${roll} to recharge ${r.name}${ready ? ' — recharged!' : '.'}`)
        if (ready) { r.ready = true; changed = true }
      }
      if (changed) db.prepare('UPDATE encounter_combatants SET recharges=? WHERE id=?').run(JSON.stringify(list), incoming.id)
    }

    pushUndo({ label: 'Next turn', before })
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    notifyTurn(db, nextRound)
    return { ...state, expired, recharged, lair }
  })

  ipcMain.handle('encounter:prevTurn', () => {
    const db = getDb()
    const stateRow = getStateRow(db)
    if (!stateRow) return buildState(db)

    const count = (
      db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }
    ).c
    if (count === 0) return buildState(db)
    const before = takeSnapshot(db)

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
    pushUndo({ label: 'Previous turn', before })

    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  // ── Undo / redo ───────────────────────────────────────────────────────────

  function applyStep(stepped: ReturnType<typeof stepBack>, kind: 'Undid' | 'Redid') {
    const db = getDb()
    if (!stepped) return { ...buildState(db), note: undefined as string | undefined }
    for (const m of stepped.maps) pushTokensToPlayers(m)
    for (const { clientId, command } of stepped.cmds) {
      if (isPlayerOnline(clientId)) {
        lastDmHp.set(clientId, Date.now())
        sendCommand(clientId, command)
      }
    }
    logEvent('table', `${kind}: ${stepped.label}.`)
    broadcastEncounterUpdate(db)
    return { ...buildState(db), note: `${kind}: ${stepped.label}` as string | undefined }
  }

  ipcMain.handle('encounter:undo', () => applyStep(stepBack(getDb()), 'Undid'))
  ipcMain.handle('encounter:redo', () => applyStep(stepForward(getDb()), 'Redid'))

  // ── Saved encounters (the builder) ────────────────────────────────────────

  // Condenses the current fight's monsters into saveable entries (one per
  // kind of creature, with a count).
  ipcMain.handle('encounter:saveCurrent', (_e, name: string) => {
    const db = getDb()
    const groups = new Map<string, SavedEntry>()
    for (const c of getSortedCombatants(db)) {
      if (c.type !== 'monster') continue
      if (c.is_lair) {
        const key = `lair:${baseName(c.name)}`
        if (!groups.has(key)) groups.set(key, { name: c.name.replace(/ — Lair$/, ''), count: 0, lair: true })
        continue
      }
      const key = baseName(c.name)
      const sb = c.statblock ? parseJson<unknown>(c.statblock, undefined) : undefined
      const existing = groups.get(key)
      if (existing) {
        existing.count++
        continue
      }
      groups.set(key, {
        name: c.name.replace(/\s+\d+$/, ''),
        count: 1,
        hp_max: c.hp_max ?? undefined,
        ac: c.ac ?? undefined,
        init_mod: c.init_mod,
        xp: c.xp,
        legendary_actions: c.legendary_max,
        legendary_resistances: c.legres_max,
        recharges: parseJson<Recharge[]>(c.recharges, []).map((r) => ({ name: r.name, min: r.min })),
        statblock: sb
      })
    }
    const entries = [...groups.values()].filter((e) => e.count > 0)
    // A lair entry belongs to the creature it was added with.
    for (const g of groups.values()) {
      if (g.lair) {
        const owner = entries.find((e) => e.name === g.name)
        if (owner) owner.lair = true
      }
    }
    const id = uuidv4()
    const now = new Date().toISOString()
    db.prepare('INSERT INTO saved_encounters (id, name, notes, entries, created_at, updated_at) VALUES (?,?,?,?,?,?)').run(
      id, (name || 'Encounter').trim(), '', JSON.stringify(entries), now, now
    )
    return { id, entries: entries.length }
  })

  ipcMain.handle('encounter:launchSaved', (_e, id: string) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM saved_encounters WHERE id=?').get(id) as { name: string; entries: string } | undefined
    if (!row) return buildState(db)
    launchEncounter(db, parseJson<SavedEntry[]>(row.entries, []))
    logEvent('combat', `Launched "${row.name}".`)
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  ipcMain.handle('encounter:launchEntries', (_e, entries: SavedEntry[]) => {
    const db = getDb()
    launchEncounter(db, Array.isArray(entries) ? entries : [])
    const state = buildState(db)
    broadcastEncounterUpdate(db)
    return state
  })

  // ── Fight summary → Timeline ──────────────────────────────────────────────

  ipcMain.handle('encounter:summary', () => {
    const gid = getLogGroup()
    const entries = gid ? listLog({ groupId: gid, limit: 2000 }) : []
    return summarizeFight(entries)
  })

  // ── Monster templates (the DM's own reusable stat blocks) ────────────────
  ipcMain.handle('monsters:list', () => {
    return (getDb().prepare('SELECT * FROM monster_templates ORDER BY name COLLATE NOCASE').all() as Record<string, unknown>[]).map((r) => ({
      ...r,
      lair: r.lair === 1,
      recharges: parseJson<unknown[]>(String(r.recharges ?? ''), []),
      statblock: r.statblock ? parseJson<unknown>(String(r.statblock), null) : null
    }))
  })

  ipcMain.handle(
    'monsters:save',
    (_e, m: {
      id?: string; name: string; ac?: number | null; hp?: number | null; init_mod?: number; cr?: string; xp?: number; notes?: string
      legendary_actions?: number; legendary_resistances?: number; recharges?: { name: string; min: number }[]; lair?: boolean; statblock?: unknown
    }) => {
      const db = getDb()
      // Saving from the quick form (name/AC/HP only) must not wipe the boss
      // fields the homebrew editor set earlier, so unspecified ones are kept.
      const byId = m.id ? db.prepare('SELECT id FROM monster_templates WHERE id=?').get(m.id) : undefined
      const byName = !byId ? (db.prepare('SELECT id FROM monster_templates WHERE name=? COLLATE NOCASE').get(m.name) as { id: string } | undefined) : undefined
      const id = m.id ?? byName?.id ?? uuidv4()
      const prior = db.prepare('SELECT * FROM monster_templates WHERE id=?').get(id) as Record<string, unknown> | undefined
      const pick = <T,>(given: T | undefined, key: string, fallback: T): T => (given !== undefined ? given : prior ? (prior[key] as T) : fallback)

      const legendary = Math.max(0, Math.floor(pick(m.legendary_actions, 'legendary_actions', 0)))
      const legRes = Math.max(0, Math.floor(pick(m.legendary_resistances, 'legendary_resistances', 0)))
      const recharges = JSON.stringify(m.recharges !== undefined ? m.recharges : parseJson<unknown[]>(String(prior?.recharges ?? ''), []))
      const lair = m.lair !== undefined ? (m.lair ? 1 : 0) : ((prior?.lair as number) ?? 0)
      const statblock = m.statblock !== undefined ? (m.statblock ? JSON.stringify(m.statblock) : '') : String(prior?.statblock ?? '')

      if (prior) {
        db.prepare(
          'UPDATE monster_templates SET name=?, ac=?, hp=?, init_mod=?, cr=?, xp=?, notes=?, legendary_actions=?, legendary_resistances=?, recharges=?, lair=?, statblock=? WHERE id=?'
        ).run(
          m.name, m.ac ?? null, m.hp ?? null, m.init_mod ?? 0, m.cr ?? '', m.xp ?? 0, m.notes ?? String(prior.notes ?? ''),
          legendary, legRes, recharges, lair, statblock, id
        )
      } else {
        db.prepare(
          'INSERT INTO monster_templates (id, name, ac, hp, init_mod, cr, xp, notes, created_at, legendary_actions, legendary_resistances, recharges, lair, statblock) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).run(
          id, m.name, m.ac ?? null, m.hp ?? null, m.init_mod ?? 0, m.cr ?? '', m.xp ?? 0, m.notes ?? '', new Date().toISOString(),
          legendary, legRes, recharges, lair, statblock
        )
      }
      const row = db.prepare('SELECT * FROM monster_templates WHERE id=?').get(id) as Record<string, unknown>
      return { ...row, lair: row.lair === 1, recharges: parseJson<unknown[]>(String(row.recharges ?? ''), []), statblock: row.statblock ? parseJson<unknown>(String(row.statblock), null) : null }
    }
  )

  ipcMain.handle('monsters:delete', (_e, id: string) => {
    getDb().prepare('DELETE FROM monster_templates WHERE id=?').run(id)
  })
}
