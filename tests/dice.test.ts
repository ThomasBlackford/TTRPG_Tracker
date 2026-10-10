import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDice, rollDice, rollD20, dieRoll, levelForXp, xpToNext } from '../player-client/src/renderer/src/lib/dice'

test('parseDice reads common expressions', () => {
  assert.deepEqual(parseDice('1d8'), { terms: [{ count: 1, sides: 8, sign: 1 }], flat: 0 })
  assert.deepEqual(parseDice('d20'), { terms: [{ count: 1, sides: 20, sign: 1 }], flat: 0 })
  assert.deepEqual(parseDice('2d6+3'), { terms: [{ count: 2, sides: 6, sign: 1 }], flat: 3 })
  assert.deepEqual(parseDice(' 2D8 + 1d6 - 1 '), {
    terms: [{ count: 2, sides: 8, sign: 1 }, { count: 1, sides: 6, sign: 1 }], flat: -1
  })
  assert.deepEqual(parseDice('5'), { terms: [], flat: 5 })
  assert.deepEqual(parseDice('3d4+3'), { terms: [{ count: 3, sides: 4, sign: 1 }], flat: 3 })
})

test('parseDice rejects nonsense instead of rolling it', () => {
  for (const bad of ['', '   ', 'abc', '2d', 'd', '2d6+', '2d6++3', '0d6', '1d0', '9999d6', '1d99999', 'fireball']) {
    assert.equal(parseDice(bad), null, `should reject ${JSON.stringify(bad)}`)
  }
})

test('rollDice stays within the possible range', () => {
  for (let i = 0; i < 500; i++) {
    const r = rollDice('2d6+3')!
    assert.ok(r.total >= 5 && r.total <= 15, `2d6+3 gave ${r.total}`)
    assert.equal(r.parts[0].rolls.length, 2)
  }
  for (let i = 0; i < 200; i++) {
    const r = rollDice('1d8-2')!
    assert.ok(r.total >= -1 && r.total <= 6)
  }
})

test('a critical hit doubles the dice but not the flat bonus', () => {
  for (let i = 0; i < 300; i++) {
    const r = rollDice('1d8+3', { crit: true })!
    assert.equal(r.parts[0].rolls.length, 2)
    assert.ok(r.total >= 5 && r.total <= 19, `crit gave ${r.total}`)
    assert.equal(r.flat, 3)
  }
})

test('dieRoll is uniform enough and never out of range', () => {
  const counts = new Array(7).fill(0)
  for (let i = 0; i < 6000; i++) {
    const n = dieRoll(6)
    assert.ok(n >= 1 && n <= 6)
    counts[n]++
  }
  for (let f = 1; f <= 6; f++) assert.ok(counts[f] > 800 && counts[f] < 1200, `face ${f} came up ${counts[f]} times`)
})

test('advantage takes the higher die, disadvantage the lower', () => {
  let advBetter = 0
  for (let i = 0; i < 400; i++) {
    const adv = rollD20(2, 'adv')
    assert.ok(adv.other !== null && adv.natural >= adv.other)
    assert.equal(adv.total, adv.natural + 2)
    const dis = rollD20(-1, 'dis')
    assert.ok(dis.other !== null && dis.natural <= dis.other)
    assert.equal(dis.total, dis.natural - 1)
    if (adv.natural >= 11) advBetter++
  }
  assert.ok(advBetter > 250, 'advantage should land on 11+ about 75% of the time')
  assert.equal(rollD20(0, 'normal').other, null)
})

test('XP thresholds map to the PHB levels', () => {
  assert.equal(levelForXp(0), 1)
  assert.equal(levelForXp(299), 1)
  assert.equal(levelForXp(300), 2)
  assert.equal(levelForXp(6500), 5)
  assert.equal(levelForXp(355000), 20)
  assert.equal(levelForXp(9999999), 20)
  assert.equal(xpToNext(1), 300)
  assert.equal(xpToNext(4), 6500)
  assert.equal(xpToNext(20), null)
})
