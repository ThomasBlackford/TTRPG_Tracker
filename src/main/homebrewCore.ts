// Reading and writing the homebrew share format — a plain JSON file of
// monsters and items that DMs can trade. Kept free of Electron and the
// database so it can be tested on its own.

export interface HomebrewMonster {
  name: string
  ac: number | null
  hp: number | null
  init_mod: number
  cr: string
  xp: number
  notes: string
  legendary_actions: number
  legendary_resistances: number
  recharges: { name: string; min: number }[]
  lair: boolean
  statblock: Record<string, unknown> | null
}

export interface HomebrewItem {
  name: string
  category: string
  rarity: string
  attunement: boolean
  description: string
  damage: string
  damage_type: string
  value_gp: number
}

export interface HomebrewFile {
  app: 'lorekeeper'
  kind: 'homebrew'
  version: 1
  monsters: HomebrewMonster[]
  items: HomebrewItem[]
}

export const RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'] as const
export const ITEM_CATEGORIES = ['weapon', 'armor', 'wondrous', 'potion', 'scroll', 'ring', 'rod', 'wand', 'gear', 'treasure'] as const

const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.slice(0, max) : '')
const int = (v: unknown, lo = 0, hi = 1_000_000, fallback = lo): number => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback
}
const intOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? n : null
}

export function cleanMonster(raw: unknown): HomebrewMonster | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const name = str(r.name, 120).trim()
  if (!name) return null
  const recharges = Array.isArray(r.recharges)
    ? (r.recharges as unknown[])
        .map((x) => {
          const o = x as Record<string, unknown>
          const n = str(o?.name, 80).trim()
          return n ? { name: n, min: int(o?.min, 2, 6, 5) } : null
        })
        .filter((x): x is { name: string; min: number } => !!x)
        .slice(0, 8)
    : []
  return {
    name,
    ac: intOrNull(r.ac),
    hp: intOrNull(r.hp),
    init_mod: int(r.init_mod, -10, 20, 0),
    cr: str(r.cr, 8).trim(),
    xp: int(r.xp, 0, 1_000_000),
    notes: str(r.notes, 8000),
    legendary_actions: int(r.legendary_actions, 0, 10),
    legendary_resistances: int(r.legendary_resistances, 0, 10),
    recharges,
    lair: r.lair === true || r.lair === 1,
    statblock: r.statblock && typeof r.statblock === 'object' ? (r.statblock as Record<string, unknown>) : null
  }
}

export function cleanItem(raw: unknown): HomebrewItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const name = str(r.name, 120).trim()
  if (!name) return null
  const rarity = str(r.rarity, 20).toLowerCase()
  const category = str(r.category, 20).toLowerCase()
  return {
    name,
    category: (ITEM_CATEGORIES as readonly string[]).includes(category) ? category : 'wondrous',
    rarity: (RARITIES as readonly string[]).includes(rarity) ? rarity : 'common',
    attunement: r.attunement === true || r.attunement === 1,
    description: str(r.description, 8000),
    damage: str(r.damage, 40),
    damage_type: str(r.damage_type, 40),
    value_gp: Math.max(0, Number(r.value_gp) || 0)
  }
}

// Accepts the file as written by exportHomebrew (or any JSON with `monsters`
// and/or `items` arrays) and returns only what's usable, with a note for each
// entry that wasn't.
export function parseHomebrew(json: unknown): { monsters: HomebrewMonster[]; items: HomebrewItem[]; skipped: number; error?: string } {
  if (!json || typeof json !== 'object') return { monsters: [], items: [], skipped: 0, error: 'That file is not a LoreKeeper homebrew file.' }
  const o = json as Record<string, unknown>
  if (!Array.isArray(o.monsters) && !Array.isArray(o.items)) {
    return { monsters: [], items: [], skipped: 0, error: 'No monsters or items found in that file.' }
  }
  const monsters: HomebrewMonster[] = []
  const items: HomebrewItem[] = []
  let skipped = 0
  for (const m of Array.isArray(o.monsters) ? (o.monsters as unknown[]).slice(0, 2000) : []) {
    const c = cleanMonster(m)
    if (c) monsters.push(c)
    else skipped++
  }
  for (const i of Array.isArray(o.items) ? (o.items as unknown[]).slice(0, 2000) : []) {
    const c = cleanItem(i)
    if (c) items.push(c)
    else skipped++
  }
  return { monsters, items, skipped }
}

export function buildHomebrewFile(monsters: HomebrewMonster[], items: HomebrewItem[]): HomebrewFile {
  return { app: 'lorekeeper', kind: 'homebrew', version: 1, monsters, items }
}
