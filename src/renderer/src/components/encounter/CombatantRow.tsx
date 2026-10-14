import { useState, useRef, useEffect } from 'react'
import { X, Plus, Minus, Skull, Dices, Sparkles, Timer, BookOpen, Crown, ChevronDown, ChevronRight, Landmark, HeartPulse, PawPrint } from 'lucide-react'
import type { Combatant, CombatEffect, Condition, EncounterState, PlayerSnapshot } from '../../types'
import { ConditionBadge, ConditionPicker } from './ConditionBadge'
import { ResourceStrip, summarize } from './ResourceStrip'
import { StatblockView, hasStatblockContent } from './StatblockView'

type DamageMode = 'normal' | 'half' | 'double'

interface Props {
  combatant: Combatant
  rank: number
  isCurrent: boolean
  live?: PlayerSnapshot & { online: boolean } // the linked player's latest synced sheet, for party combatants
  ownerName?: string // for a companion: whose it is
  attackerId?: string | null // whoever is acting right now — recorded as the source of damage in the log
  onUpdate: (id: string, changes: Partial<Combatant>, label?: string) => Promise<EncounterState>
  onApplyHp: (id: string, amount: number, mode: DamageMode, sourceId?: string | null) => Promise<void>
  onRemove: (id: string) => void
  onState: (s: EncounterState) => void // for actions that return a fresh encounter
}

function Pips({ n, max, tone }: { n: number; max: number; tone: string }) {
  return (
    <span className="inline-flex gap-[3px]">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`w-2 h-2 border ${i < n ? tone : 'border-slate-700'}`} />
      ))}
    </span>
  )
}

// Needs the matching Companion update to do anything on the player's sheet.
const STABILISE_READY = false

export function CombatantRow({ combatant, rank, isCurrent, live, ownerName, attackerId, onUpdate, onApplyHp, onRemove, onState }: Props) {
  const [hpCurrent, setHpCurrent] = useState(String(combatant.hp_current ?? ''))
  const [hpDelta, setHpDelta] = useState('')
  const [mode, setMode] = useState<DamageMode>('normal')
  const [showConditions, setShowConditions] = useState(false)
  const [showEffectForm, setShowEffectForm] = useState(false)
  const [effectLabel, setEffectLabel] = useState('')
  const [effectRounds, setEffectRounds] = useState('')
  const [showStatblock, setShowStatblock] = useState(false)
  const [showResources, setShowResources] = useState(false)
  const [askSpell, setAskSpell] = useState(false)
  const [spell, setSpell] = useState('')
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

  const isCompanion = !!combatant.companion_id
  const isParty = combatant.type === 'party'
  const isMonster = combatant.type === 'monster'
  const isDown = combatant.hp_current != null && combatant.hp_current <= 0
  const playerLive = isParty && !isCompanion && !!combatant.clientId && !!live?.online
  const stable = !!live && (live.death_save_successes ?? 0) >= 3
  const dead = !!live && (live.death_save_failures ?? 0) >= 3
  const hasBoss = combatant.legendary_max > 0 || combatant.legres_max > 0 || combatant.recharges.length > 0
  const showSheet = hasStatblockContent(combatant.statblock)

  // ── Lair actions: not a creature, just a reminder that the place acts ────
  if (combatant.is_lair) {
    return (
      <div className={`relative border transition-colors ${isCurrent ? 'bg-amber-500/10 border-amber-500/50' : 'bg-surface-raised border-border'}`}>
        {isCurrent && <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'var(--gradient-brand)' }} />}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-amber-500 text-white' : 'bg-surface-overlay text-slate-400'}`}>{rank}</div>
          <Landmark size={14} className="text-purple-300 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-purple-200 truncate">{combatant.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              {isCurrent ? 'Lair actions — the lair acts now' : 'Lair actions · initiative 20 (losing ties)'}
            </p>
          </div>
          <button onClick={() => onRemove(combatant.id)} className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remove">
            <X size={12} />
          </button>
        </div>
      </div>
    )
  }

  function commitHp() {
    const val = parseInt(hpCurrent)
    const next = isNaN(val) ? null : val
    if (next !== combatant.hp_current) onUpdate(combatant.id, { hp_current: next })
  }

  function apply(sign: 1 | -1) {
    const amount = Math.abs(parseInt(hpDelta))
    if (!amount) return
    onApplyHp(combatant.id, sign * amount, sign < 0 ? mode : 'normal', sign < 0 ? attackerId : null)
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
    onUpdate(combatant.id, { initiative: Math.floor(Math.random() * 20) + 1 + combatant.init_mod }, `Roll initiative for ${combatant.name}`)
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

  function toggleConcentration() {
    if (combatant.concentrating) {
      onUpdate(combatant.id, { concentrating: false, concentration_spell: '' })
      return
    }
    // Players' concentration comes from their sheet; for everyone else, name the spell.
    onUpdate(combatant.id, { concentrating: true })
    setAskSpell(true)
  }

  function saveSpell() {
    onUpdate(combatant.id, { concentrating: true, concentration_spell: spell.trim() })
    setSpell('')
    setAskSpell(false)
  }

  const hpPct =
    combatant.hp_max && combatant.hp_current != null
      ? Math.max(0, Math.min(100, (combatant.hp_current / combatant.hp_max) * 100))
      : null
  const hpBar = hpPct == null ? '' : hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-400' : 'bg-red-500'
  const sum = live ? summarize(live) : null

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
            {isCompanion && <PawPrint size={12} className="text-teal-300 flex-shrink-0" />}
            <span className={`text-sm font-medium truncate ${isCompanion ? 'text-teal-300' : isParty ? 'text-sky-300' : 'text-rose-300'}`}>
              {combatant.name}
            </span>
            {isCompanion && ownerName && <span className="text-[10px] text-slate-500 flex-shrink-0 truncate">{ownerName}'s</span>}
            {isDown && <Skull size={12} className="text-slate-400 flex-shrink-0" />}
            {combatant.ac != null && <span className="text-xs text-slate-500 flex-shrink-0">AC {combatant.ac}</span>}
            {isParty && !isCompanion && live && !live.online && (
              <span className="text-[10px] uppercase tracking-wider text-slate-600 flex-shrink-0">offline</span>
            )}
            {combatant.legendary_max > 0 && <Crown size={12} className="text-amber-300 flex-shrink-0" aria-label="Legendary creature" />}
            {showSheet && (
              <button
                onClick={() => setShowStatblock((v) => !v)}
                className={`flex-shrink-0 transition-colors ${showStatblock ? 'text-amber-300' : 'text-slate-600 hover:text-slate-300'}`}
                title="Stat block"
              >
                <BookOpen size={12} />
              </button>
            )}
          </div>

          {isDown && isParty && !isCompanion && live && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className={`text-[10px] uppercase tracking-wider ${dead ? 'text-red-500' : stable ? 'text-emerald-400' : 'text-red-400'}`}>
                {dead ? 'Dead' : stable ? 'Stable' : 'Dying'} · saves ✓{live.death_save_successes ?? 0} ✗{live.death_save_failures ?? 0}
              </p>
              {STABILISE_READY && !dead && !stable && live.online && (
                <button
                  onClick={async () => onState(await window.api.encounter.stabilize(combatant.id))}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                  title="Stabilise them (Spare the Dying, a Medicine check)"
                >
                  <HeartPulse size={10} /> Stabilise
                </button>
              )}
            </div>
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

          {combatant.concentrating && !askSpell && (
            <p className="text-[10px] text-purple-300 mt-1 flex items-center gap-1">
              <Sparkles size={9} /> Concentrating{combatant.concentration_spell ? ` on ${combatant.concentration_spell}` : ''}
            </p>
          )}
          {askSpell && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                className="input text-xs py-1 flex-1 min-w-0"
                placeholder="Concentrating on… (optional)"
                value={spell}
                onChange={(e) => setSpell(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveSpell(); if (e.key === 'Escape') setAskSpell(false) }}
                autoFocus
              />
              <button onClick={saveSpell} className="text-xs text-amber-400 hover:text-amber-300 px-1">Set</button>
            </div>
          )}

          {/* Legendary actions, resistances and recharge abilities */}
          {hasBoss && (
            <div className="flex items-center gap-x-4 gap-y-1.5 mt-1.5 flex-wrap text-[11px]">
              {combatant.legendary_max > 0 && (
                <span className="inline-flex items-center gap-1.5" title="Legendary actions — refresh at the start of its turn">
                  <span className="text-amber-300/80 uppercase tracking-wider text-[10px]">Legendary</span>
                  <Pips n={combatant.legendary_current} max={combatant.legendary_max} tone="border-amber-400 bg-amber-400" />
                  <button
                    disabled={combatant.legendary_current <= 0}
                    onClick={async () => onState(await window.api.encounter.spendLegendary(combatant.id, 1))}
                    className="px-1.5 py-0.5 border border-border text-slate-400 hover:text-white hover:border-amber-500/60 transition-colors disabled:opacity-30"
                  >
                    Use 1
                  </button>
                  {combatant.legendary_current >= 2 && (
                    <button
                      onClick={async () => onState(await window.api.encounter.spendLegendary(combatant.id, 2))}
                      className="px-1.5 py-0.5 border border-border text-slate-400 hover:text-white hover:border-amber-500/60 transition-colors"
                    >
                      Use 2
                    </button>
                  )}
                </span>
              )}
              {combatant.legres_max > 0 && (
                <span className="inline-flex items-center gap-1.5" title="Legendary Resistance — turns a failed save into a success">
                  <span className="text-purple-300/80 uppercase tracking-wider text-[10px]">Resist</span>
                  <Pips n={combatant.legres_current} max={combatant.legres_max} tone="border-purple-400 bg-purple-400" />
                  <button
                    disabled={combatant.legres_current <= 0}
                    onClick={async () => onState(await window.api.encounter.useLegendaryResistance(combatant.id))}
                    className="px-1.5 py-0.5 border border-border text-slate-400 hover:text-white hover:border-purple-500/60 transition-colors disabled:opacity-30"
                  >
                    Use
                  </button>
                </span>
              )}
              {combatant.recharges.map((r) => (
                <button
                  key={r.id}
                  onClick={async () => onState(await window.api.encounter.setRecharge(combatant.id, r.id, !r.ready))}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 border transition-colors ${
                    r.ready ? 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20' : 'border-border text-slate-500 hover:text-slate-300'
                  }`}
                  title={r.ready ? 'Ready — click when used' : `Spent — rolls to recharge (${r.min}${r.min < 6 ? '–6' : ''}) at the start of its turn. Click to mark ready.`}
                >
                  <Dices size={10} /> {r.name} <span className="opacity-60">{r.min}{r.min < 6 ? '–6' : ''}</span>
                  <span className="uppercase tracking-wider text-[9px]">{r.ready ? 'ready' : 'spent'}</span>
                </button>
              ))}
            </div>
          )}

          {/* A player's slots, hit dice and resources */}
          {live && !isCompanion && sum && (sum.slotsMax > 0 || sum.hitDice || live.resources.length > 0 || (live.features?.length ?? 0) > 0) && (
            <div className="mt-1.5">
              <button
                onClick={() => setShowResources((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showResources ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                <span className={sum.low ? 'text-red-300' : ''}>
                  {sum.slotsMax > 0 && <>Slots {sum.slotsLeft}/{sum.slotsMax}</>}
                  {sum.slotsMax > 0 && sum.hitDice && ' · '}
                  {sum.hitDice && <>HD {sum.hitDice}</>}
                  {sum.slotsMax === 0 && !sum.hitDice && 'Resources'}
                </span>
              </button>
              {showResources && (
                <div className="mt-1.5 pl-3.5">
                  <ResourceStrip snapshot={live} dense />
                </div>
              )}
            </div>
          )}

          {showStatblock && combatant.statblock && (
            <div className="mt-2.5 p-3 border border-border bg-surface-base/60 max-h-72 overflow-y-auto">
              <StatblockView statblock={combatant.statblock} />
            </div>
          )}
        </div>

        {/* Concentration */}
        <button
          onClick={toggleConcentration}
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
              <span className="text-xs text-slate-200 w-12 text-center" title={playerLive || isCompanion ? "Live from the player's sheet" : 'Last known'}>
                {combatant.hp_current ?? '—'}
              </span>
            )}
            <span className="text-xs text-slate-600">/ {combatant.hp_max ?? '—'}</span>
            {live && live.hp_temp > 0 && !isCompanion && <span className="text-[10px] text-sky-400">+{live.hp_temp}</span>}
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
            {(isMonster || isCompanion) && (
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
          {(isMonster || isCompanion) && (
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
