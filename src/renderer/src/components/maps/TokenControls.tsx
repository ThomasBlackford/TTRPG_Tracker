import { useState } from 'react'
import { Eye, EyeOff, Trash2, Swords, Plus } from 'lucide-react'
import type { MapToken } from '../../types'

interface Props {
  tokens: MapToken[]
  selectedId: string | null
  encounterActive: boolean
  onPlaceCombatants: () => void
  onAdd: (name: string, kind: 'party' | 'monster' | 'npc', size: number) => void
  onSelect: (id: string | null) => void
  onUpdate: (id: string, changes: Partial<MapToken>) => void
  onDelete: (id: string) => void
}

const SIZES: { label: string; value: number }[] = [
  { label: 'Medium', value: 1 },
  { label: 'Large', value: 2 },
  { label: 'Huge', value: 3 },
  { label: 'Garg.', value: 4 }
]

const KIND_COLOR: Record<MapToken['kind'], string> = { party: '#3b82f6', monster: '#a3142a', npc: '#d4a017' }

// Sub-toolbar for the Tokens tool: drop the whole encounter onto the map, add
// one-offs, resize, hide (stage an ambush the table can't see yet) and remove.
export function TokenControls({ tokens, selectedId, encounterActive, onPlaceCombatants, onAdd, onSelect, onUpdate, onDelete }: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'party' | 'monster' | 'npc'>('monster')
  const [size, setSize] = useState(1)
  const selected = tokens.find((t) => t.id === selectedId) ?? null

  return (
    <div className="border-b border-border bg-surface-raised/80 px-4 py-2.5 flex-shrink-0 space-y-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onPlaceCombatants}
          disabled={!encounterActive}
          title={encounterActive ? 'Place a token for every combatant that does not have one on this map' : 'Start an encounter first'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border text-slate-200 hover:text-white hover:border-amber-500/60 transition-colors disabled:opacity-40 disabled:hover:border-border disabled:hover:text-slate-200"
        >
          <Swords size={13} /> Place encounter
        </button>

        <div className="flex items-center gap-1.5">
          <input
            className="input text-xs py-1 w-36"
            placeholder="New token name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) { onAdd(name.trim(), kind, size); setName('') }
            }}
          />
          <select className="input text-xs py-1 w-24" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="monster">Monster</option>
            <option value="party">Party</option>
            <option value="npc">NPC</option>
          </select>
          <select className="input text-xs py-1 w-24" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button
            disabled={!name.trim()}
            onClick={() => { onAdd(name.trim(), kind, size); setName('') }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border text-slate-300 hover:text-white hover:border-amber-500/60 transition-colors disabled:opacity-40"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        <span className="text-[11px] text-slate-600 ml-auto">Drag tokens to move them · the current turn glows</span>
      </div>

      {tokens.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tokens.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(selectedId === t.id ? null : t.id)}
              className={`flex items-center gap-1.5 px-2 py-1 text-[11px] border transition-colors ${
                selectedId === t.id ? 'border-amber-500/70 text-white bg-amber-500/10' : 'border-border text-slate-400 hover:text-slate-200'
              } ${t.hidden ? 'opacity-50' : ''}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: t.color || KIND_COLOR[t.kind] }} />
              {t.name}
              {t.hidden && <EyeOff size={10} />}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
          <span className="text-xs text-white font-medium mr-1">{selected.name}</span>
          <select
            className="input text-xs py-1 w-24"
            value={selected.size}
            onChange={(e) => onUpdate(selected.id, { size: Number(e.target.value) })}
          >
            {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button
            onClick={() => onUpdate(selected.id, { hidden: !selected.hidden })}
            className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
          >
            {selected.hidden ? <Eye size={12} /> : <EyeOff size={12} />} {selected.hidden ? 'Reveal to players' : 'Hide from players'}
          </button>
          <button
            onClick={() => onDelete(selected.id)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} /> Remove
          </button>
        </div>
      )}
    </div>
  )
}
