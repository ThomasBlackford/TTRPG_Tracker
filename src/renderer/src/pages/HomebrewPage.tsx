import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Copy, Download, Upload, Search, Crown, Skull, Wand2 } from 'lucide-react'
import type { CustomItem, ItemRarity, MonsterTemplate, Statblock } from '../types'
import { crToXp } from '../lib/dnd5e'
import { confirmAsync } from '../lib/confirm'

type Tab = 'monsters' | 'items'

const RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']
const CATEGORIES = ['weapon', 'armor', 'wondrous', 'potion', 'scroll', 'ring', 'rod', 'wand', 'gear', 'treasure']
const SCORES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

const toInt = (s: string): number | null => {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

function rechargeText(list: { name: string; min: number }[]): string {
  return list.map((r) => `${r.name} ${r.min}`).join(', ')
}

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

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[10px] uppercase tracking-wider text-slate-500">{label}</label>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

// ── Monster editor ──────────────────────────────────────────────────────────

interface MonsterDraft {
  id?: string
  name: string
  cr: string
  xp: string
  ac: string
  hp: string
  init_mod: string
  size: string
  type: string
  speed: string
  scores: Record<(typeof SCORES)[number], string>
  saves: string
  skills: string
  resistances: string
  senses: string
  languages: string
  traits: string
  actions: string
  reactions: string
  legendaryCount: string
  legendaryResist: string
  legendaryText: string
  recharges: string
  lair: boolean
  lairText: string
  notes: string
}

function blankMonster(): MonsterDraft {
  return {
    name: '', cr: '', xp: '', ac: '', hp: '', init_mod: '0', size: '', type: '', speed: '',
    scores: { str: '10', dex: '10', con: '10', int: '10', wis: '10', cha: '10' },
    saves: '', skills: '', resistances: '', senses: '', languages: '', traits: '', actions: '', reactions: '',
    legendaryCount: '', legendaryResist: '', legendaryText: '', recharges: '', lair: false, lairText: '', notes: ''
  }
}

function toDraft(m: MonsterTemplate): MonsterDraft {
  const s = m.statblock ?? {}
  const score = (k: (typeof SCORES)[number]) => String(s[k] ?? 10)
  return {
    id: m.id, name: m.name, cr: m.cr, xp: String(m.xp || ''), ac: m.ac != null ? String(m.ac) : '', hp: m.hp != null ? String(m.hp) : '',
    init_mod: String(m.init_mod),
    size: s.size ?? '', type: s.type ?? '', speed: s.speed ?? '',
    scores: { str: score('str'), dex: score('dex'), con: score('con'), int: score('int'), wis: score('wis'), cha: score('cha') },
    saves: s.saves ?? '', skills: s.skills ?? '', resistances: s.resistances ?? '', senses: s.senses ?? '', languages: s.languages ?? '',
    traits: s.traits ?? '', actions: s.actions ?? '', reactions: s.reactions ?? '',
    legendaryCount: m.legendary_actions ? String(m.legendary_actions) : '', legendaryResist: m.legendary_resistances ? String(m.legendary_resistances) : '',
    legendaryText: s.legendary ?? '', recharges: rechargeText(m.recharges ?? []), lair: !!m.lair, lairText: s.lair ?? '', notes: m.notes ?? ''
  }
}

function statblockOf(d: MonsterDraft): Statblock {
  const sb: Statblock = {
    size: d.size.trim(), type: d.type.trim(), speed: d.speed.trim(),
    saves: d.saves.trim(), skills: d.skills.trim(), resistances: d.resistances.trim(), senses: d.senses.trim(), languages: d.languages.trim(),
    traits: d.traits, actions: d.actions, reactions: d.reactions, legendary: d.legendaryText, lair: d.lairText
  }
  for (const k of SCORES) sb[k] = toInt(d.scores[k]) ?? 10
  return sb
}

function MonsterEditor({ draft, onChange, onSave, onDelete, onDuplicate }: {
  draft: MonsterDraft
  onChange: (d: MonsterDraft) => void
  onSave: () => void
  onDelete?: () => void
  onDuplicate?: () => void
}) {
  const set = <K extends keyof MonsterDraft>(k: K, v: MonsterDraft[K]) => onChange({ ...draft, [k]: v })
  const text = (k: keyof MonsterDraft, placeholder = '') => (
    <input className="input text-sm" placeholder={placeholder} value={draft[k] as string} onChange={(e) => set(k, e.target.value as never)} />
  )
  const area = (k: keyof MonsterDraft, placeholder: string, rows = 3) => (
    <textarea className="input text-sm resize-y" rows={rows} placeholder={placeholder} value={draft[k] as string} onChange={(e) => set(k, e.target.value as never)} />
  )
  const num = (k: keyof MonsterDraft, placeholder = '') => (
    <input className="input text-sm text-center" placeholder={placeholder} value={draft[k] as string} onChange={(e) => set(k, e.target.value.replace(/[^0-9-]/g, '') as never)} />
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_5rem_6rem] gap-3">
        <Field label="Name *">{text('name', 'Ancient Bone Wyrm')}</Field>
        <Field label="CR">
          <input className="input text-sm text-center" placeholder="5" value={draft.cr}
            onChange={(e) => {
              const cr = e.target.value.replace(/[^0-9/]/g, '')
              onChange({ ...draft, cr, xp: draft.xp && draft.xp !== String(crToXp(draft.cr)) ? draft.xp : String(crToXp(cr) || '') })
            }} />
        </Field>
        <Field label="XP">{num('xp', '0')}</Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="AC">{num('ac', '—')}</Field>
        <Field label="HP">{num('hp', '—')}</Field>
        <Field label="Initiative mod">{num('init_mod', '0')}</Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Size">{text('size', 'Large')}</Field>
        <Field label="Type">{text('type', 'Undead dragon')}</Field>
        <Field label="Speed">{text('speed', '40 ft., fly 80 ft.')}</Field>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {SCORES.map((k) => (
          <Field key={k} label={k.toUpperCase()}>
            <input className="input text-sm text-center" value={draft.scores[k]}
              onChange={(e) => onChange({ ...draft, scores: { ...draft.scores, [k]: e.target.value.replace(/[^0-9]/g, '') } })} />
          </Field>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Saving throws">{text('saves', 'Dex +6, Con +10')}</Field>
        <Field label="Skills">{text('skills', 'Perception +9, Stealth +6')}</Field>
        <Field label="Resist / immune">{text('resistances', 'Necrotic, poison')}</Field>
        <Field label="Senses">{text('senses', 'Darkvision 120 ft.')}</Field>
      </div>
      <Field label="Languages">{text('languages', 'Common, Draconic')}</Field>

      <Field label="Traits">{area('traits', 'Passive abilities, one per line.', 3)}</Field>
      <Field label="Actions">{area('actions', 'Multiattack. Bite. Claw. Breath weapon…', 5)}</Field>
      <Field label="Reactions">{area('reactions', 'Optional.', 2)}</Field>

      <div className="border border-border p-4 space-y-3 bg-surface-base/40">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-300/90"><Crown size={12} /> Boss features</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Legendary actions per round">{num('legendaryCount', '0')}</Field>
          <Field label="Legendary resistances / day">{num('legendaryResist', '0')}</Field>
        </div>
        <Field label="Legendary actions (text)">{area('legendaryText', 'Detect. Tail Attack. Wing Attack (costs 2)…', 3)}</Field>
        <Field label="Recharge abilities — name, then the lowest d6 that recharges it">{text('recharges', 'Fire Breath 5, Tail Sweep 6')}</Field>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input type="checkbox" checked={draft.lair} onChange={(e) => set('lair', e.target.checked)} /> Has lair actions (adds an initiative-20 turn)
        </label>
        {draft.lair && <Field label="Lair actions (text)">{area('lairText', 'On initiative count 20 (losing ties)…', 3)}</Field>}
      </div>

      <Field label="Notes">{area('notes', 'Tactics, where it lives, how it should feel.', 3)}</Field>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={onSave} disabled={!draft.name.trim()} className="btn-primary disabled:opacity-40">Save monster</button>
        {onDuplicate && <button onClick={onDuplicate} className="btn-ghost flex items-center gap-1.5 border !border-border"><Copy size={13} /> Duplicate</button>}
        {onDelete && <button onClick={onDelete} className="btn-danger ml-auto flex items-center gap-1.5"><Trash2 size={13} /> Delete</button>}
      </div>
    </div>
  )
}

// ── Item editor ─────────────────────────────────────────────────────────────

interface ItemDraft {
  id?: string
  name: string
  category: string
  rarity: ItemRarity
  attunement: boolean
  value_gp: string
  damage: string
  damage_type: string
  description: string
}

const blankItem = (): ItemDraft => ({ name: '', category: 'wondrous', rarity: 'uncommon', attunement: false, value_gp: '', damage: '', damage_type: '', description: '' })

function ItemEditor({ draft, onChange, onSave, onDelete, onDuplicate }: {
  draft: ItemDraft
  onChange: (d: ItemDraft) => void
  onSave: () => void
  onDelete?: () => void
  onDuplicate?: () => void
}) {
  return (
    <div className="space-y-4">
      <Field label="Name *">
        <input className="input text-sm" placeholder="Lantern of the Drowned King" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Category">
          <select className="input text-sm" value={draft.category} onChange={(e) => onChange({ ...draft, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Rarity">
          <select className="input text-sm" value={draft.rarity} onChange={(e) => onChange({ ...draft, rarity: e.target.value as ItemRarity })}>
            {RARITIES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Value (gp)">
          <input className="input text-sm text-center" value={draft.value_gp} onChange={(e) => onChange({ ...draft, value_gp: e.target.value.replace(/[^0-9.]/g, '') })} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
        <input type="checkbox" checked={draft.attunement} onChange={(e) => onChange({ ...draft, attunement: e.target.checked })} /> Requires attunement
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Damage (weapons)">
          <input className="input text-sm" placeholder="1d8+1" value={draft.damage} onChange={(e) => onChange({ ...draft, damage: e.target.value })} />
        </Field>
        <Field label="Damage type">
          <input className="input text-sm" placeholder="slashing" value={draft.damage_type} onChange={(e) => onChange({ ...draft, damage_type: e.target.value })} />
        </Field>
      </div>
      <Field label="Description">
        <textarea className="input text-sm resize-y" rows={6} placeholder="What it does, how it's used, any curse…" value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} />
      </Field>
      <p className="text-[11px] text-slate-600">Weapons with a damage entry become an attack on the player's sheet when you give them the item.</p>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={onSave} disabled={!draft.name.trim()} className="btn-primary disabled:opacity-40">Save item</button>
        {onDuplicate && <button onClick={onDuplicate} className="btn-ghost flex items-center gap-1.5 border !border-border"><Copy size={13} /> Duplicate</button>}
        {onDelete && <button onClick={onDelete} className="btn-danger ml-auto flex items-center gap-1.5"><Trash2 size={13} /> Delete</button>}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export function HomebrewPage() {
  const [tab, setTab] = useState<Tab>('monsters')
  const [monsters, setMonsters] = useState<MonsterTemplate[]>([])
  const [items, setItems] = useState<CustomItem[]>([])
  const [query, setQuery] = useState('')
  const [monster, setMonster] = useState<MonsterDraft | null>(null)
  const [item, setItem] = useState<ItemDraft | null>(null)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  async function load() {
    const [m, i] = await Promise.all([window.api.monsters.list(), window.api.items.list()])
    setMonsters(m)
    setItems(i)
  }
  useEffect(() => { load() }, [])

  function flash(text: string, error = false) {
    setStatus({ text, error })
    setTimeout(() => setStatus(null), 5000)
  }

  const q = query.trim().toLowerCase()
  const shownMonsters = useMemo(() => monsters.filter((m) => !q || m.name.toLowerCase().includes(q)), [monsters, q])
  const shownItems = useMemo(() => items.filter((i) => !q || i.name.toLowerCase().includes(q)), [items, q])

  async function saveMonster() {
    if (!monster || !monster.name.trim()) return
    const saved = await window.api.monsters.save({
      id: monster.id,
      name: monster.name.trim(),
      cr: monster.cr.trim(),
      xp: toInt(monster.xp) ?? 0,
      ac: toInt(monster.ac),
      hp: toInt(monster.hp),
      init_mod: toInt(monster.init_mod) ?? 0,
      notes: monster.notes,
      legendary_actions: toInt(monster.legendaryCount) ?? 0,
      legendary_resistances: toInt(monster.legendaryResist) ?? 0,
      recharges: parseRecharges(monster.recharges),
      lair: monster.lair,
      statblock: statblockOf(monster)
    })
    await load()
    setMonster(toDraft(saved))
    flash(`Saved ${saved.name}.`)
  }

  async function saveItem() {
    if (!item || !item.name.trim()) return
    const saved = await window.api.items.save({
      id: item.id, name: item.name.trim(), category: item.category, rarity: item.rarity, attunement: item.attunement,
      value_gp: parseFloat(item.value_gp) || 0, damage: item.damage.trim(), damage_type: item.damage_type.trim(), description: item.description
    })
    await load()
    setItem({ id: saved.id, name: saved.name, category: saved.category, rarity: saved.rarity, attunement: saved.attunement, value_gp: saved.value_gp ? String(saved.value_gp) : '', damage: saved.damage, damage_type: saved.damage_type, description: saved.description })
    flash(`Saved ${saved.name}.`)
  }

  async function removeMonster() {
    if (!monster?.id) return
    if (!(await confirmAsync({ title: `Delete ${monster.name}?`, confirmLabel: 'Delete', danger: true }))) return
    await window.api.monsters.delete(monster.id)
    setMonster(null)
    load()
  }

  async function removeItem() {
    if (!item?.id) return
    if (!(await confirmAsync({ title: `Delete ${item.name}?`, confirmLabel: 'Delete', danger: true }))) return
    await window.api.items.delete(item.id)
    setItem(null)
    load()
  }

  async function doExport() {
    const r = await window.api.homebrew.export()
    if (r.canceled) return
    flash(r.ok ? `Exported ${r.monsters} monster${r.monsters === 1 ? '' : 's'} and ${r.items} item${r.items === 1 ? '' : 's'}.` : r.error ?? 'Export failed.', !r.ok)
  }

  async function doImport() {
    const r = await window.api.homebrew.import()
    if (r.canceled) return
    if (!r.ok) return flash(r.error ?? 'Import failed.', true)
    flash(`Imported: ${r.added} new, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped` : ''}.`)
    load()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-surface-raised flex-shrink-0 flex-wrap">
        <div>
          <h2 className="font-display text-xl text-white uppercase tracking-widest">Homebrew</h2>
          <p className="text-slate-500 text-xs mt-0.5">Your own monsters and magic items — used in encounters, the builder and the loot roller.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {status && <span className={`text-xs ${status.error ? 'text-red-400' : 'text-emerald-400'}`}>{status.text}</span>}
          <button onClick={doImport} className="btn-ghost flex items-center gap-1.5 border !border-border !py-1.5 text-xs"><Upload size={13} /> Import</button>
          <button onClick={doExport} className="btn-ghost flex items-center gap-1.5 border !border-border !py-1.5 text-xs"><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
          <div className="flex border-b border-border">
            {([['monsters', 'Monsters', Skull], ['items', 'Items', Wand2]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] uppercase tracking-wider border-b-2 -mb-px transition-colors ${tab === id ? 'text-white border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                <Icon size={12} /> {label} <span className="text-slate-600">{id === 'monsters' ? monsters.length : items.length}</span>
              </button>
            ))}
          </div>
          <div className="p-3 space-y-2 border-b border-border">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input className="input text-xs pl-7" placeholder="Filter…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button
              onClick={() => (tab === 'monsters' ? setMonster(blankMonster()) : setItem(blankItem()))}
              className="btn-primary w-full flex items-center justify-center gap-1.5 !py-1.5 text-xs"
            >
              <Plus size={13} /> New {tab === 'monsters' ? 'monster' : 'item'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tab === 'monsters'
              ? shownMonsters.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMonster(toDraft(m))}
                    className={`w-full text-left px-4 py-2.5 border-b border-border/60 transition-colors ${monster?.id === m.id ? 'bg-amber-500/10' : 'hover:bg-white/[0.03]'}`}
                  >
                    <p className="text-sm text-slate-100 truncate flex items-center gap-1.5">
                      {m.name} {m.legendary_actions > 0 && <Crown size={11} className="text-amber-300" />}
                    </p>
                    <p className="text-[11px] text-slate-500">CR {m.cr || '?'} · AC {m.ac ?? '—'} · {m.hp ?? '—'} HP</p>
                  </button>
                ))
              : shownItems.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => setItem({ id: i.id, name: i.name, category: i.category, rarity: i.rarity, attunement: i.attunement, value_gp: i.value_gp ? String(i.value_gp) : '', damage: i.damage, damage_type: i.damage_type, description: i.description })}
                    className={`w-full text-left px-4 py-2.5 border-b border-border/60 transition-colors ${item?.id === i.id ? 'bg-amber-500/10' : 'hover:bg-white/[0.03]'}`}
                  >
                    <p className="text-sm text-slate-100 truncate">{i.name}</p>
                    <p className="text-[11px] text-slate-500 capitalize">{i.rarity} · {i.category}</p>
                  </button>
                ))}
            {((tab === 'monsters' && shownMonsters.length === 0) || (tab === 'items' && shownItems.length === 0)) && (
              <p className="text-xs text-slate-600 p-4">{q ? 'Nothing matches.' : `No ${tab} yet — add one, or import a file from another DM.`}</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-6">
            {tab === 'monsters' ? (
              monster ? (
                <MonsterEditor
                  draft={monster}
                  onChange={setMonster}
                  onSave={saveMonster}
                  onDelete={monster.id ? removeMonster : undefined}
                  onDuplicate={monster.id ? () => setMonster({ ...monster, id: undefined, name: `${monster.name} (copy)` }) : undefined}
                />
              ) : (
                <p className="text-sm text-slate-600 mt-10 text-center">Pick a monster on the left, or make a new one.</p>
              )
            ) : item ? (
              <ItemEditor
                draft={item}
                onChange={setItem}
                onSave={saveItem}
                onDelete={item.id ? removeItem : undefined}
                onDuplicate={item.id ? () => setItem({ ...item, id: undefined, name: `${item.name} (copy)` }) : undefined}
              />
            ) : (
              <p className="text-sm text-slate-600 mt-10 text-center">Pick an item on the left, or make a new one.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
