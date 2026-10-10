import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { invoke } from './stubs/electron'
import { initDb, getDb, closeDb } from '../src/main/db'
import { getSetting, setSetting } from '../src/main/settings'
import { registerEncounterHandlers } from '../src/main/ipc/encounter'
import { registerTokenHandlers } from '../src/main/ipc/tokens'
import { registerPartySyncHandlers } from '../src/main/ipc/partySync'

const dir = mkdtempSync(join(tmpdir(), 'lk-dm-db-'))
test.after(() => {
  try { closeDb() } catch { /* already closed */ }
  rmSync(dir, { recursive: true, force: true })
})

function cols(table: string): Set<string> {
  return new Set((getDb().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name))
}

test('a fresh database is created at the latest schema', () => {
  initDb(dir)
  assert.equal((getDb().prepare('SELECT version FROM schema_version').get() as { version: number }).version, 6)
  for (const t of ['app_settings', 'monster_templates', 'map_tokens', 'encounter_combatants']) {
    assert.ok(cols(t).size > 0, `${t} exists`)
  }
  for (const c of ['init_mod', 'xp', 'effects', 'concentrating']) assert.ok(cols('encounter_combatants').has(c), `combatants.${c}`)
})

test('upgrading from schema v5 adds the new tables and columns without losing data', () => {
  const d = getDb()
  d.prepare("INSERT INTO party_members (id, name) VALUES ('pm1', 'Aria')").run()
  d.exec('DROP TABLE map_tokens; DROP TABLE monster_templates; DROP TABLE app_settings;')
  for (const c of ['init_mod', 'xp', 'effects', 'concentrating']) d.exec(`ALTER TABLE encounter_combatants DROP COLUMN ${c}`)
  d.prepare('UPDATE schema_version SET version = 5').run()
  closeDb()

  initDb(dir)
  const d2 = getDb()
  assert.equal((d2.prepare('SELECT version FROM schema_version').get() as { version: number }).version, 6)
  assert.ok(cols('map_tokens').size > 0 && cols('monster_templates').size > 0 && cols('app_settings').size > 0)
  assert.ok(cols('encounter_combatants').has('effects'))
  assert.equal((d2.prepare("SELECT name FROM party_members WHERE id='pm1'").get() as { name: string }).name, 'Aria')
})

test('app settings persist', () => {
  assert.equal(getSetting('missing.key'), null)
  setSetting('sync.joinCode', 'ABCD')
  setSetting('sync.joinCode', 'WXYZ') // overwrite
  assert.equal(getSetting('sync.joinCode'), 'WXYZ')
})

test('sync defaults to requiring a join code, with a 4-character code that never changes on its own', async () => {
  registerPartySyncHandlers()
  setSetting('sync.joinCode', '')
  const a = await invoke('partySync:status')
  assert.equal(a.requireCode, true)
  assert.match(a.joinCode, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/)
  const b = await invoke('partySync:status')
  assert.equal(b.joinCode, a.joinCode)
  const c = await invoke('partySync:regenerateCode')
  assert.match(c.joinCode, /^[A-Z2-9]{4}$/)
  const off = await invoke('partySync:setRequireCode', false)
  assert.equal(off.requireCode, false)
  const on = await invoke('partySync:setRequireCode', true)
  assert.equal(on.requireCode, true)
})

test('adding several monsters numbers them and continues numbering later', async () => {
  registerEncounterHandlers()
  await invoke('encounter:start')
  let s = await invoke('encounter:addMonster', { name: 'Goblin', hp_max: 7, ac: 15, init_mod: 2, xp: 50, count: 3 })
  const names = s.combatants.filter((c: { type: string }) => c.type === 'monster').map((c: { name: string }) => c.name).sort()
  assert.deepEqual(names, ['Goblin 1', 'Goblin 2', 'Goblin 3'])
  s = await invoke('encounter:addMonster', { name: 'Goblin', hp_max: 7, init_mod: 2, count: 2 })
  const after = s.combatants.map((c: { name: string }) => c.name)
  for (const n of ['Goblin 4', 'Goblin 5']) assert.ok(after.includes(n), `${n} added`)
  s = await invoke('encounter:addMonster', { name: 'Ogre', hp_max: 59, xp: 450 })
  assert.ok(s.combatants.some((c: { name: string }) => c.name === 'Ogre'), 'a single, first monster is not numbered')
})

test('a group initiative roll is shared across a pack and includes the modifier', async () => {
  const s = await invoke('encounter:addMonster', { name: 'Wolf', hp_max: 11, init_mod: 2, count: 4, rollInitiative: true, grouped: true })
  const wolves = s.combatants.filter((c: { name: string }) => c.name.startsWith('Wolf '))
  assert.equal(wolves.length, 4)
  const first = wolves[0].initiative
  assert.ok(first >= 3 && first <= 22, `d20+2 gave ${first}`)
  for (const w of wolves) assert.equal(w.initiative, first)

  // individual rolls: across many wolves they should not all match
  const s2 = await invoke('encounter:addMonster', { name: 'Rat', hp_max: 1, init_mod: 0, count: 20, rollInitiative: true, grouped: false })
  const rats = s2.combatants.filter((c: { name: string }) => c.name.startsWith('Rat '))
  assert.ok(new Set(rats.map((r: { initiative: number }) => r.initiative)).size > 3, 'individual rolls differ')
  for (const r of rats) assert.ok(r.initiative >= 1 && r.initiative <= 20)

  const re = await invoke('encounter:rollMonsterInitiative', { force: true, grouped: true })
  const goblins = re.combatants.filter((c: { name: string }) => c.name.startsWith('Goblin '))
  assert.equal(new Set(goblins.map((g: { initiative: number }) => g.initiative)).size, 1, 're-roll keeps the group together')
})

test('damage modes, healing caps, and concentration prompts', async () => {
  let s = await invoke('encounter:addMonster', { name: 'Test Dummy', hp_max: 40 })
  const dummy = s.combatants.find((c: { name: string }) => c.name === 'Test Dummy')
  s = await invoke('encounter:applyHp', dummy.id, -10, 'normal')
  assert.equal(s.combatants.find((c: { id: string }) => c.id === dummy.id).hp_current, 30)
  s = await invoke('encounter:applyHp', dummy.id, -10, 'half')
  assert.equal(s.combatants.find((c: { id: string }) => c.id === dummy.id).hp_current, 25)
  s = await invoke('encounter:applyHp', dummy.id, -5, 'double')
  assert.equal(s.combatants.find((c: { id: string }) => c.id === dummy.id).hp_current, 15)
  s = await invoke('encounter:applyHp', dummy.id, 100, 'normal')
  assert.equal(s.combatants.find((c: { id: string }) => c.id === dummy.id).hp_current, 40, 'healing caps at max')
  s = await invoke('encounter:applyHp', dummy.id, -999, 'normal')
  assert.equal(s.combatants.find((c: { id: string }) => c.id === dummy.id).hp_current, 0, 'never below zero')

  await invoke('encounter:updateCombatant', dummy.id, { hp_current: 40, concentrating: true })
  s = await invoke('encounter:applyHp', dummy.id, -30, 'normal')
  assert.match(s.note, /Constitution save, DC 15/, 'DC is half the damage when that beats 10')
  await invoke('encounter:updateCombatant', dummy.id, { hp_current: 40 })
  s = await invoke('encounter:applyHp', dummy.id, -8, 'normal')
  assert.match(s.note, /DC 10/, 'DC floor is 10')
})

test('timed effects tick down at the end of the creature\'s own turn and then expire', async () => {
  // Start from a clean fight with one monster so turn order is unambiguous.
  getDb().prepare('DELETE FROM party_members').run() // keep turn order to just the two monsters below
  await invoke('encounter:end')
  await invoke('encounter:start')
  let s = await invoke('encounter:addMonster', { name: 'Cultist', hp_max: 9, initiative: 15 })
  const cultist = s.combatants.find((c: { name: string }) => c.name === 'Cultist')
  s = await invoke('encounter:addMonster', { name: 'Bandit', hp_max: 11, initiative: 5 })
  await invoke('encounter:updateCombatant', cultist.id, {
    effects: [
      { id: 'e1', label: 'Hold Person', rounds: 2 },
      { id: 'e2', label: 'Hex', rounds: null }
    ]
  })
  // Cultist (15) is first. End its turn → Hold Person 2→1.
  let n = await invoke('encounter:nextTurn')
  let c = n.combatants.find((x: { id: string }) => x.id === cultist.id)
  assert.equal(c.effects.find((e: { id: string }) => e.id === 'e1').rounds, 1)
  assert.equal(n.expired.length, 0)
  // Bandit's turn ends, then back to the Cultist → another full round; end Cultist's turn again → expires.
  await invoke('encounter:nextTurn')
  n = await invoke('encounter:nextTurn')
  c = n.combatants.find((x: { id: string }) => x.id === cultist.id)
  assert.equal(c.effects.some((e: { id: string }) => e.id === 'e1'), false, 'Hold Person removed')
  assert.ok(c.effects.some((e: { id: string }) => e.id === 'e2'), 'indefinite Hex stays')
  assert.deepEqual(n.expired, [{ name: 'Cultist', label: 'Hold Person' }])
})

test('tokens: placing the encounter, hiding from players, and cleanup when a combatant leaves', async () => {
  registerTokenHandlers()
  const d = getDb()
  d.prepare("INSERT INTO maps (id, name, created_at, updated_at) VALUES ('map1', 'Cave', 'now', 'now')").run()

  let tokens = await invoke('tokens:placeCombatants', 'map1')
  const combatants = (await invoke('encounter:getState')).combatants
  assert.equal(tokens.length, combatants.length, 'one token per combatant')
  assert.ok(tokens.every((t: { x: number; y: number }) => t.x >= 0 && t.x <= 1 && t.y >= 0 && t.y <= 1))
  assert.ok(tokens.some((t: { kind: string }) => t.kind === 'monster'))

  tokens = await invoke('tokens:placeCombatants', 'map1')
  assert.equal(tokens.length, combatants.length, 'placing twice does not duplicate')

  const t0 = tokens[0]
  tokens = await invoke('tokens:save', { id: t0.id, map_id: 'map1', x: 0.9, y: 0.1, hidden: true, size: 2 })
  const saved = tokens.find((t: { id: string }) => t.id === t0.id)
  assert.equal(saved.x, 0.9)
  assert.equal(saved.hidden, true)
  assert.equal(saved.size, 2)
  assert.equal(saved.name, t0.name, 'a partial save keeps the other fields')

  const victim = combatants.find((c: { id: string }) => c.id === t0.combatant_id)
  await invoke('encounter:removeCombatant', victim.id)
  assert.equal((await invoke('tokens:list', 'map1')).some((t: { combatant_id: string }) => t.combatant_id === victim.id), false)

  const manual = await invoke('tokens:save', { map_id: 'map1', name: 'Mystery', kind: 'npc' })
  assert.ok(manual.some((t: { name: string }) => t.name === 'Mystery'))
  const left = await invoke('tokens:delete', manual.find((t: { name: string }) => t.name === 'Mystery').id)
  assert.equal(left.some((t: { name: string }) => t.name === 'Mystery'), false)
})

test('the monster library saves, updates and deletes', async () => {
  const m = await invoke('monsters:save', { name: 'Homebrew Horror', hp: 99, ac: 17, init_mod: 3, cr: '5', xp: 1800 })
  assert.equal(m.name, 'Homebrew Horror')
  await invoke('monsters:save', { id: m.id, name: 'Homebrew Horror', hp: 120, ac: 17 })
  const list = await invoke('monsters:list')
  assert.equal(list.filter((x: { id: string }) => x.id === m.id).length, 1)
  assert.equal(list.find((x: { id: string }) => x.id === m.id).hp, 120)
  await invoke('monsters:delete', m.id)
  assert.equal((await invoke('monsters:list')).some((x: { id: string }) => x.id === m.id), false)
})
