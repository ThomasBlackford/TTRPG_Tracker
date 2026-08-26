import { ipcMain } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'
import { getPresentationWin } from './maps'

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
  initiative: number | null
  sort_order: number
}

function getSortedCombatants(db: ReturnType<typeof getDb>): CombatantRow[] {
  return db
    .prepare('SELECT * FROM encounter_combatants ORDER BY initiative DESC NULLS LAST, sort_order ASC')
    .all() as CombatantRow[]
}

function getStateRow(db: ReturnType<typeof getDb>): StateRow | undefined {
  return db.prepare('SELECT * FROM encounter_state WHERE id = 1').get() as StateRow | undefined
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
    })),
  }
}

function pushEncounterToPresentation(db: ReturnType<typeof getDb>) {
  const win = getPresentationWin()
  if (!win || win.isDestroyed()) return
  const state = buildState(db)
  // Strip HP from monsters for the TV display
  const safeState = {
    ...state,
    combatants: state.combatants.map((c) =>
      c.type === 'monster' ? { ...c, hp_current: null, hp_max: null } : c
    ),
  }
  win.webContents.send('encounter:update', safeState)
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
      .prepare('SELECT id, name, initiative, sort_order FROM party_members ORDER BY sort_order')
      .all() as PartyMemberRow[]

    members.forEach((m, i) => {
      db.prepare(
        'INSERT INTO encounter_combatants (id, name, type, party_member_id, initiative, sort_order, conditions) VALUES (?,?,?,?,?,?,?)'
      ).run(uuidv4(), m.name, 'party', m.id, m.initiative ?? null, i, '[]')
    })

    const state = buildState(db)
    pushEncounterToPresentation(db)
    return state
  })

  ipcMain.handle('encounter:end', () => {
    const db = getDb()
    db.prepare('DELETE FROM encounter_combatants').run()
    db.prepare(
      'UPDATE encounter_state SET is_active=0, round=1, current_index=0 WHERE id=1'
    ).run()
    const win = getPresentationWin()
    if (win && !win.isDestroyed()) win.webContents.send('encounter:update', null)
    return buildState(db)
  })

  ipcMain.handle('encounter:addPartyMember', (_e, memberId: string) => {
    const db = getDb()
    const member = db
      .prepare('SELECT id, name, initiative FROM party_members WHERE id=?')
      .get(memberId) as PartyMemberRow | undefined
    if (!member) return buildState(db)

    const exists = db
      .prepare('SELECT 1 FROM encounter_combatants WHERE party_member_id=?')
      .get(memberId)
    if (exists) return buildState(db)

    const count = (
      db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }
    ).c
    db.prepare(
      'INSERT INTO encounter_combatants (id, name, type, party_member_id, initiative, sort_order, conditions) VALUES (?,?,?,?,?,?,?)'
    ).run(uuidv4(), member.name, 'party', member.id, member.initiative ?? null, count, '[]')

    const state = buildState(db)
    pushEncounterToPresentation(db)
    return state
  })

  ipcMain.handle(
    'encounter:addMonster',
    (_e, data: { name: string; hp_max?: number; ac?: number; initiative?: number }) => {
      const db = getDb()
      const count = (
        db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }
      ).c
      db.prepare(
        'INSERT INTO encounter_combatants (id, name, type, hp_current, hp_max, ac, initiative, sort_order, conditions) VALUES (?,?,?,?,?,?,?,?,?)'
      ).run(
        uuidv4(),
        data.name,
        'monster',
        data.hp_max ?? null,
        data.hp_max ?? null,
        data.ac ?? null,
        data.initiative ?? null,
        count,
        '[]'
      )
      const state = buildState(db)
      pushEncounterToPresentation(db)
      return state
    }
  )

  ipcMain.handle(
    'encounter:updateCombatant',
    (
      _e,
      id: string,
      changes: Partial<{
        hp_current: number | null
        conditions: string[]
        initiative: number | null
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
      const conditions =
        'conditions' in changes
          ? JSON.stringify(changes.conditions ?? [])
          : existing.conditions
      const initiative =
        'initiative' in changes ? changes.initiative ?? null : existing.initiative
      const ac = 'ac' in changes ? changes.ac ?? null : existing.ac

      db.prepare(
        'UPDATE encounter_combatants SET name=?, hp_current=?, conditions=?, initiative=?, ac=? WHERE id=?'
      ).run(name, hp, conditions, initiative, ac, id)

      const state = buildState(db)
      pushEncounterToPresentation(db)
      return state
    }
  )

  ipcMain.handle('encounter:removeCombatant', (_e, id: string) => {
    const db = getDb()
    const stateRow = getStateRow(db)
    const before = getSortedCombatants(db)
    const removedIdx = before.findIndex((c) => c.id === id)

    db.prepare('DELETE FROM encounter_combatants WHERE id=?').run(id)

    if (stateRow && removedIdx !== -1 && removedIdx < stateRow.current_index) {
      const newIdx = Math.max(0, stateRow.current_index - 1)
      db.prepare('UPDATE encounter_state SET current_index=? WHERE id=1').run(newIdx)
    }

    const state = buildState(db)
    pushEncounterToPresentation(db)
    return state
  })

  ipcMain.handle('encounter:nextTurn', () => {
    const db = getDb()
    const stateRow = getStateRow(db)
    if (!stateRow) return buildState(db)

    const count = (
      db.prepare('SELECT COUNT(*) as c FROM encounter_combatants').get() as { c: number }
    ).c
    if (count === 0) return buildState(db)

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
    pushEncounterToPresentation(db)
    return state
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
    pushEncounterToPresentation(db)
    return state
  })
}
