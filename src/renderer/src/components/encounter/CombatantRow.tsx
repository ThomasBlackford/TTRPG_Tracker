import { useState, useRef, useEffect } from 'react'
import { X, Plus, Minus, Skull, Dices, Sparkles, Timer } from 'lucide-react'
import type { Combatant, CombatEffect, Condition, EncounterState, PlayerSnapshot } from '../../types'
import { ConditionBadge, ConditionPicker } from './ConditionBadge'

type DamageMode = 'normal' | 'half' | 'double'

interface Props {
  combatant: Combatant
  rank: number
  isCurrent: boolean
  live?: PlayerSnapshot & { online: boolean } // the linked player's latest synced sheet, for party combatants
  onUpdate: (id: string, changes: Partial<Combatant>) => Promise<EncounterState>
  onApplyHp: (id: string, amount: number, mode: DamageMode) => Promise<void>
  onRemove: (id: string) => void
}

export function CombatantRow({ combatant, rank, isCurrent, live, onUpdate, onApplyHp, onRemove }: Props) {
  const [hpCurrent, setHpCurrent] = useState(String(combatant.hp_current ?? ''))
  const [hpDelta, setHpDelta] = useState('')
  const [mode, setMode] = useState<DamageMode>('normal')
  const [showConditions, setShowConditions] = useState(false)
  const [showEffectForm, setShowEffectForm] = useState(false)
  const [effectLabel, setEffectLabel] = useState('')
  const [effectRounds, setEffectRounds] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHpCurrent(String(combatant.hp_current ?? ''))
  }, [combatant.hp_current])

  useEffect(() => {
    if (!showConditions) return
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowConditions(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showConditions])

  const isParty = combatant.type === 'party'
  const isMonster = combatant.type === 'monster'
  const isDown = combatant.hp_current != null && combatant.hp_current <= 0
  const playerLive = isParty && !!combatant.clientId && !!live?.online

  function commitHp() {
    const val = parseInt(hpCurrent)
    const next = isNaN(val) ? null : val
    if (next !== combatant.hp_current) onUpdate(combatant.id, { hp_current: next })
  }

  function apply(sign: 1 | -1) {
    const amount = Math.abs(parseInt(hpDelta))
    if (!amount) return
    onApplyHp(combatant.id, sign * amount, sign < 0 ? mode : 'normal')
    setHpDelta('')
    if (sign < 0) setMode('normal')
  }

  function toggleCondition(c: Condition) {
    const on = !combatant.conditions.includes(c)
    const next = on ? [...combatant.conditions, c] : combatant.conditions.filter((x) => x !== c)
    onUpdate(combatant.id, { conditions: next })
    // A player's conditions live on their own sheet — keep it in step.
    if (playerLive && combatant.clientId) {
      window.api.partySync.command(combatant.clientId, { cmd: 'condition', condition: c, on })
    }
  }

  function rollInitiative() {
    onUpdate(combatant.id, { initiative: Math.floor(Math.random() * 20) + 1 + combatant.init_mod })
  }

  function addEffect() {
    if (!effectLabel.trim()) return
    const rounds = parseInt(effectRounds)
    const effect: CombatEffect = {
      id: crypto.randomUUID(),
      label: effectLabel.trim(),
      rounds: Number.isFinite(rounds) && rounds > 0 ? rounds : null
    }
    onUpdate(combatant.id, { effects: [...combatant.effects, effect] })
    setEffectLabel('')
    setEffectRounds('')
    setShowEffectForm(false)
  }

  function removeEffect(id: string) {
    onUpdate(combatant.id, { effects: combatant.effects.filter((e) => e.id !== id) })
  }

  const hpPct =
    combatant.hp_max && combatant.hp_current != null
      ? Math.max(0, Math.min(100, (combatant.hp_current / combatant.hp_max) * 100))
      : null
  const hpBar = hpPct == null ? '' : hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-400' : 'bg-red-500'

  return (
    <div
      className={`relative border transition-colors ${
        isCurrent ? 'bg-amber-500/10 border-amber-500/50' : 'bg-surface-raised border-border hover:border-slate-700'
      } ${isDown && !isParty ? 'opacity-50 grayscale' : ''}`}
    >
      {isCurrent && <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'var(--gradient-brand)' }} />}

      <div className="flex items-center gap-3 px-3 py-2.5">
        <div
          className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-xs font-bold ${
            isCurrent ? 'bg-amber-500 text-white' : 'bg-surface-overlay text-slate-400'
          }`}
        >
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-sm font-medium truncate ${isParty ? 'text-sky-300' : 'text-rose-300'}`}>
              {combatant.name}
            </span>
            {isDown && <Skull size={12} className="text-slate-400 flex-shrink-0" />}
            {combatant.ac != null && <span className="text-xs text-slate-500 flex-shrink-0">AC {combatant.ac}</span>}
            {isParty && live && !live.online && (
              <span className="text-[10px] uppercase tracking-wider text-slate-600 flex-shrink-0">offline</span>
            )}
          </div>

          {isDown && isParty && live && (
            <p className="text-[10px] uppercase tracking-wider text-red-400 mt-0.5">
              Death saves ✓{live.death_save_successes ?? 0} ✗{live.death_save_failures ?? 0}
            </p>
          )}

          <div className="relative flex items-center gap-1 mt-1 flex-wrap" ref={pickerRef}>
            {combatant.conditions.map((c) => (
              <ConditionBadge key={c} condition={c} onRemove={() => toggleCondition(c)} />
            ))}
            {combatant.effects.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-purple-900/60 border border-purple-500/40 text-purple-100"
                title={e.rounds == null ? e.label : `${e.label} — ${e.rounds} round${e.rounds === 1 ? '' : 's'} left`}
              >
                <Timer size={9} />
                {e.label}
                {e.rounds != null && <span className="text-purple-300">·{e.rounds}</span>}
                <button onClick={() => removeEffect(e.id)} className="opacity-60 hover:opacity-100 leading-none">×</button>
              </span>
            ))}
            <button
              onClick={() => setShowConditions((v) => !v)}
              className="w-4 h-4 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
              title="Add condition"
            >
              <Plus size={10} />
            </button>
            <button
              onClick={() => setShowEffectForm((v) => !v)}
              className={`w-4 h-4 flex items-center justify-center transition-colors hover:bg-white/5 ${showEffectForm ? 'text-purple-300' : 'text-slate-600 hover:text-slate-300'}`}
              title="Add a timed effect"
            >
              <Timer size={10} />
            </button>
            {showConditions && (
              <ConditionPicker active={combatant.conditions} onToggle={toggleCondition} onClose={() => setShowConditions(false)} />
            )}
          </div>

          {showEffectForm && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                className="input text-xs py-1 flex-1 min-w-0"
                placeholder="Effect (e.g. Hold Person)"
                value={effectLabel}
                onChange={(e) => setEffectLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEffect()}
                autoFocus
              />
              <input
                className="input text-xs py-1 w-16 text-center"
                placeholder="rounds"
                value={effectRounds}
                onChange={(e) => setEffectRounds(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && addEffect()}
                title="Leave blank to keep until removed"
              />
              <button onClick={addEffect} className="text-xs text-amber-400 hover:text-amber-300 px-1">Add</button>
            </div>
          )}
        </div>

        {/* Concentration */}
        <button
          onClick={() => onUpdate(combatant.id, { concentrating: !combatant.concentrating })}
          title={combatant.concentrating ? 'Concentrating — taking damage prompts a save. Click to drop.' : 'Mark as concentrating'}
          className={`flex-shrink-0 transition-colors ${combatant.concentrating ? 'text-purple-300' : 'text-slate-700 hover:text-purple-400'}`}
        >
          <Sparkles size={14} fill={combatant.concentrating ? 'currentColor' : 'none'} />
        </button>

        {/* HP */}
        <div className="flex flex-col items-stretch gap-1 flex-shrink-0 w-32">
          <div className="flex items-center justify-between gap-1">
            {isMonster ? (
              <input
                className="w-12 text-center text-xs bg-surface-overlay border border-border px-1 py-0.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                value={hpCurrent}
                onChange={(e) => setHpCurrent(e.target.value)}
                onBlur={commitHp}
                onKeyDown={(e) => e.key === 'Enter' && commitHp()}
                placeholder="HP"
                title="Current HP"
              />
            ) : (
              <span className="text-xs text-slate-200 w-12 text-center" title={playerLive ? "Live from the player's sheet" : 'Last known'}>
                {combatant.hp_current ?? '—'}
              </span>
            )}
            <span className="text-xs text-slate-600">/ {combatant.hp_max ?? '—'}</span>
            {live && live.hp_temp > 0 && <span className="text-[10px] text-sky-400">+{live.hp_temp}</span>}
          </div>
          {hpPct != null && (
            <div className="h-1 bg-surface-base overflow-hidden">
              <div className={`h-full transition-[width] ${hpBar}`} style={{ width: `${hpPct}%` }} />
            </div>
          )}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => apply(-1)}
              title={playerLive ? 'Deal damage (applied on their sheet)' : 'Deal damage'}
              className="w-6 h-6 flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/25 transition-colors"
            >
              <Minus size={11} />
            </button>
            <input
              className="flex-1 min-w-0 text-center text-xs bg-surface-overlay border border-border px-0.5 py-1 text-slate-300 focus:outline-none focus:border-amber-500/50"
              value={hpDelta}
              onChange={(e) => setHpDelta(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && apply(-1)}
              placeholder="0"
              title="Amount"
            />
            <button
              onClick={() => apply(1)}
              title="Heal"
              className="w-6 h-6 flex items-center justify-center bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
            >
              <Plus size={11} />
            </button>
          </div>
          <div className="flex gap-0.5 text-[9px] uppercase tracking-wider">
            {(['half', 'double'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode((cur) => (cur === m ? 'normal' : m))}
                className={`flex-1 py-0.5 border transition-colors ${
                  mode === m ? 'border-amber-500/60 text-amber-300 bg-amber-500/10' : 'border-border text-slate-600 hover:text-slate-300'
                }`}
                title={m === 'half' ? 'Next damage is halved (resistance / save)' : 'Next damage is doubled (vulnerability / crit)'}
              >
                {m === 'half' ? '½ dmg' : '×2 dmg'}
              </button>
            ))}
          </div>
        </div>

        {/* Initiative */}
        <div className="flex flex-col items-center flex-shrink-0 w-12">
          <div className="flex items-center gap-0.5">
            {isMonster && (
              <button
                onClick={rollInitiative}
                title={`Roll d20 ${combatant.init_mod >= 0 ? '+' : ''}${combatant.init_mod}`}
                className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-amber-300 hover:bg-white/5 transition-colors"
              >
                <Dices size={12} />
              </button>
            )}
            <span className={`text-sm w-6 text-center inline-block ${combatant.initiative != null ? 'text-slate-200 font-medium' : 'text-slate-600'}`}>
              {combatant.initiative ?? '—'}
            </span>
          </div>
          {isMonster && (
            <span className="text-[9px] uppercase tracking-wider text-slate-600">
              {combatant.init_mod >= 0 ? '+' : ''}{combatant.init_mod}
            </span>
          )}
        </div>

        <button
          onClick={() => onRemove(combatant.id)}
          className="flex-shrink-0 p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Remove"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
