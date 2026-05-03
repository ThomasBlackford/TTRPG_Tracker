import type { PartyMember } from '../../types'
import { Swords } from 'lucide-react'

export function InitiativeTracker({ members }: { members: PartyMember[] }) {
  const inCombat = members.filter((m) => m.initiative !== null)
    .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))

  if (inCombat.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-600 py-3">
        <Swords size={16} />
        <p className="text-sm">Set initiative values above to begin combat tracking.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {inCombat.map((m, i) => (
        <div
          key={m.id}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
            i === 0
              ? 'border-amber-500/40 bg-amber-500/8 text-amber-300'
              : 'border-border bg-surface-overlay text-slate-300'
          }`}
        >
          <span className="text-xs font-mono w-4 text-center opacity-50">{i + 1}</span>
          <span className="font-semibold text-lg w-10 text-center">{m.initiative}</span>
          <span className="text-sm font-medium">{m.name}</span>
          {m.player_name && <span className="text-xs text-slate-500 ml-auto">{m.player_name}</span>}
        </div>
      ))}
    </div>
  )
}
