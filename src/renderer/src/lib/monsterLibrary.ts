import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EncounterEntry, MonsterTemplate, Statblock } from '../types'
import { BUILT_IN_MONSTERS } from '../data/monsters'
import { crToXp } from './dnd5e'

// One list for the built-in bestiary and the DM's own saved monsters, with the
// boss-fight extras (legendary actions, recharges, lair) carried along.
export interface LibraryEntry {
  key: string
  name: string
  cr: string
  ac: number | null
  hp: number | null
  init: number
  xp: number
  legendary: number
  legres: number
  recharges: { name: string; min: number }[]
  lair: boolean
  statblock: Statblock | null
  custom?: MonsterTemplate
}

export function templateToEntry(m: MonsterTemplate): LibraryEntry {
  const statblock: Statblock | null =
    m.statblock || m.notes ? { ...(m.statblock ?? {}), ...(m.notes ? { notes: m.notes } : {}) } : null
  return {
    key: m.id,
    name: m.name,
    cr: m.cr,
    ac: m.ac,
    hp: m.hp,
    init: m.init_mod,
    xp: m.xp || crToXp(m.cr),
    legendary: m.legendary_actions ?? 0,
    legres: m.legendary_resistances ?? 0,
    recharges: m.recharges ?? [],
    lair: !!m.lair,
    statblock,
    custom: m
  }
}

export function useMonsterLibrary(): { library: LibraryEntry[]; reload: () => void; setCustom: React.Dispatch<React.SetStateAction<MonsterTemplate[]>> } {
  const [custom, setCustom] = useState<MonsterTemplate[]>([])
  const reload = useCallback(() => {
    window.api.monsters.list().then(setCustom)
  }, [])
  useEffect(reload, [reload])

  const library = useMemo<LibraryEntry[]>(
    () => [
      ...custom.map(templateToEntry),
      ...BUILT_IN_MONSTERS.map<LibraryEntry>((m) => ({
        key: m.name,
        name: m.name,
        cr: m.cr,
        ac: m.ac,
        hp: m.hp,
        init: m.init,
        xp: m.xp,
        legendary: m.legendary ?? 0,
        legres: m.legres ?? 0,
        recharges: m.recharges ?? [],
        lair: !!m.lair,
        statblock: m.notes ? { notes: m.notes } : null
      }))
    ],
    [custom]
  )

  return { library, reload, setCustom }
}

export function searchLibrary(library: LibraryEntry[], query: string, limit = 8): LibraryEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return library.filter((m) => m.name.toLowerCase().includes(q)).slice(0, limit)
}

export function entryToEncounterEntry(e: LibraryEntry, count = 1): EncounterEntry {
  return {
    name: e.name,
    count,
    hp_max: e.hp ?? undefined,
    ac: e.ac ?? undefined,
    init_mod: e.init,
    xp: e.xp,
    cr: e.cr,
    legendary_actions: e.legendary || undefined,
    legendary_resistances: e.legres || undefined,
    recharges: e.recharges.length ? e.recharges : undefined,
    lair: e.lair || undefined,
    statblock: e.statblock
  }
}
