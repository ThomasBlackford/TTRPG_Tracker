import { useState } from 'react'
import { Plus, Save, Crown, ChevronDown, ChevronRight } from 'lucide-react'
import type { EncounterState, Statblock } from '../../types'
import { crToXp } from '../../lib/dnd5e'
import { useMonsterLibrary } from '../../lib/monsterLibrary'
import type { LibraryEntry } from '../../lib/monsterLibrary'
import { MonsterPicker } from './MonsterPicker'

export interface MonsterInput {
  name: string
  hp_max?: number
  ac?: number
  init_mod?: number
  xp?: number
  count?: number
  rollInitiative?: boolean
  grouped?: boolean
  legendary_actions?: number
  legendary_resistances?: number
  recharges?: { name: string; min: number }[]
  lair?: boolean
  statblock?: Statblock | null
}

interface Props {
  onAdd: (data: MonsterInput) => Promise<EncounterState>
}

const toInt = (s: string): number | undefined => {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : undefined
}

// "Fire Breath 5, Cold Breath 6" → [{name, min}] and back.
function parseRecharges(text: string): { name: string; min: number }[] {
  return text
    .split(',')
    .map((part) => {
      const m = part.trim().match(/^(.*?)(?:\s+(\d))?$/)
      const name = (m?.[1] ?? '').trim()
      return name ? { name, min: Math.max(2, Math.min(6, parseInt(m?.[2] ?? '5', 10) || 5)) } : null
    })
    .filter((x): x is { name: string; min: number } => !!x)
}

function recharges(list: { name: string; min: number }[]): string {
  return list.map((r) => `${r.name} ${r.min}`).join(', ')
}

// Pick from the built-in bestiary or your own saved monsters (or type a
// one-off), choose how many, and add — numbered copies and initiative rolled
// for you, either per creature or once for the whole pack.
export function AddMonsterForm({ onAdd }: Props) {
  const { library, setCustom } = useMonsterLibrary()
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
  const [boss, setBoss] = useState(false)
  const [legendary, setLegendary] = useState('')
  const [legRes, setLegRes] = useState('')
  const [rechargeText, setRechargeText] = useState('')
  const [lair, setLair] = useState(false)
  const [statblock, setStatblock] = useState<Statblock | null>(null)

  function pick(m: LibraryEntry) {
    setName(m.name)
    setHp(m.hp != null ? String(m.hp) : '')
    setAc(m.ac != null ? String(m.ac) : '')
    setInitMod(String(m.init))
    setXp(String(m.xp || crToXp(m.cr)))
    setCr(m.cr)
    setLegendary(m.legendary ? String(m.legendary) : '')
    setLegRes(m.legres ? String(m.legres) : '')
    setRechargeText(recharges(m.recharges))
    setLair(m.lair)
    setStatblock(m.statblock)
    setBoss(m.legendary > 0 || m.legres > 0 || m.recharges.length > 0 || m.lair)
  }

  function current(): MonsterInput {
    return {
      name: name.trim(),
      hp_max: toInt(hp),
      ac: toInt(ac),
      init_mod: toInt(initMod) ?? 0,
      xp: toInt(xp) ?? 0,
      legendary_actions: toInt(legendary) ?? 0,
      legendary_resistances: toInt(legRes) ?? 0,
      recharges: parseRecharges(rechargeText),
      lair,
      statblock
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd({
      ...current(),
      count: toInt(count) ?? 1,
      rollInitiative: rollInit,
      grouped: grouped && (toInt(count) ?? 1) > 1
    })
  }

  async function saveToLibrary() {
    if (!name.trim()) return
    const c = current()
    const saved = await window.api.monsters.save({
      name: c.name,
      hp: c.hp_max ?? null,
      ac: c.ac ?? null,
      init_mod: c.init_mod ?? 0,
      cr,
      xp: c.xp ?? 0,
      legendary_actions: c.legendary_actions,
      legendary_resistances: c.legendary_resistances,
      recharges: c.recharges,
      lair: c.lair,
      statblock: c.statblock
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

      <MonsterPicker library={library} onPick={pick} onDeleteCustom={removeCustom} />

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

      <div>
        <button
          type="button"
          onClick={() => setBoss((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 hover:text-slate-200 transition-colors"
        >
          {boss ? <ChevronDown size={11} /> : <ChevronRight size={11} />} <Crown size={11} /> Boss options
        </button>
        {boss && (
          <div className="mt-2 space-y-2 pl-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Legendary actions</label>
                <input className="input text-sm mt-0.5 text-center" placeholder="0" value={legendary} onChange={(e) => setLegendary(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Legend. resist.</label>
                <input className="input text-sm mt-0.5 text-center" placeholder="0" value={legRes} onChange={(e) => setLegRes(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500">Recharge abilities</label>
              <input
                className="input text-sm mt-0.5"
                placeholder="Fire Breath 5, Tail Sweep 6"
                value={rechargeText}
                onChange={(e) => setRechargeText(e.target.value)}
                title="Name, then the lowest d6 roll that recharges it"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={lair} onChange={(e) => setLair(e.target.checked)} /> Lair actions (initiative 20)
            </label>
          </div>
        )}
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
