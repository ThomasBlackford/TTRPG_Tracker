import { useState } from 'react'
import { Sparkles, Dices, X, Check } from 'lucide-react'
import type { Combatant, ConcentrationCheck, RollResult } from '../../types'
import { abilityMod } from './StatblockView'

export interface PendingCheck extends ConcentrationCheck {
  at: number
}

interface Props {
  checks: PendingCheck[]
  combatants: Combatant[]
  rolls: RollResult[]
  onResolve: (check: PendingCheck, passed: boolean) => void
  onDismiss: (check: PendingCheck) => void
}

function Card({ check, combatant, roll, onResolve, onDismiss }: {
  check: PendingCheck
  combatant?: Combatant
  roll?: RollResult
  onResolve: (passed: boolean) => void
  onDismiss: () => void
}) {
  const defaultMod = combatant?.statblock?.con != null ? abilityMod(combatant.statblock.con) : 0
  const [mod, setMod] = useState(String(defaultMod))
  const [rolled, setRolled] = useState<{ natural: number; total: number } | null>(null)
  const isPlayer = !!check.clientId

  function rollSave() {
    const natural = Math.floor(Math.random() * 20) + 1
    const m = parseInt(mod) || 0
    setRolled({ natural, total: natural + m })
  }

  const result = isPlayer && roll ? { total: roll.total, natural: roll.natural } : rolled
  const passed = result ? result.total >= check.dc : null

  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-purple-500/40 bg-purple-500/10 text-xs flex-wrap">
      <Sparkles size={13} className="text-purple-300 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-slate-100">
          <span className="font-medium">{check.name}</span> — Constitution save to keep
          {check.spell ? <> <span className="text-purple-200">{check.spell}</span></> : ' concentration'}
          <span className="ml-2 text-white font-semibold">DC {check.dc}</span>
        </p>
        {isPlayer && !roll && <p className="text-[11px] text-slate-500">Waiting for them to roll on their own device…</p>}
      </div>

      <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
        {!isPlayer && !rolled && (
          <>
            <label className="flex items-center gap-1 text-[11px] text-slate-500">
              CON mod
              <input
                className="w-10 text-center bg-surface-overlay border border-border px-1 py-0.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                value={mod}
                onChange={(e) => setMod(e.target.value.replace(/[^0-9-]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && rollSave()}
              />
            </label>
            <button onClick={rollSave} className="flex items-center gap-1 px-2 py-1 border border-border text-slate-300 hover:text-white hover:border-purple-400/60 transition-colors">
              <Dices size={12} /> Roll
            </button>
          </>
        )}

        {result && (
          <span className={`font-display text-lg ${passed ? 'text-emerald-300' : 'text-red-400'}`}>
            {result.total} <span className="text-[11px] font-sans">{passed ? 'holds' : 'breaks'}</span>
          </span>
        )}

        {(!isPlayer || result) && (
          <>
            <button
              onClick={() => onResolve(true)}
              className={`flex items-center gap-1 px-2 py-1 border transition-colors ${passed === true ? 'border-emerald-400 text-emerald-200 bg-emerald-500/15' : 'border-border text-slate-400 hover:text-emerald-300 hover:border-emerald-500/50'}`}
            >
              <Check size={12} /> Keeps it
            </button>
            <button
              onClick={() => onResolve(false)}
              className={`flex items-center gap-1 px-2 py-1 border transition-colors ${passed === false ? 'border-red-400 text-red-200 bg-red-500/15' : 'border-border text-slate-400 hover:text-red-300 hover:border-red-500/50'}`}
            >
              <X size={12} /> Loses it
            </button>
          </>
        )}
        <button onClick={onDismiss} className="text-slate-600 hover:text-slate-300 transition-colors" title="Dismiss"><X size={13} /></button>
      </div>
    </div>
  )
}

// Damage to a concentrating creature asks for a Constitution save. A player's
// own app prompts them and reports back; for monsters the DM rolls here.
export function ConcentrationChecks({ checks, combatants, rolls, onResolve, onDismiss }: Props) {
  if (checks.length === 0) return null
  return (
    <div className="space-y-1.5 mb-3">
      {checks.map((c) => {
        const roll = c.clientId
          ? rolls.find((r) => r.clientId === c.clientId && r.at >= c.at && (r.kind === 'concentration' || /concentration/i.test(r.label)))
          : undefined
        return (
          <Card
            key={`${c.combatantId}-${c.at}`}
            check={c}
            combatant={combatants.find((x) => x.id === c.combatantId)}
            roll={roll}
            onResolve={(passed) => onResolve(c, passed)}
            onDismiss={() => onDismiss(c)}
          />
        )
      })}
    </div>
  )
}
