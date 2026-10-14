import test from 'node:test'
import assert from 'node:assert/strict'
import { bracketForCr, parseCr, rollHoard, rollIndividual, splitCoins, emptyCoins, describeCoins } from '../src/renderer/src/lib/loot'
import { MAGIC_ITEMS } from '../src/renderer/src/data/lootData'
import { buildHomebrewFile, cleanItem, cleanMonster, parseHomebrew } from '../src/main/homebrewCore'

// A small deterministic generator so rolls can be reproduced.
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('challenge ratings map to the right treasure table', () => {
  assert.equal(bracketForCr(0), '0-4')
  assert.equal(bracketForCr(4), '0-4')
  assert.equal(bracketForCr(5), '5-10')
  assert.equal(bracketForCr(10), '5-10')
  assert.equal(bracketForCr(11), '11-16')
  assert.equal(bracketForCr(16), '11-16')
  assert.equal(bracketForCr(17), '17+')
  assert.equal(bracketForCr(30), '17+')
  assert.equal(parseCr('1/2'), 0.5)
  assert.equal(parseCr('1/8'), 0.125)
  assert.equal(parseCr('13'), 13)
  assert.equal(parseCr('abc'), 0)
})

test('individual treasure is coin only, scales with CR, and is repeatable with a seed', () => {
  const a = rollIndividual(2, 3, seeded(7))
  const b = rollIndividual(2, 3, seeded(7))
  assert.deepEqual(a.coins, b.coins)
  assert.equal(a.gems.length + a.art.length + a.magic.length, 0)
  assert.ok(a.totalGp > 0)

  // High-CR individual loot is worth more than low-CR loot on average.
  const avg = (cr: number) => {
    const rng = seeded(11)
    let sum = 0
    for (let i = 0; i < 200; i++) sum += rollIndividual(cr, 1, rng).totalGp
    return sum / 200
  }
  assert.ok(avg(18) > avg(8) && avg(8) > avg(2))
})

test('hoards always have coins, and over many rolls produce gems, art and magic items', () => {
  const rng = seeded(99)
  let gems = 0, art = 0, magic = 0
  for (let i = 0; i < 400; i++) {
    const h = rollHoard(1 + (i % 20), rng)
    assert.equal(h.mode, 'hoard')
    assert.ok(Object.values(h.coins).some((n) => n > 0), 'a hoard has coin')
    for (const it of [...h.gems, ...h.art, ...h.magic]) {
      assert.ok(it.name.length > 0 && it.quantity >= 1)
    }
    gems += h.gems.length; art += h.art.length; magic += h.magic.length
  }
  assert.ok(gems > 0 && art > 0 && magic > 0)
})

test('magic items come from the matching rarity table and homebrew items can join the pool', () => {
  const rng = seeded(5)
  const allNames = new Set(Object.values(MAGIC_ITEMS).flat().map((i) => i.name))
  for (let i = 0; i < 300; i++) {
    for (const it of rollHoard(8, rng).magic) assert.ok(allNames.has(it.name), `${it.name} is a known item`)
  }

  const homebrew = [{ name: 'Lantern of the Drowned King', rarity: 'uncommon', category: 'wondrous', description: 'Burns green.' }]
  let seen = 0
  for (let i = 0; i < 600; i++) {
    for (const it of rollHoard(1 + (i % 10), rng, homebrew).magic) {
      if (it.name === homebrew[0].name) { seen++; assert.equal(it.homebrew, true) }
    }
  }
  assert.ok(seen > 0, 'a homebrew item of a fitting rarity turns up')
})

test('splitting coins never loses or invents any', () => {
  const coins = { cp: 101, sp: 7, ep: 0, gp: 250, pp: 3 }
  for (const ways of [1, 2, 3, 4, 5, 7]) {
    const parts = splitCoins(coins, ways)
    assert.equal(parts.length, ways)
    for (const c of ['cp', 'sp', 'ep', 'gp', 'pp'] as const) {
      assert.equal(parts.reduce((n, p) => n + p[c], 0), coins[c], `${c} across ${ways}`)
      const values = parts.map((p) => p[c])
      assert.ok(Math.max(...values) - Math.min(...values) <= 1, 'as even as whole coins allow')
    }
  }
  assert.equal(describeCoins(emptyCoins()), 'No coins')
  assert.equal(describeCoins({ ...emptyCoins(), gp: 1200, pp: 2 }), '2 pp, 1,200 gp')
})

test('homebrew files are validated, cleaned, and round-trip', () => {
  assert.ok(parseHomebrew('nope').error)
  assert.ok(parseHomebrew({ hello: 1 }).error)

  const dragon = cleanMonster({
    name: '  Bone Wyrm ', ac: '17', hp: 200, init_mod: -2, cr: '12', xp: 8400, legendary_actions: 3, legendary_resistances: 99,
    recharges: [{ name: 'Grave Breath', min: 5 }, { name: '', min: 5 }, { name: 'Bad', min: 'x' }], lair: 1
  })!
  assert.equal(dragon.name, 'Bone Wyrm')
  assert.equal(dragon.ac, 17)
  assert.equal(dragon.init_mod, -2)
  assert.equal(dragon.legendary_resistances, 10, 'clamped')
  assert.deepEqual(dragon.recharges.map((r) => [r.name, r.min]), [['Grave Breath', 5], ['Bad', 5]])
  assert.equal(dragon.lair, true)

  assert.equal(cleanMonster({ ac: 5 }), null)
  const item = cleanItem({ name: 'Cloak', rarity: 'LEGENDARY', category: 'nonsense', attunement: true })!
  assert.equal(item.rarity, 'legendary')
  assert.equal(item.category, 'wondrous', 'unknown categories fall back')

  const file = buildHomebrewFile([dragon], [item])
  const back = parseHomebrew(JSON.parse(JSON.stringify(file)))
  assert.equal(back.error, undefined)
  assert.deepEqual(back.monsters, [dragon])
  assert.deepEqual(back.items, [item])

  const mixed = parseHomebrew({ monsters: [{ name: 'Ok' }, 5, null], items: [{ name: '' }] })
  assert.equal(mixed.monsters.length, 1)
  assert.equal(mixed.skipped, 3)
})
