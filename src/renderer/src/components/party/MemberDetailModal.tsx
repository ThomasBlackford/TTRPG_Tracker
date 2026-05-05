import { useState, useEffect } from 'react'
import { X, UserCircle2, Minus, Plus } from 'lucide-react'
import type { PartyMember, Reputation } from '../../types'
import { FactionRepBar } from './FactionRepBar'

export function MemberDetailModal({
  member,
  onClose
}: {
  member: PartyMember
  onClose: () => void
}) {
  const [reps, setReps] = useState<Reputation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.party.getReputation(member.id).then((data) => {
      setReps(data as Reputation[])
      setLoading(false)
    })
  }, [member.id])

  async function handleRepChange(factionId: string, score: number) {
    const clamped = Math.min(100, Math.max(-100, score))
    await window.api.party.setReputation(member.id, factionId, clamped)
    setReps((prev) =>
      prev.map((r) => (r.faction_id === factionId ? { ...r, score: clamped } : r))
    )
  }

  function nudge(factionId: string, delta: number) {
    const current = reps.find((r) => r.faction_id === factionId)?.score ?? 0
    handleRepChange(factionId, current + delta)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal max-w-lg mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-border flex-shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-surface-overlay flex items-center justify-center">
            {member.avatar_path ? (
              <img src={`file://${member.avatar_path}`} alt={member.name} className="w-full h-full object-cover" />
            ) : (
              <UserCircle2 size={28} className="text-slate-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold text-white truncate">{member.name}</h2>
            {member.player_name && (
              <p className="text-sm text-slate-500">{member.player_name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Faction Rep Section */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
              Faction Reputation
            </p>
            <p className="text-xs text-slate-600">Click bar to set · ±5 buttons to nudge</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reps.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No factions in your library yet.</p>
              <p className="text-slate-600 text-xs mt-1">Create Faction cards to track reputation here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reps.map((rep) => (
                <div key={rep.faction_id} className="space-y-2">
                  <FactionRepBar rep={rep} onScoreChange={(s) => handleRepChange(rep.faction_id, s)} />
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => nudge(rep.faction_id, -10)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-overlay border border-border
                                 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-colors text-xs"
                    >
                      <Minus size={11} /> 10
                    </button>
                    <button
                      onClick={() => nudge(rep.faction_id, -5)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-overlay border border-border
                                 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-colors text-xs"
                    >
                      <Minus size={11} /> 5
                    </button>
                    <button
                      onClick={() => handleRepChange(rep.faction_id, 0)}
                      className="px-3 py-1 rounded-lg bg-surface-overlay border border-border
                                 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors text-xs"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => nudge(rep.faction_id, 5)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-overlay border border-border
                                 text-slate-400 hover:text-green-400 hover:border-green-500/30 transition-colors text-xs"
                    >
                      <Plus size={11} /> 5
                    </button>
                    <button
                      onClick={() => nudge(rep.faction_id, 10)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-overlay border border-border
                                 text-slate-400 hover:text-green-400 hover:border-green-500/30 transition-colors text-xs"
                    >
                      <Plus size={11} /> 10
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
