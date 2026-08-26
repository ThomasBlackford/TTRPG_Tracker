import { useState } from 'react'
import { Plus, Dices } from 'lucide-react'
import type { EncounterState } from '../../types'

interface Props {
  onAdd: (data: { name: string; hp_max?: number; ac?: number; initiative?: number }) => Promise<EncounterState>
}

export function AddMonsterForm({ onAdd }: Props) {
  const [name, setName] = useState('')
  const [hp, setHp] = useState('')
  const [ac, setAc] = useState('')
  const [init, setInit] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd({
      name: name.trim(),
      hp_max: hp ? parseInt(hp) : undefined,
      ac: ac ? parseInt(ac) : undefined,
      initiative: init ? parseInt(init) : undefined,
    })
    setName('')
    setHp('')
    setAc('')
    setInit('')
  }

  function rollInit() {
    setInit(String(Math.floor(Math.random() * 20) + 1))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Add Monster</p>

      <input
        className="input w-full text-sm"
        placeholder="Name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
      />

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-slate-500">Init</label>
          <input
            className="input w-full text-sm mt-0.5"
            placeholder="—"
            value={init}
            onChange={(e) => setInit(e.target.value)}
            type="number"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">HP</label>
          <input
            className="input w-full text-sm mt-0.5"
            placeholder="—"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            type="number"
            min={0}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">AC</label>
          <input
            className="input w-full text-sm mt-0.5"
            placeholder="—"
            value={ac}
            onChange={(e) => setAc(e.target.value)}
            type="number"
            min={0}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={rollInit}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border
                   border-border text-slate-400 hover:text-amber-300 hover:border-amber-500/40 transition-colors"
      >
        <Dices size={12} /> Roll Initiative (d20)
      </button>

      <button
        type="submit"
        disabled={!name.trim()}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm
                   bg-rose-500/20 border border-rose-500/40 text-rose-300
                   hover:bg-rose-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={14} /> Add Monster
      </button>
    </form>
  )
}
