import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Swords, SkipForward } from 'lucide-react'
import type { EncounterState, Combatant } from '../types'
import { CombatantRow } from '../components/encounter/CombatantRow'
import { AddMonsterForm } from '../components/encounter/AddMonsterForm'

export function EncounterPage() {
  const [state, setState] = useState<EncounterState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.encounter.getState().then((s) => {
      setState(s)
      setLoading(false)
    })
  }, [])

  async function handleStart() {
    const s = await window.api.encounter.start()
    setState(s)
  }

  async function handleEnd() {
    if (!confirm('End this encounter? All combatants will be cleared.')) return
    const s = await window.api.encounter.end()
    setState(s)
  }

  async function handleNext() {
    const s = await window.api.encounter.nextTurn()
    setState(s)
  }

  async function handlePrev() {
    const s = await window.api.encounter.prevTurn()
    setState(s)
  }

  async function handleUpdate(id: string, changes: Partial<Combatant>) {
    const s = await window.api.encounter.updateCombatant(id, changes)
    setState(s)
    return s
  }

  async function handleRemove(id: string) {
    const s = await window.api.encounter.removeCombatant(id)
    setState(s)
  }

  async function handleAddMonster(data: { name: string; hp_max?: number; ac?: number; initiative?: number }) {
    const s = await window.api.encounter.addMonster(data)
    setState(s)
    return s
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-600 text-sm">Loading…</p>
      </div>
    )
  }

  if (!state?.isActive) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <Swords size={48} className="text-slate-700 mx-auto mb-4" />
          <h2 className="font-display text-xl text-slate-300 mb-2">No Active Encounter</h2>
          <p className="text-slate-500 text-sm max-w-xs">
            Start an encounter to import party members and begin tracking initiative, HP, and conditions.
          </p>
        </div>
        <button
          onClick={handleStart}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/20 border border-amber-500/40
                     text-amber-300 hover:bg-amber-500/30 transition-colors font-medium"
        >
          <Swords size={18} /> Start Encounter
        </button>
      </div>
    )
  }

  const { round, currentIndex, combatants } = state
  const currentCombatant = combatants[currentIndex]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display text-amber-400 font-semibold text-lg">
            Round {round}
          </span>
          {currentCombatant && (
            <span className="text-sm text-slate-400">
              — <span className="text-white">{currentCombatant.name}</span>'s turn
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={combatants.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-border
                       text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <button
            onClick={handleNext}
            disabled={combatants.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border
                       bg-amber-500/20 border-amber-500/40 text-amber-300
                       hover:bg-amber-500/30 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <SkipForward size={13} />
          </button>
          <button
            onClick={handleEnd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border
                       border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            End Encounter
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Combatant list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {combatants.length === 0 ? (
            <p className="text-slate-600 text-sm text-center mt-8">
              No combatants yet. Add monsters on the right.
            </p>
          ) : (
            combatants.map((c, i) => (
              <CombatantRow
                key={c.id}
                combatant={c}
                rank={i + 1}
                isCurrent={i === currentIndex}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
              />
            ))
          )}
        </div>

        {/* Right panel: add monster */}
        <div className="w-56 flex-shrink-0 border-l border-border bg-surface-raised p-4 overflow-y-auto">
          <AddMonsterForm onAdd={handleAddMonster} />

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-slate-600">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-400 mr-1.5" />
              Party members
            </p>
            <p className="text-xs text-slate-600 mt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-400 mr-1.5" />
              Monsters
            </p>
            <p className="text-xs text-slate-600 mt-3">
              HP shown on TV only for party members.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
