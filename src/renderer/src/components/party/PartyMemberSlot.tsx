import { useState, useEffect } from 'react'
import { UserCircle2, ChevronDown, ChevronUp, Trash2, Edit } from 'lucide-react'
import type { PartyMember, Reputation } from '../../types'
import { ResourceTracker } from './ResourceTracker'
import { FactionRepBar } from './FactionRepBar'

export function PartyMemberSlot({
  member,
  onUpdate,
  onDelete,
  onEdit
}: {
  member: PartyMember
  onUpdate: (m: PartyMember) => void
  onDelete: () => void
  onEdit: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [reps, setReps] = useState<Reputation[]>([])

  useEffect(() => {
    loadRep()
  }, [member.id])

  async function loadRep() {
    const data = await window.api.party.getReputation(member.id)
    setReps(data as Reputation[])
  }

  async function handleResourceChange(resources: PartyMember['resources']) {
    await window.api.party.updateResources(member.id, resources)
    onUpdate({ ...member, resources })
  }

  async function handleRepChange(factionId: string, score: number) {
    await window.api.party.setReputation(member.id, factionId, score)
    setReps((prev) => prev.map((r) => (r.faction_id === factionId ? { ...r, score } : r)))
  }

  async function handleInitiativeChange(val: string) {
    const num = val === '' ? null : parseInt(val)
    await window.api.party.updateInitiative(member.id, isNaN(num as number) ? null : num)
    onUpdate({ ...member, initiative: num })
  }

  return (
    <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-surface-overlay flex items-center justify-center">
          {member.avatar_path ? (
            <img src={`file://${member.avatar_path}`} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <UserCircle2 size={24} className="text-slate-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{member.name}</p>
          {member.player_name && (
            <p className="text-xs text-slate-500 truncate">{member.player_name}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">Init</span>
            <input
              type="number"
              value={member.initiative ?? ''}
              onChange={(e) => handleInitiativeChange(e.target.value)}
              placeholder="—"
              className="w-12 text-center bg-surface-overlay border border-border rounded text-xs text-slate-200
                         focus:outline-none focus:border-amber-500/60 py-1"
            />
          </div>
          <button onClick={onEdit} className="text-slate-500 hover:text-slate-300 transition-colors">
            <Edit size={14} />
          </button>
          <button onClick={onDelete} className="text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-2">Resources</p>
            <ResourceTracker resources={member.resources} onChange={handleResourceChange} />
          </div>

          {reps.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-2">Faction Reputation</p>
              <div className="space-y-2.5">
                {reps.map((r) => (
                  <FactionRepBar
                    key={r.faction_id}
                    rep={r}
                    onScoreChange={(score) => handleRepChange(r.faction_id, score)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
