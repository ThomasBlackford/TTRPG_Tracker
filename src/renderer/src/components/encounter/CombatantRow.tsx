import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import type { Combatant, Condition, EncounterState } from '../../types'
import { ConditionBadge, ConditionPicker } from './ConditionBadge'

interface Props {
  combatant: Combatant
  rank: number
  isCurrent: boolean
  onUpdate: (id: string, changes: Partial<Combatant>) => Promise<EncounterState>
  onRemove: (id: string) => void
}

export function CombatantRow({ combatant, rank, isCurrent, onUpdate, onRemove }: Props) {
  const [hpCurrent, setHpCurrent] = useState(String(combatant.hp_current ?? ''))
  const [showConditions, setShowConditions] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHpCurrent(String(combatant.hp_current ?? ''))
  }, [combatant.hp_current])

  useEffect(() => {
    if (!showConditions) return
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowConditions(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showConditions])

  function commitHp() {
    const val = parseInt(hpCurrent)
    const next = isNaN(val) ? null : val
    if (next !== combatant.hp_current) {
      onUpdate(combatant.id, { hp_current: next ?? undefined })
    }
  }

  function toggleCondition(c: Condition) {
    const current = combatant.conditions
    const next = current.includes(c)
      ? current.filter((x) => x !== c)
      : [...current, c]
    onUpdate(combatant.id, { conditions: next })
  }

  const isParty = combatant.type === 'party'

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
        isCurrent
          ? 'bg-amber-500/15 border-amber-500/40'
          : 'bg-surface-raised border-border hover:border-border'
      }`}
    >
      {/* Rank */}
      <div
        className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
          isCurrent ? 'bg-amber-500 text-black' : 'bg-surface-overlay text-slate-400'
        }`}
      >
        {rank}
      </div>

      {/* Name + type indicator */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-sm font-medium truncate ${
              isParty ? 'text-sky-300' : 'text-rose-300'
            }`}
          >
            {combatant.name}
          </span>
          {combatant.ac != null && (
            <span className="text-xs text-slate-500 flex-shrink-0">AC {combatant.ac}</span>
          )}
        </div>

        {/* Conditions row */}
        <div className="relative flex items-center gap-1 mt-1 flex-wrap" ref={pickerRef}>
          {combatant.conditions.map((c) => (
            <ConditionBadge
              key={c}
              condition={c}
              onRemove={() => toggleCondition(c)}
            />
          ))}
          <button
            onClick={() => setShowConditions((v) => !v)}
            className="w-4 h-4 flex items-center justify-center rounded text-slate-600 hover:text-slate-400 hover:bg-white/5 transition-colors"
            title="Add condition"
          >
            <Plus size={10} />
          </button>
          {showConditions && (
            <ConditionPicker
              active={combatant.conditions}
              onToggle={toggleCondition}
              onClose={() => setShowConditions(false)}
            />
          )}
        </div>
      </div>

      {/* HP */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <input
          className="w-10 text-center text-xs bg-surface-overlay border border-border rounded px-1 py-0.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
          value={hpCurrent}
          onChange={(e) => setHpCurrent(e.target.value)}
          onBlur={commitHp}
          onKeyDown={(e) => e.key === 'Enter' && commitHp()}
          placeholder="HP"
          title="Current HP"
        />
        {combatant.hp_max != null && (
          <span className="text-xs text-slate-600">/{combatant.hp_max}</span>
        )}
      </div>

      {/* Initiative */}
      <div className="flex-shrink-0">
        {combatant.initiative != null ? (
          <span className="text-xs text-slate-400 w-6 text-center inline-block">
            {combatant.initiative}
          </span>
        ) : (
          <span className="text-xs text-slate-600 w-6 text-center inline-block">—</span>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(combatant.id)}
        className="flex-shrink-0 p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        title="Remove"
      >
        <X size={12} />
      </button>
    </div>
  )
}
