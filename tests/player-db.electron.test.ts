import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { invoke } from './stubs/electron'
import { initDb, getDb, closeDb } from '../player-client/src/main/db'
import { registerCharacterHandlers } from '../player-client/src/main/ipc/character'
import * as client from '../player-client/src/main/sync'
import * as server from '../src/main/server'

const dir = mkdtempSync(join(tmpdir(), 'lk-player-db-'))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function waitFor(cond: () => boolean, ms = 3000): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (cond()) return true
    await sleep(25)
  }
  return cond()
}

test.after(() => {
  client.disconnect()
  server.stopServer()
  try { closeDb() } catch { /* already closed */ }
  rmSync(dir, { recursive: true, force: true })
})

function cols(table: string): Set<string> {
  return new Set((getDb().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name))
}

test('a fresh player database has the v10 fields with sane defaults', async () => {
  initDb(dir)
  registerCharacterHandlers()
  const c = await invoke('character:get')
  assert.equal(c.xp, 0)
  for (const k of ['cp', 'sp', 'ep', 'pp']) assert.equal(c[k], 0)
  assert.equal(c.portrait_path, '')
  assert.equal(c.dm_join_code, '')
})

test('upgrading from schema v9 keeps the existing character', async () => {
  await invoke('character:save', { name: 'Thorn', level: 4 })
  const d = getDb()
  for (const col of ['xp', 'cp', 'sp', 'ep', 'pp', 'portrait_path', 'dm_join_code']) d.exec(`ALTER TABLE character DROP COLUMN ${col}`)
  d.prepare('UPDATE schema_version SET version = 9').run()
  closeDb()
  initDb(dir)
  assert.equal((getDb().prepare('SELECT version FROM schema_version').get() as { version: number }).version, 10)
  assert.ok(cols('character').has('portrait_path'))
  const c = await invoke('character:get')
  assert.equal(c.name, 'Thorn')
  assert.equal(c.level, 4)
  assert.equal(c.xp, 0)
})

test('XP, every coin type and the portrait path save, clamp at zero, and round-trip', async () => {
  let c = await invoke('character:save', { xp: 1250, cp: 7, sp: 3, ep: 1, pp: 2, gold: 40 })
  assert.deepEqual([c.xp, c.cp, c.sp, c.ep, c.pp, c.gold], [1250, 7, 3, 1, 2, 40])
  c = await invoke('character:save', { xp: -50, cp: -9 })
  assert.equal(c.xp, 0)
  assert.equal(c.cp, 0)
  c = await invoke('character:save', { portrait_path: 'C:/x/portrait.png' })
  assert.equal(c.portrait_path, 'C:/x/portrait.png')
  c = await invoke('character:save', { name: 'Thorn the Bold' }) // unrelated save leaves them alone
  assert.equal(c.portrait_path, 'C:/x/portrait.png')
  await invoke('character:save', { portrait_path: '', xp: 0 })
})

test('commands from a real DM server are applied to the real character', async () => {
  // Give the character something to take damage with.
  await invoke('character:save', { hp_current: 20, hp_max: 20, hp_temp: 3, spellcasting_ability: 'int_score' })
  await invoke('spellSlots:update', 1, { max: 4, current: 4 })

  server.configureAuth({ requireCode: true, joinCode: 'T3ST' })
  assert.ok(server.startServer().ok)
  const events: unknown[] = []
  client.connect(`127.0.0.1:${server.PARTY_SYNC_PORT}`, 't3st')
  assert.ok(await waitFor(() => client.getStatus().connected), 'connected with the code')

  const clientId = (getDb().prepare("SELECT client_id FROM character WHERE id='local'").get() as { client_id: string }).client_id
  assert.ok(clientId, 'character has a stable sync identity')

  const send = async (cmd: Parameters<typeof server.sendCommand>[1]) => {
    const r = server.sendCommand(clientId, cmd)
    assert.ok(r.ok, r.error)
    assert.ok(await waitFor(() => server.getCommandLog().some((a) => a.id === r.id)), `ack for ${cmd.cmd}`)
    events.push(server.getCommandLog().find((a) => a.id === r.id))
    return invoke('character:get')
  }

  // Damage: temp HP absorbs first.
  let c = await send({ cmd: 'hp_delta', amount: -7 })
  assert.equal(c.hp_temp, 0)
  assert.equal(c.hp_current, 16, '3 temp absorbed, 4 real damage')

  // Healing caps at max.
  c = await send({ cmd: 'hp_delta', amount: 50 })
  assert.equal(c.hp_current, 20)

  // Dropping to 0 starts a fresh death-save sequence; damage at 0 is a failed save.
  await invoke('character:save', { death_save_successes: 2, death_save_failures: 0 })
  c = await send({ cmd: 'hp_delta', amount: -999 })
  assert.equal(c.hp_current, 0)
  assert.equal(c.death_save_successes, 0)
  assert.equal(c.death_save_failures, 0)
  c = await send({ cmd: 'hp_delta', amount: -3 })
  assert.equal(c.death_save_failures, 1, 'damage at 0 HP counts as a failed death save')
  c = await send({ cmd: 'hp_delta', amount: 5 })
  assert.equal(c.hp_current, 5)
  assert.equal(c.death_save_failures, 0, 'being healed resets death saves')

  // Conditions.
  c = await send({ cmd: 'condition', condition: 'Poisoned', on: true })
  c = await send({ cmd: 'condition', condition: 'Prone', on: true })
  c = await send({ cmd: 'condition', condition: 'Poisoned', on: true }) // idempotent
  assert.deepEqual([...c.conditions].sort(), ['Poisoned', 'Prone'])
  c = await send({ cmd: 'condition', condition: 'Poisoned', on: false })
  assert.deepEqual(c.conditions, ['Prone'])

  // Coins add, and never go negative.
  await invoke('character:save', { gold: 10, sp: 5, pp: 0 })
  c = await send({ cmd: 'currency', gp: 50, sp: -999, pp: 2 })
  assert.equal(c.gold, 60)
  assert.equal(c.sp, 0)
  assert.equal(c.pp, 2)

  // XP and inspiration.
  c = await send({ cmd: 'xp', amount: 300 })
  assert.equal(c.xp, 300)
  c = await send({ cmd: 'inspiration', on: true })
  assert.equal(c.inspiration, true)

  // A weapon from the DM lands in the inventory and generates its action.
  c = await send({ cmd: 'give_item', name: 'Flame Tongue', quantity: 1, damage: '1d8', damage_type: 'slashing', notes: 'Magic' })
  const sword = c.inventory.find((i: { name: string }) => i.name === 'Flame Tongue')
  assert.ok(sword, 'item added')
  assert.ok(c.actions.some((a: { source_id: string; damage: string }) => a.source_id === sword.id && a.damage === '1d8'), 'weapon action generated')
  c = await send({ cmd: 'give_item', name: 'Rope', quantity: 2 })
  assert.equal(c.inventory.find((i: { name: string }) => i.name === 'Rope').quantity, 2)

  // Long rest restores slots and clears temp HP.
  await invoke('spellSlots:update', 1, { current: 0 })
  await invoke('character:save', { hp_temp: 8 })
  c = await send({ cmd: 'rest', kind: 'long' })
  assert.equal(c.spellSlots.find((s: { level: number }) => s.level === 1).current, 4)
  assert.equal(c.hp_temp, 0)

  // The DM sees the new fields in the next snapshot.
  assert.ok(await waitFor(() => (server.getPlayers().find((p) => p.clientId === clientId)?.snapshot.xp ?? -1) === 300), 'snapshot carries XP')
  const snap = server.getPlayers().find((p) => p.clientId === clientId)!.snapshot
  assert.equal(snap.hp_current, 5)
  assert.ok(snap.conditions.includes('Prone'))

  // Every command was acknowledged as a success.
  assert.ok(events.length >= 12 && events.every((e) => (e as { ok: boolean }).ok))
})

test('non-state commands (roll request, turn, handout) are acknowledged without touching the sheet', async () => {
  const clientId = (getDb().prepare("SELECT client_id FROM character WHERE id='local'").get() as { client_id: string }).client_id
  const before = await invoke('character:get')
  for (const cmd of [
    { cmd: 'roll_request', rollId: 'r1', label: 'Wisdom save', kind: 'save', ability: 'wis', dc: 13 },
    { cmd: 'turn', state: 'your_turn', round: 2 },
    { cmd: 'handout', title: 'A note', text: 'Meet at dawn.' },
    { cmd: 'notice', text: 'Short break' }
  ] as const) {
    const r = server.sendCommand(clientId, cmd as Parameters<typeof server.sendCommand>[1])
    assert.ok(await waitFor(() => server.getCommandLog().some((a) => a.id === r.id)), `ack for ${cmd.cmd}`)
  }
  const after = await invoke('character:get')
  assert.deepEqual(after.hp_current, before.hp_current)
  assert.deepEqual(after.inventory.length, before.inventory.length)
})

test('the saved join code and address are what the silent reconnect uses', async () => {
  const row = getDb().prepare("SELECT dm_server_address, dm_join_code FROM character WHERE id='local'").get() as { dm_server_address: string; dm_join_code: string }
  assert.equal(row.dm_server_address, `127.0.0.1:${server.PARTY_SYNC_PORT}`)
  assert.equal(row.dm_join_code, 'T3ST', 'normalised to upper case')
})
