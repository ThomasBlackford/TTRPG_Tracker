import type { Condition } from '../types'

export const ABILITIES: { key: string; label: string; short: string }[] = [
  { key: 'str', label: 'Strength', short: 'STR' },
  { key: 'dex', label: 'Dexterity', short: 'DEX' },
  { key: 'con', label: 'Constitution', short: 'CON' },
  { key: 'int', label: 'Intelligence', short: 'INT' },
  { key: 'wis', label: 'Wisdom', short: 'WIS' },
  { key: 'cha', label: 'Charisma', short: 'CHA' }
]

// Keys match the player app's skill ids so a roll request resolves to the
// right modifier on their sheet.
export const SKILLS: { key: string; label: string; ability: string }[] = [
  { key: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
  { key: 'animal_handling', label: 'Animal Handling', ability: 'wis' },
  { key: 'arcana', label: 'Arcana', ability: 'int' },
  { key: 'athletics', label: 'Athletics', ability: 'str' },
  { key: 'deception', label: 'Deception', ability: 'cha' },
  { key: 'history', label: 'History', ability: 'int' },
  { key: 'insight', label: 'Insight', ability: 'wis' },
  { key: 'intimidation', label: 'Intimidation', ability: 'cha' },
  { key: 'investigation', label: 'Investigation', ability: 'int' },
  { key: 'medicine', label: 'Medicine', ability: 'wis' },
  { key: 'nature', label: 'Nature', ability: 'int' },
  { key: 'perception', label: 'Perception', ability: 'wis' },
  { key: 'performance', label: 'Performance', ability: 'cha' },
  { key: 'persuasion', label: 'Persuasion', ability: 'cha' },
  { key: 'religion', label: 'Religion', ability: 'int' },
  { key: 'sleight_of_hand', label: 'Sleight of Hand', ability: 'dex' },
  { key: 'stealth', label: 'Stealth', ability: 'dex' },
  { key: 'survival', label: 'Survival', ability: 'wis' }
]

export const CONDITIONS: Condition[] = [
  'Blinded', 'Charmed', 'Deafened', 'Exhausted', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
  'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'
]

// ── Encounter difficulty (DMG, 2014 rules) ─────────────────────────────────
// [easy, medium, hard, deadly] XP thresholds per character, by level.
export const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200], 17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700]
}

const MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 4]

function multiplierFor(monsterCount: number, partySize: number): number {
  let idx = monsterCount <= 1 ? 0 : monsterCount === 2 ? 1 : monsterCount <= 6 ? 2 : monsterCount <= 10 ? 3 : monsterCount <= 14 ? 4 : 5
  // A small party feels a big group harder; a large one, less so.
  if (partySize < 3) idx = Math.min(5, idx + 1)
  else if (partySize >= 6) idx = idx - 1
  return idx < 0 ? 0.5 : MULTIPLIERS[idx]
}

export type Difficulty = 'Trivial' | 'Easy' | 'Medium' | 'Hard' | 'Deadly'

export interface EncounterRating {
  totalXp: number
  adjustedXp: number
  multiplier: number
  thresholds: { easy: number; medium: number; hard: number; deadly: number }
  rating: Difficulty
}

export function rateEncounter(partyLevels: number[], monsterXp: number[]): EncounterRating | null {
  const levels = partyLevels.filter((l) => l >= 1)
  const xps = monsterXp.filter((x) => x > 0)
  if (levels.length === 0 || xps.length === 0) return null

  const thresholds = { easy: 0, medium: 0, hard: 0, deadly: 0 }
  for (const l of levels) {
    const t = XP_THRESHOLDS[Math.min(20, Math.max(1, Math.floor(l)))]
    thresholds.easy += t[0]; thresholds.medium += t[1]; thresholds.hard += t[2]; thresholds.deadly += t[3]
  }
  const totalXp = xps.reduce((a, b) => a + b, 0)
  const multiplier = multiplierFor(xps.length, levels.length)
  const adjustedXp = Math.round(totalXp * multiplier)
  const rating: Difficulty =
    adjustedXp >= thresholds.deadly ? 'Deadly'
    : adjustedXp >= thresholds.hard ? 'Hard'
    : adjustedXp >= thresholds.medium ? 'Medium'
    : adjustedXp >= thresholds.easy ? 'Easy'
    : 'Trivial'
  return { totalXp, adjustedXp, multiplier, thresholds, rating }
}

export function crToXp(cr: string): number {
  const table: Record<string, number> = {
    '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300,
    '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
    '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000
  }
  return table[cr.trim()] ?? 0
}
