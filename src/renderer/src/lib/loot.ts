import { ART, GEMS, MAGIC_ITEMS, TABLE_META } from '../data/lootData'
import type { MagicItemDef, MagicTable } from '../data/lootData'

// Treasure by challenge rating, in the spirit of the Dungeon Master's Guide:
// "individual" treasure for a creature or two, "hoard" treasure for a lair.
// Everything takes an injectable RNG so a roll can be reproduced in a test.

export type Rng = () => number
export type Bracket = '0-4' | '5-10' | '11-16' | '17+'
export type CoinType = 'cp' | 'sp' | 'ep' | 'gp' | 'pp'
export type Coins = Record<CoinType, number>

export const COIN_VALUE_GP: Record<CoinType, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 }

export interface LootItem {
  id: string
  kind: 'magic' | 'gem' | 'art'
  name: string
  quantity: number
  value: number // gp each, for gems and art
  rarity?: string
  note: string
  damage?: string
  damage_type?: string
  homebrew?: boolean
}

export interface LootResult {
  bracket: Bracket
  mode: 'individual' | 'hoard'
  coins: Coins
  gems: LootItem[]
  art: LootItem[]
  magic: LootItem[]
  totalGp: number
}

export interface HomebrewPoolItem {
  name: string
  rarity: string
  category: string
  description: string
  damage?: string
  damage_type?: string
}

export function emptyCoins(): Coins {
  return { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }
}

export function bracketForCr(cr: number): Bracket {
  if (cr <= 4) return '0-4'
  if (cr <= 10) return '5-10'
  if (cr <= 16) return '11-16'
  return '17+'
}

export function parseCr(text: string): number {
  const t = text.trim()
  if (t.includes('/')) {
    const [a, b] = t.split('/').map(Number)
    return b ? a / b : 0
  }
  const n = parseFloat(t)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function roll(rng: Rng, n: number, d: number, mult = 1): number {
  let sum = 0
  for (let i = 0; i < n; i++) sum += Math.floor(rng() * d) + 1
  return sum * mult
}

function pick<T>(rng: Rng, list: T[]): T {
  return list[Math.floor(rng() * list.length)]
}

type CoinRoll = [CoinType, number, number, number] // coin, dice, sides, multiplier

// ── Individual treasure ─────────────────────────────────────────────────────
const INDIVIDUAL: Record<Bracket, { upTo: number; coins: CoinRoll[] }[]> = {
  '0-4': [
    { upTo: 30, coins: [['cp', 5, 6, 1]] },
    { upTo: 60, coins: [['sp', 4, 6, 1]] },
    { upTo: 70, coins: [['ep', 3, 6, 1]] },
    { upTo: 95, coins: [['gp', 3, 6, 1]] },
    { upTo: 100, coins: [['pp', 1, 6, 1]] }
  ],
  '5-10': [
    { upTo: 30, coins: [['cp', 4, 6, 100], ['ep', 1, 6, 10]] },
    { upTo: 60, coins: [['sp', 6, 6, 10], ['gp', 2, 6, 10]] },
    { upTo: 70, coins: [['ep', 3, 6, 10], ['gp', 2, 6, 10]] },
    { upTo: 95, coins: [['gp', 4, 6, 10]] },
    { upTo: 100, coins: [['gp', 2, 6, 10], ['pp', 3, 6, 1]] }
  ],
  '11-16': [
    { upTo: 20, coins: [['sp', 4, 6, 100], ['gp', 1, 6, 100]] },
    { upTo: 35, coins: [['ep', 1, 6, 100], ['gp', 1, 6, 100]] },
    { upTo: 75, coins: [['gp', 2, 6, 100], ['pp', 1, 6, 10]] },
    { upTo: 100, coins: [['gp', 2, 6, 100], ['pp', 2, 6, 10]] }
  ],
  '17+': [
    { upTo: 15, coins: [['ep', 2, 6, 1000], ['gp', 8, 6, 100]] },
    { upTo: 55, coins: [['gp', 1, 6, 1000], ['pp', 1, 6, 100]] },
    { upTo: 100, coins: [['gp', 1, 6, 1000], ['pp', 2, 6, 100]] }
  ]
}

// ── Hoards ──────────────────────────────────────────────────────────────────
interface HoardRow {
  upTo: number
  gem?: { n: number; d: number; value: number }
  art?: { n: number; d: number; value: number }
  magic?: { table: MagicTable; n: number; d: number }[]
}

const HOARD_COINS: Record<Bracket, CoinRoll[]> = {
  '0-4': [['cp', 6, 6, 100], ['sp', 3, 6, 100], ['gp', 2, 6, 10]],
  '5-10': [['cp', 2, 6, 100], ['sp', 2, 6, 1000], ['gp', 6, 6, 100], ['pp', 3, 6, 10]],
  '11-16': [['gp', 4, 6, 1000], ['pp', 5, 6, 100]],
  '17+': [['gp', 12, 6, 1000], ['pp', 8, 6, 1000]]
}

const g = (n: number, d: number, value: number) => ({ n, d, value })
const m = (table: MagicTable, n: number, d: number) => ({ table, n, d })
const once = (table: MagicTable) => ({ table, n: 1, d: 1 })

const HOARD: Record<Bracket, HoardRow[]> = {
  '0-4': [
    { upTo: 6 },
    { upTo: 16, gem: g(2, 6, 10) },
    { upTo: 26, art: g(2, 4, 25) },
    { upTo: 36, gem: g(2, 6, 50) },
    { upTo: 44, gem: g(2, 6, 10), magic: [m('A', 1, 6)] },
    { upTo: 52, art: g(2, 4, 25), magic: [m('A', 1, 6)] },
    { upTo: 60, gem: g(2, 6, 50), magic: [m('A', 1, 6)] },
    { upTo: 65, gem: g(2, 6, 10), magic: [m('B', 1, 4)] },
    { upTo: 70, art: g(2, 4, 25), magic: [m('B', 1, 4)] },
    { upTo: 75, gem: g(2, 6, 50), magic: [m('B', 1, 4)] },
    { upTo: 78, gem: g(2, 6, 10), magic: [m('C', 1, 4)] },
    { upTo: 80, art: g(2, 4, 25), magic: [m('C', 1, 4)] },
    { upTo: 85, gem: g(2, 6, 50), magic: [m('C', 1, 4)] },
    { upTo: 92, art: g(2, 4, 25), magic: [m('F', 1, 4)] },
    { upTo: 97, gem: g(2, 6, 50), magic: [m('F', 1, 4)] },
    { upTo: 99, art: g(2, 4, 25), magic: [once('G')] },
    { upTo: 100, gem: g(2, 6, 50), magic: [once('G')] }
  ],
  '5-10': [
    { upTo: 4 },
    { upTo: 10, art: g(2, 4, 25) },
    { upTo: 16, gem: g(3, 6, 50) },
    { upTo: 22, gem: g(3, 6, 100) },
    { upTo: 28, art: g(2, 4, 250) },
    { upTo: 32, art: g(2, 4, 25), magic: [m('A', 1, 6)] },
    { upTo: 36, gem: g(3, 6, 50), magic: [m('A', 1, 6)] },
    { upTo: 40, gem: g(3, 6, 100), magic: [m('A', 1, 6)] },
    { upTo: 44, art: g(2, 4, 250), magic: [m('A', 1, 6)] },
    { upTo: 49, art: g(2, 4, 25), magic: [m('B', 1, 4)] },
    { upTo: 54, gem: g(3, 6, 50), magic: [m('B', 1, 4)] },
    { upTo: 59, gem: g(3, 6, 100), magic: [m('B', 1, 4)] },
    { upTo: 63, art: g(2, 4, 250), magic: [m('B', 1, 4)] },
    { upTo: 66, art: g(2, 4, 25), magic: [m('C', 1, 4)] },
    { upTo: 69, gem: g(3, 6, 50), magic: [m('C', 1, 4)] },
    { upTo: 72, gem: g(3, 6, 100), magic: [m('C', 1, 4)] },
    { upTo: 74, art: g(2, 4, 250), magic: [m('C', 1, 4)] },
    { upTo: 76, art: g(2, 4, 25), magic: [m('D', 1, 4)] },
    { upTo: 78, gem: g(3, 6, 50), magic: [m('D', 1, 4)] },
    { upTo: 79, gem: g(3, 6, 100), magic: [m('D', 1, 4)] },
    { upTo: 80, art: g(2, 4, 250), magic: [m('D', 1, 4)] },
    { upTo: 84, art: g(2, 4, 25), magic: [m('F', 1, 4)] },
    { upTo: 88, gem: g(3, 6, 50), magic: [m('F', 1, 4)] },
    { upTo: 91, gem: g(3, 6, 100), magic: [m('F', 1, 4)] },
    { upTo: 94, art: g(2, 4, 250), magic: [m('F', 1, 4)] },
    { upTo: 96, gem: g(3, 6, 100), magic: [m('G', 1, 4)] },
    { upTo: 98, art: g(2, 4, 250), magic: [m('G', 1, 4)] },
    { upTo: 99, gem: g(3, 6, 100), magic: [once('H')] },
    { upTo: 100, art: g(2, 4, 250), magic: [once('H')] }
  ],
  '11-16': [
    { upTo: 3 },
    { upTo: 6, art: g(2, 4, 250) },
    { upTo: 9, art: g(2, 4, 750) },
    { upTo: 12, gem: g(3, 6, 500) },
    { upTo: 15, gem: g(3, 6, 1000) },
    { upTo: 19, art: g(2, 4, 250), magic: [m('A', 1, 4), m('B', 1, 6)] },
    { upTo: 23, art: g(2, 4, 750), magic: [m('A', 1, 4), m('B', 1, 6)] },
    { upTo: 26, gem: g(3, 6, 500), magic: [m('A', 1, 4), m('B', 1, 6)] },
    { upTo: 29, gem: g(3, 6, 1000), magic: [m('A', 1, 4), m('B', 1, 6)] },
    { upTo: 35, art: g(2, 4, 250), magic: [m('C', 1, 6)] },
    { upTo: 40, art: g(2, 4, 750), magic: [m('C', 1, 6)] },
    { upTo: 45, gem: g(3, 6, 500), magic: [m('C', 1, 6)] },
    { upTo: 50, gem: g(3, 6, 1000), magic: [m('C', 1, 6)] },
    { upTo: 54, art: g(2, 4, 250), magic: [m('D', 1, 4)] },
    { upTo: 58, art: g(2, 4, 750), magic: [m('D', 1, 4)] },
    { upTo: 62, gem: g(3, 6, 500), magic: [m('D', 1, 4)] },
    { upTo: 66, gem: g(3, 6, 1000), magic: [m('D', 1, 4)] },
    { upTo: 68, art: g(2, 4, 250), magic: [once('G')] },
    { upTo: 70, art: g(2, 4, 750), magic: [once('G')] },
    { upTo: 72, gem: g(3, 6, 500), magic: [once('G')] },
    { upTo: 74, gem: g(3, 6, 1000), magic: [once('G')] },
    { upTo: 76, art: g(2, 4, 250), magic: [once('H')] },
    { upTo: 78, art: g(2, 4, 750), magic: [once('H')] },
    { upTo: 80, gem: g(3, 6, 500), magic: [once('H')] },
    { upTo: 82, gem: g(3, 6, 1000), magic: [once('H')] },
    { upTo: 85, art: g(2, 4, 250), magic: [m('G', 1, 4)] },
    { upTo: 88, art: g(2, 4, 750), magic: [m('G', 1, 4)] },
    { upTo: 90, gem: g(3, 6, 500), magic: [m('G', 1, 4)] },
    { upTo: 92, gem: g(3, 6, 1000), magic: [m('G', 1, 4)] },
    { upTo: 94, art: g(2, 4, 250), magic: [m('H', 1, 4)] },
    { upTo: 96, art: g(2, 4, 750), magic: [m('H', 1, 4)] },
    { upTo: 98, gem: g(3, 6, 500), magic: [once('I')] },
    { upTo: 99, gem: g(3, 6, 1000), magic: [once('I')] },
    { upTo: 100, art: g(2, 4, 250), magic: [once('I')] }
  ],
  '17+': [
    { upTo: 2 },
    { upTo: 5, gem: g(3, 6, 1000), magic: [m('C', 1, 8)] },
    { upTo: 8, art: g(1, 10, 2500), magic: [m('C', 1, 8)] },
    { upTo: 11, art: g(1, 4, 7500), magic: [m('C', 1, 8)] },
    { upTo: 14, gem: g(1, 8, 5000), magic: [m('C', 1, 8)] },
    { upTo: 22, gem: g(3, 6, 1000), magic: [m('D', 1, 6)] },
    { upTo: 30, art: g(1, 10, 2500), magic: [m('D', 1, 6)] },
    { upTo: 38, art: g(1, 4, 7500), magic: [m('D', 1, 6)] },
    { upTo: 46, gem: g(1, 8, 5000), magic: [m('D', 1, 6)] },
    { upTo: 52, gem: g(3, 6, 1000), magic: [m('E', 1, 6)] },
    { upTo: 58, art: g(1, 10, 2500), magic: [m('E', 1, 6)] },
    { upTo: 62, art: g(1, 4, 7500), magic: [m('E', 1, 6)] },
    { upTo: 66, gem: g(1, 8, 5000), magic: [m('E', 1, 6)] },
    { upTo: 68, gem: g(3, 6, 1000), magic: [m('G', 1, 4)] },
    { upTo: 70, art: g(1, 10, 2500), magic: [m('G', 1, 4)] },
    { upTo: 72, art: g(1, 4, 7500), magic: [m('G', 1, 4)] },
    { upTo: 74, gem: g(1, 8, 5000), magic: [m('G', 1, 4)] },
    { upTo: 76, gem: g(3, 6, 1000), magic: [m('H', 1, 4)] },
    { upTo: 78, art: g(1, 10, 2500), magic: [m('H', 1, 4)] },
    { upTo: 80, art: g(1, 4, 7500), magic: [m('H', 1, 4)] },
    { upTo: 82, gem: g(1, 8, 5000), magic: [m('H', 1, 4)] },
    { upTo: 85, gem: g(3, 6, 1000), magic: [m('I', 1, 4)] },
    { upTo: 88, art: g(1, 10, 2500), magic: [m('I', 1, 4)] },
    { upTo: 90, art: g(1, 4, 7500), magic: [m('I', 1, 4)] },
    { upTo: 92, gem: g(1, 8, 5000), magic: [m('I', 1, 4)] },
    { upTo: 96, art: g(1, 4, 7500), magic: [m('H', 1, 4), m('I', 1, 4)] },
    { upTo: 100, gem: g(1, 8, 5000), magic: [m('H', 1, 4), m('I', 1, 4)] }
  ]
}

let idCounter = 0
function newId(): string {
  idCounter += 1
  return `loot-${Date.now().toString(36)}-${idCounter}`
}

function addCoins(into: Coins, rolls: CoinRoll[], rng: Rng): void {
  for (const [coin, n, d, mult] of rolls) into[coin] += roll(rng, n, d, mult)
}

// Merges repeats ("3 × Bloodstone") so a pile reads as a list, not a wall.
function merge(items: LootItem[]): LootItem[] {
  const out: LootItem[] = []
  for (const it of items) {
    const same = out.find((x) => x.name === it.name && x.kind === it.kind && x.value === it.value)
    if (same) same.quantity += it.quantity
    else out.push({ ...it })
  }
  return out
}

function rollMagic(table: MagicTable, rng: Rng, homebrew: HomebrewPoolItem[]): LootItem {
  const meta = TABLE_META[table]
  // Homebrew items of the matching rarity join the pool, weighted up so a
  // small personal collection still turns up.
  const wantConsumable = meta.category === 'consumable'
  const own = homebrew.filter((h) => {
    const isConsumable = h.category === 'potion' || h.category === 'scroll'
    return h.rarity === meta.rarity && isConsumable === wantConsumable
  })
  const WEIGHT = 4
  const base = MAGIC_ITEMS[table]
  const total = base.length + own.length * WEIGHT
  const r = Math.floor(rng() * total)
  if (r >= base.length) {
    const h = own[Math.floor((r - base.length) / WEIGHT)]
    return {
      id: newId(), kind: 'magic', name: h.name, quantity: 1, value: 0, rarity: meta.rarity,
      note: h.description, damage: h.damage || undefined, damage_type: h.damage_type || undefined, homebrew: true
    }
  }
  const def: MagicItemDef = base[r]
  return {
    id: newId(), kind: 'magic', name: def.name, quantity: 1, value: 0, rarity: meta.rarity,
    note: def.note, damage: def.damage, damage_type: def.damage_type
  }
}

function rollValuables(kind: 'gem' | 'art', spec: { n: number; d: number; value: number }, rng: Rng): LootItem[] {
  const count = roll(rng, spec.n, spec.d)
  const names = (kind === 'gem' ? GEMS : ART)[spec.value] ?? []
  const items: LootItem[] = []
  for (let i = 0; i < count; i++) {
    items.push({
      id: newId(), kind, name: names.length ? pick(rng, names) : `${spec.value} gp ${kind}`, quantity: 1,
      value: spec.value, note: `${spec.value} gp`
    })
  }
  return merge(items)
}

function totalValue(coins: Coins, gems: LootItem[], art: LootItem[]): number {
  let gp = 0
  for (const c of Object.keys(coins) as CoinType[]) gp += coins[c] * COIN_VALUE_GP[c]
  for (const it of [...gems, ...art]) gp += it.value * it.quantity
  return Math.round(gp * 100) / 100
}

export function rollIndividual(cr: number, creatures = 1, rng: Rng = Math.random): LootResult {
  const bracket = bracketForCr(cr)
  const coins = emptyCoins()
  const n = Math.max(1, Math.min(60, Math.floor(creatures)))
  for (let i = 0; i < n; i++) {
    const r = roll(rng, 1, 100)
    const row = INDIVIDUAL[bracket].find((x) => r <= x.upTo) ?? INDIVIDUAL[bracket][INDIVIDUAL[bracket].length - 1]
    addCoins(coins, row.coins, rng)
  }
  return { bracket, mode: 'individual', coins, gems: [], art: [], magic: [], totalGp: totalValue(coins, [], []) }
}

export function rollHoard(cr: number, rng: Rng = Math.random, homebrew: HomebrewPoolItem[] = []): LootResult {
  const bracket = bracketForCr(cr)
  const coins = emptyCoins()
  addCoins(coins, HOARD_COINS[bracket], rng)
  const r = roll(rng, 1, 100)
  const row = HOARD[bracket].find((x) => r <= x.upTo) ?? HOARD[bracket][HOARD[bracket].length - 1]
  const gems = row.gem ? rollValuables('gem', row.gem, rng) : []
  const art = row.art ? rollValuables('art', row.art, rng) : []
  const magic: LootItem[] = []
  for (const spec of row.magic ?? []) {
    const times = roll(rng, spec.n, spec.d)
    for (let i = 0; i < times; i++) magic.push(rollMagic(spec.table, rng, homebrew))
  }
  return { bracket, mode: 'hoard', coins, gems, art, magic: merge(magic), totalGp: totalValue(coins, gems, art) }
}

// Splits coins between `ways` characters as evenly as whole coins allow; the
// leftover coins go to the first characters in turn.
export function splitCoins(coins: Coins, ways: number): Coins[] {
  const n = Math.max(1, Math.floor(ways))
  const parts: Coins[] = Array.from({ length: n }, emptyCoins)
  for (const c of Object.keys(coins) as CoinType[]) {
    const each = Math.floor(coins[c] / n)
    let rest = coins[c] - each * n
    for (let i = 0; i < n; i++) {
      parts[i][c] = each + (rest > 0 ? 1 : 0)
      if (rest > 0) rest--
    }
  }
  return parts
}

export function describeCoins(coins: Coins): string {
  const order: CoinType[] = ['pp', 'gp', 'ep', 'sp', 'cp']
  const parts = order.filter((c) => coins[c] > 0).map((c) => `${coins[c].toLocaleString()} ${c}`)
  return parts.length ? parts.join(', ') : 'No coins'
}
