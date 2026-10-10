import test from 'node:test'
import assert from 'node:assert/strict'
import { rateEncounter, crToXp } from '../src/renderer/src/lib/dnd5e'
import { BUILT_IN_MONSTERS } from '../src/renderer/src/data/monsters'

test('four level-3 characters vs four goblins is an Easy fight', () => {
  const r = rateEncounter([3, 3, 3, 3], [50, 50, 50, 50])!
  assert.equal(r.totalXp, 200)
  assert.equal(r.multiplier, 2) // 3-6 monsters
  assert.equal(r.adjustedXp, 400)
  assert.deepEqual(r.thresholds, { easy: 300, medium: 600, hard: 900, deadly: 1600 })
  assert.equal(r.rating, 'Easy')
})

test('a lone troll is Deadly for four level-3 characters', () => {
  const r = rateEncounter([3, 3, 3, 3], [1800])!
  assert.equal(r.multiplier, 1)
  assert.equal(r.rating, 'Deadly')
})

test('group multiplier steps up with monster count, and shifts with party size', () => {
  assert.equal(rateEncounter([5, 5, 5, 5], [100, 100])!.multiplier, 1.5)
  assert.equal(rateEncounter([5, 5, 5, 5], [100, 100, 100])!.multiplier, 2)
  assert.equal(rateEncounter([5, 5, 5, 5], Array(7).fill(100))!.multiplier, 2.5)
  assert.equal(rateEncounter([5, 5, 5, 5], Array(11).fill(100))!.multiplier, 3)
  assert.equal(rateEncounter([5, 5, 5, 5], Array(15).fill(100))!.multiplier, 4)
  // two players: one step harder; six players: one step easier
  assert.equal(rateEncounter([5, 5], [100, 100])!.multiplier, 2)
  assert.equal(rateEncounter([5, 5, 5, 5, 5, 5], [100, 100])!.multiplier, 1)
  assert.equal(rateEncounter([5, 5, 5, 5, 5, 5], [100])!.multiplier, 0.5)
})

test('no party or no monsters gives no rating', () => {
  assert.equal(rateEncounter([], [100]), null)
  assert.equal(rateEncounter([3], []), null)
  assert.equal(rateEncounter([3], [0]), null)
})

test('crToXp matches the DMG table', () => {
  assert.equal(crToXp('1/4'), 50)
  assert.equal(crToXp('1'), 200)
  assert.equal(crToXp('5'), 1800)
  assert.equal(crToXp('17'), 18000)
  assert.equal(crToXp('nonsense'), 0)
})

test('built-in bestiary entries are internally consistent', () => {
  const names = new Set<string>()
  for (const m of BUILT_IN_MONSTERS) {
    assert.ok(!names.has(m.name), `duplicate monster ${m.name}`)
    names.add(m.name)
    assert.ok(m.hp > 0 && m.ac > 0, `${m.name} has bad stats`)
    assert.equal(m.xp, crToXp(m.cr), `${m.name}: xp ${m.xp} does not match CR ${m.cr}`)
  }
})
