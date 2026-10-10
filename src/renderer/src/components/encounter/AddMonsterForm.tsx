import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Save, Trash2 } from 'lucide-react'
import type { EncounterState, MonsterTemplate } from '../../types'
import { BUILT_IN_MONSTERS } from '../../data/monsters'
import { crToXp } from '../../lib/dnd5e'

export interface MonsterInput {
  name: string
  hp_max?: number
  ac?: number
  init_mod?: number
  xp?: number
  count?: number
  rollInitiative?: boolean
  grouped?: boolean
}

interface Props {
  onAdd: (data: MonsterInput) => Promise<EncounterState>
}

interface LibraryEntry {
  key: string
  name: string
  cr: string
  ac: number | null
  hp: number | null
  init: number
  xp: number
  custom?: MonsterTemplate
}

const toInt = (s: string): number | undefined => {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : undefined
}

// Pick from the built-in bestiary or your own saved monsters (or type a
// one-off), choose how many, and add — numbered copies and initiative rolled
// for you, either per creature or once for the whole pack.
export function AddMonsterForm({ onAdd }: Props) {
  const [custom, setCustom] = useState<MonsterTemplate[]>([])
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [hp, setHp] = useState('')
  const [ac, setAc] = useState('')
  const [initMod, setInitMod] = useState('0')
  const [xp, setXp] = useState('')
  const [cr, setCr] = useState('')
  const [count, setCount] = useState('1')
  const [rollInit, setRollInit] = useState(true)
  const [grouped, setGrouped] = useState(true)
  const [savedNote, setSavedNote] = useState('')

  useEffect(() => {
    window.api.monsters.list().then(setCustom)
  }, [])

  const library: LibraryEntry[] = useMemo(
    () => [
      ...custom.map<LibraryEntry>((m) => ({ key: m.id, name: m.name, cr: m.cr, ac: m.ac, hp: m.hp, init: m.init_mod, xp: m.xp, custom: m })),
      ...BUILT_IN_MONSTERS.map<LibraryEntry>((m) => ({ key: m.name, name: m.name, cr: m.cr, ac: m.ac, hp: m.hp, init: m.init, xp: m.xp }))
    ],
    [custom]
  )

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return library.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, library])

  function pick(m: LibraryEntry) {
    setName(m.name)
    setHp(m.hp != null ? String(m.hp) : '')
    setAc(m.ac != null ? String(m.ac) : '')
    setInitMod(String(m.init))
    setXp(String(m.xp || crToXp(m.cr)))
    setCr(m.cr)
    setQuery('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd({
      name: name.trim(),
      hp_max: toInt(hp),
      ac: toInt(ac),
      init_mod: toInt(initMod) ?? 0,
      xp: toInt(xp) ?? 0,
      count: toInt(count) ?? 1,
      rollInitiative: rollInit,
      grouped: grouped && (toInt(count) ?? 1) > 1
    })
  }

  async function saveToLibrary() {
    if (!name.trim()) return
    const saved = await window.api.monsters.save({
      name: name.trim(),
      hp: toInt(hp) ?? null,
      ac: toInt(ac) ?? null,
      init_mod: toInt(initMod) ?? 0,
      cr,
      xp: toInt(xp) ?? 0
    })
    setCustom((list) => [saved, ...list.filter((m) => m.id !== saved.id && m.name !== saved.name)])
    setSavedNote('Saved to My monsters')
    setTimeout(() => setSavedNote(''), 2000)
  }

  async function removeCustom(id: string) {
    await window.api.monsters.delete(id)
    setCustom((list) => list.filter((m) => m.id !== id))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Add monsters</p>

      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          className="input text-xs pl-7"
          placeholder="Search bestiary…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {matches.length > 0 && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface-raised border border-border shadow-2xl max-h-64 overflow-y-auto">
            {matches.map((m) => (
              <div key={m.key} className="flex items-center group">
                <button
                  type="button"
                  onClick={() => pick(m)}
                  className="flex-1 flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
                >
                  <span className="text-slate-200 truncate">
                    {m.name}
                    {m.custom && <span className="ml-1.5 text-[9px] uppercase tracking-wider text-amber-400">mine</span>}
                  </span>
                  <span className="text-slate-500 flex-shrink-0">CR {m.cr || '?'} · AC {m.ac ?? '—'} · {m.hp ?? '—'}hp</span>
                </button>
                {m.custom && (
                  <button
                    type="button"
                    onClick={() => removeCustom(m.custom!.id)}
                    className="px-2 text-slate-700 hover:text-red-400 transition-colors"
                    title="Delete from My monsters"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        className="input text-sm"
        placeholder="Name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
      />

      <div className="grid grid-cols-3 gap-2">
        {([
          ['HP', hp, setHp, '—'],
          ['AC', ac, setAc, '—'],
          ['Init mod', initMod, setInitMod, '0']
        ] as [string, string, (v: string) => void, string][]).map(([label, val, set, ph]) => (
          <div key={label}>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">{label}</label>
            <input
              className="input text-sm mt-0.5 text-center"
              placeholder={ph}
              value={val}
              onChange={(e) => set(e.target.value.replace(/[^0-9-]/g, ''))}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">XP each</label>
          <input className="input text-sm mt-0.5 text-center" placeholder="0" value={xp} onChange={(e) => setXp(e.target.value.replace(/[^0-9]/g, ''))} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">How many</label>
          <input className="input text-sm mt-0.5 text-center" value={count} onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ''))} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
        <input type="checkbox" checked={rollInit} onChange={(e) => setRollInit(e.target.checked)} /> Roll initiative (d20 + mod)
      </label>
      {rollInit && (toInt(count) ?? 1) > 1 && (
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer -mt-1">
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} /> One roll for the whole group
        </label>
      )}

      <button
        type="submit"
        disabled={!name.trim()}
        className="btn-primary w-full flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={14} /> Add to encounter
      </button>
      <button
        type="button"
        onClick={saveToLibrary}
        disabled={!name.trim()}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] uppercase tracking-wider border border-border text-slate-500 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-30"
      >
        <Save size={11} /> {savedNote || 'Save to my monsters'}
      </button>
    </form>
  )
}
