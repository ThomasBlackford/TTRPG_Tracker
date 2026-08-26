import { useState, useRef, useEffect } from 'react'
import { X, Plus, Minus, Skull, Dices } from 'lucide-react'
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
  const [hpDelta, setHpDelta] = useState('')
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

  function applyDelta(sign: 1 | -1) {
    const amount = Math.abs(parseInt(hpDelta))
    if (!amount) return
    const base = combatant.hp_current ?? 0
    let next = base + sign * amount
    next = Math.max(0, next)
    if (combatant.hp_max != null) next = Math.min(combatant.hp_max, next)
    onUpdate(combatant.id, { hp_current: next })
  }

  function toggleCondition(c: Condition) {
    const current = combatant.conditions
    const next = current.includes(c)
      ? current.filter((x) => x !== c)
      : [...current, c]
    onUpdate(combatant.id, { conditions: next })
  }

  function rollInitiative() {
    onUpdate(combatant.id, { initiative: Math.floor(Math.random() * 20) + 1 })
  }

  const isParty = combatant.type === 'party'
  const isMonster = combatant.type === 'monster'
  const isDown = combatant.hp_current != null && combatant.hp_current <= 0

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
        isCurrent
          ? 'bg-amber-500/15 border-amber-500/40'
          : 'bg-surface-raised border-border hover:border-border'
      } ${isDown ? 'opacity-50 grayscale' : ''}`}
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
          {isDown && (
            <span title="Down (0 HP)" className="flex-shrink-0">
              <Skull size={12} className="text-slate-400" />
            </span>
          )}
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

      {/* HP — party members track and report their own HP from their
          Companion app; the DM only edits it directly for monsters. */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        {isParty ? (
          <div className="flex items-center gap-1" title="Synced from the player's own app">
            <span className="w-10 text-center text-xs text-slate-300">
              {combatant.hp_current ?? '—'}
            </span>
            {combatant.hp_max != null && (
              <span className="text-xs text-slate-600">/{combatant.hp_max}</span>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1">
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
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => applyDelta(-1)}
                title="Apply damage"
                className="w-5 h-5 flex items-center justify-center rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Minus size={11} />
              </button>
              <input
                className="w-8 text-center text-xs bg-surface-overlay border border-border rounded px-0.5 py-0.5 text-slate-300 focus:outline-none focus:border-amber-500/50"
                value={hpDelta}
                onChange={(e) => setHpDelta(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && applyDelta(-1)}
                placeholder="0"
                title="Amount to apply"
              />
              <button
                onClick={() => applyDelta(1)}
                title="Apply healing"
                className="w-5 h-5 flex items-center justify-center rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <Plus size={11} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Initiative */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {isMonster && (
          <button
            onClick={rollInitiative}
            title="Roll d20 initiative"
            className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-amber-300 hover:bg-white/5 transition-colors"
          >
            <Dices size={12} />
          </button>
        )}
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
