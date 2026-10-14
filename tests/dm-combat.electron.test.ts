import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { invoke } from './stubs/electron'
import { initDb, getDb, closeDb } from '../src/main/db'
import { registerEncounterHandlers, applyInitiativeRoll } from '../src/main/ipc/encounter'
import { registerLibraryHandlers } from '../src/main/ipc/library'
import { listLog } from '../src/main/sessionLog'

const dir = mkdtempSync(join(tmpdir(), 'lk-dm-combat-'))
test.after(() => {
  try { closeDb() } catch { /* already closed */ }
  rmSync(dir, { recursive: true, force: true })
})

type C = { id: string; name: string; hp_current: number | null; initiative: number | null; legendary_current: number; legres_current: number; legendary_max: number; is_lair: boolean; concentrating: boolean; recharges: { id: string; name: string; min: number; ready: boolean }[] }
const find = (s: { combatants: C[] }, name: string): C => s.combatants.find((c) => c.name === name)!

test('setup', async () => {
  initDb(dir)
  registerEncounterHandlers()
  registerLibraryHandlers()
  await invoke('encounter:start')
})

test('a boss comes in with legendary actions, resistances, a recharge ability and a lair turn on initiative 20', async () => {
  const s = await invoke('encounter:addMonster', {
    name: 'Red Dragon', hp_max: 256, ac: 19, xp: 18000, initiative: 12,
    legendary_actions: 3, legendary_resistances: 3, recharges: [{ name: 'Fire Breath', min: 5 }], lair: true
  })
  const dragon = find(s, 'Red Dragon')
  assert.equal(dragon.legendary_max, 3)
  assert.equal(dragon.legendary_current, 3)
  assert.equal(dragon.legres_current, 3)
  assert.equal(dragon.recharges.length, 1)
  assert.equal(dragon.recharges[0].ready, true)
  const lair = s.combatants.find((c: C) => c.is_lair)!
  assert.equal(lair.initiative, 20)
  assert.equal(s.combatants[0].id, lair.id, 'the lair acts first, on 20')
})

test('legendary actions and resistances are spent and tracked; they refresh on the creature\'s own turn', async () => {
  let s = await invoke('encounter:getState')
  const dragon = find(s, 'Red Dragon')
  s = await invoke('encounter:spendLegendary', dragon.id, 2)
  assert.equal(find(s, 'Red Dragon').legendary_current, 1)
  s = await invoke('encounter:spendLegendary', dragon.id, 5)
  assert.equal(find(s, 'Red Dragon').legendary_current, 0, 'never below zero')
  s = await invoke('encounter:useLegendaryResistance', dragon.id)
  assert.equal(find(s, 'Red Dragon').legres_current, 2)

  // Order: Lair (20), Dragon (12). Move onto the dragon's turn.
  s = await invoke('encounter:nextTurn')
  assert.equal(s.lair, null)
  assert.equal(find(s, 'Red Dragon').legendary_current, 3, 'refreshed at the start of its turn')
  assert.equal(find(s, 'Red Dragon').legres_current, 2, 'resistances do not refresh')
})

test('spent recharge abilities roll to come back at the start of the creature\'s turn', async () => {
  let s = await invoke('encounter:getState')
  const dragon = find(s, 'Red Dragon')
  s = await invoke('encounter:setRecharge', dragon.id, dragon.recharges[0].id, false)
  assert.equal(find(s, 'Red Dragon').recharges[0].ready, false)

  let sawReady = false
  let sawSpent = false
  for (let i = 0; i < 40 && !(sawReady && sawSpent); i++) {
    // Cycle back around to the dragon (lair, dragon, lair, dragon…).
    s = await invoke('encounter:nextTurn') // → lair (new round)
    assert.match(s.lair, /Red Dragon — Lair/)
    s = await invoke('encounter:nextTurn') // → dragon
    const roll = s.recharged[0]
    if (!roll) { sawReady = true; continue } // it had already recharged
    assert.equal(roll.ready, roll.roll >= 5, `rolled ${roll.roll}`)
    assert.ok(roll.roll >= 1 && roll.roll <= 6)
    if (roll.ready) { sawReady = true; assert.equal(find(s, 'Red Dragon').recharges[0].ready, true) }
    else { sawSpent = true; assert.equal(find(s, 'Red Dragon').recharges[0].ready, false) }
    if (find(s, 'Red Dragon').recharges[0].ready) {
      s = await invoke('encounter:setRecharge', dragon.id, dragon.recharges[0].id, false) // spend it again to keep testing
    }
  }
  assert.ok(sawReady && sawSpent, 'over many turns it both recharges and stays spent')
})

test('undo and redo walk back damage, turns and removals exactly', async () => {
  await invoke('encounter:end')
  await invoke('encounter:start')
  let s = await invoke('encounter:addMonster', { name: 'Ogre', hp_max: 59, initiative: 10 })
  const ogre = find(s, 'Ogre')
  assert.equal(s.undo.canUndo, true)

  s = await invoke('encounter:applyHp', ogre.id, -20, 'normal')
  assert.equal(find(s, 'Ogre').hp_current, 39)
  assert.match(s.undo.undoLabel, /Damage Ogre/)

  s = await invoke('encounter:undo')
  assert.equal(find(s, 'Ogre').hp_current, 59)
  assert.equal(s.undo.canRedo, true)
  s = await invoke('encounter:redo')
  assert.equal(find(s, 'Ogre').hp_current, 39)

  s = await invoke('encounter:removeCombatant', ogre.id)
  assert.equal(s.combatants.some((c: C) => c.name === 'Ogre'), false)
  s = await invoke('encounter:undo')
  const back = find(s, 'Ogre')
  assert.ok(back, 'removed monster comes back')
  assert.equal(back.hp_current, 39, 'with the HP it had')

  // A new action clears what could be redone.
  s = await invoke('encounter:undo')
  s = await invoke('encounter:applyHp', ogre.id, -1, 'normal')
  assert.equal(s.undo.canRedo, false)

  // Ending a fight discards history (it can't apply to the next one).
  s = await invoke('encounter:end')
  assert.equal(s.undo.canUndo, false)
})

test('a concentrating creature gets a save prompt, and dropping to 0 ends concentration with none', async () => {
  await invoke('encounter:start')
  let s = await invoke('encounter:addMonster', { name: 'Mage', hp_max: 40 })
  const mage = find(s, 'Mage')
  await invoke('encounter:updateCombatant', mage.id, { concentrating: true, concentration_spell: 'Hold Person' })

  s = await invoke('encounter:applyHp', mage.id, -30, 'normal')
  assert.deepEqual(
    { name: s.concentrationCheck.name, spell: s.concentrationCheck.spell, dc: s.concentrationCheck.dc },
    { name: 'Mage', spell: 'Hold Person', dc: 15 }
  )

  s = await invoke('encounter:resolveConcentration', mage.id, false)
  assert.equal(find(s, 'Mage').concentrating, false)

  await invoke('encounter:updateCombatant', mage.id, { concentrating: true, concentration_spell: 'Fly' })
  s = await invoke('encounter:applyHp', mage.id, -50, 'normal')
  assert.equal(s.concentrationCheck, undefined, 'no save when you are already down')
  assert.equal(find(s, 'Mage').concentrating, false, 'dropping to 0 ends it')
  assert.equal(find(s, 'Mage').hp_current, 0)
})

test('the session log records who hit whom, defeats, boss actions and fight boundaries', async () => {
  await invoke('encounter:end')
  await invoke('encounter:start')
  let s = await invoke('encounter:addMonster', { name: 'Knight', hp_max: 20, initiative: 15 })
  s = await invoke('encounter:addMonster', { name: 'Rogue', hp_max: 10, initiative: 5 })
  const knight = find(s, 'Knight')
  const rogue = find(s, 'Rogue')
  await invoke('encounter:applyHp', rogue.id, -12, 'normal', knight.id)

  const text = listLog({ limit: 200 }).map((e) => e.text).join('\n')
  assert.match(text, /Knight hit Rogue for 12 damage/)
  assert.match(text, /Rogue was defeated/)
  assert.match(text, /Encounter started/)

  const end = await invoke('encounter:summary')
  assert.match(end.body, /Biggest hits/)
  assert.match(end.body, /Knight hit Rogue/)

  s = await invoke('encounter:end')
  const ended = listLog({ limit: 50 }).find((e) => /Encounter ended/.test(e.text))!
  assert.equal(ended.kind, 'combat')
})

test('saved encounters keep numbering and boss features, and relaunch the same fight', async () => {
  await invoke('encounter:end')
  await invoke('encounter:start')
  await invoke('encounter:addMonster', { name: 'Goblin', hp_max: 7, ac: 15, xp: 50, count: 3 })
  await invoke('encounter:addMonster', { name: 'Hobgoblin Warlord', hp_max: 60, xp: 700, legendary_actions: 2, recharges: [{ name: 'Command', min: 6 }] })
  const saved = await invoke('encounter:saveCurrent', 'Goblin ambush')
  assert.equal(saved.entries, 2)

  const list = await invoke('savedEncounters:list')
  const row = list.find((r: { id: string }) => r.id === saved.id)
  assert.equal(row.name, 'Goblin ambush')
  assert.deepEqual(row.entries.map((e: { name: string; count: number }) => [e.name, e.count]), [['Goblin', 3], ['Hobgoblin Warlord', 1]])

  await invoke('encounter:end')
  const s = await invoke('encounter:launchSaved', saved.id)
  assert.equal(s.isActive, true)
  assert.deepEqual(s.combatants.filter((c: C) => c.name.startsWith('Goblin ')).map((c: C) => c.name).sort(), ['Goblin 1', 'Goblin 2', 'Goblin 3'])
  const warlord = find(s, 'Hobgoblin Warlord')
  assert.equal(warlord.legendary_max, 2)
  assert.equal(warlord.recharges[0].name, 'Command')
  assert.ok(s.combatants.every((c: C) => c.initiative != null), 'monsters have rolled initiative')

  await invoke('savedEncounters:delete', saved.id)
  assert.equal((await invoke('savedEncounters:list')).some((r: { id: string }) => r.id === saved.id), false)
})

test('a player\'s own initiative roll lands on their combatant and roster entry', async () => {
  const d = getDb()
  await invoke('encounter:end')
  d.prepare("INSERT INTO party_members (id, name, client_id) VALUES ('pm-aria', 'Aria', 'client-aria')").run()
  await invoke('encounter:start')
  applyInitiativeRoll({ rollId: 'r1', clientId: 'client-aria', playerName: 'Aria', kind: 'initiative', label: 'Initiative', total: 17, natural: 14, modifier: 3, dc: null, success: null, at: Date.now() })
  const s = await invoke('encounter:getState')
  assert.equal(s.combatants.find((c: C) => c.name === 'Aria')!.initiative, 17)
  assert.equal((d.prepare("SELECT initiative FROM party_members WHERE id='pm-aria'").get() as { initiative: number }).initiative, 17)
})

test('homebrew items and monsters: save, edit, list; boss fields survive a quick re-save', async () => {
  const item = await invoke('items:save', { name: 'Lantern of the Drowned King', rarity: 'rare', category: 'wondrous', attunement: true, value_gp: 800 })
  assert.equal(item.attunement, true)
  await invoke('items:save', { id: item.id, name: 'Lantern of the Drowned King', rarity: 'very rare' })
  const items = await invoke('items:list')
  assert.equal(items.filter((i: { name: string }) => i.name === 'Lantern of the Drowned King').length, 1)
  assert.equal(items[0].rarity, 'very rare')

  const m = await invoke('monsters:save', { name: 'Bone Wyrm', hp: 200, legendary_actions: 3, legendary_resistances: 2, recharges: [{ name: 'Grave Breath', min: 5 }], lair: true, statblock: { traits: 'Undead Fortitude' } })
  assert.equal(m.legendary_actions, 3)
  assert.equal(m.lair, true)
  // The quick "save to my monsters" form only knows name/HP/AC — it must not wipe the boss data.
  const again = await invoke('monsters:save', { name: 'Bone Wyrm', hp: 220, ac: 18 })
  assert.equal(again.id, m.id, 'same monster, matched by name')
  assert.equal(again.hp, 220)
  assert.equal(again.legendary_actions, 3)
  assert.equal(again.recharges[0].name, 'Grave Breath')
  assert.equal(again.statblock.traits, 'Undead Fortitude')
})
