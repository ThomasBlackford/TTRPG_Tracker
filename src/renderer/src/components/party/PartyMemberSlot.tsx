import { useState } from 'react'
import { UserCircle2, ChevronDown, ChevronUp, Trash2, Edit } from 'lucide-react'
import type { PartyMember } from '../../types'
import { ResourceTracker } from './ResourceTracker'

export function PartyMemberSlot({
  member,
  onUpdate,
  onDelete,
  onEdit,
  onOpenDetail
}: {
  member: PartyMember
  onUpdate: (m: PartyMember) => void
  onDelete: () => void
  onEdit: () => void
  onOpenDetail: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  async function handleResourceChange(resources: PartyMember['resources']) {
    await window.api.party.updateResources(member.id, resources)
    onUpdate({ ...member, resources })
  }

  return (
    <div className="bg-surface-raised border border-border rounded-xl overflow-hidden card-hover">
      {/* Header — clicking avatar/name area opens detail modal */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onOpenDetail}
          className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-surface-overlay
                     flex items-center justify-center ring-2 ring-transparent
                     hover:ring-amber-500/50 transition-all"
          title="View faction reputation"
        >
          {member.avatar_path ? (
            <img src={`file://${member.avatar_path}`} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <UserCircle2 size={24} className="text-slate-500" />
          )}
        </button>

        <button
          onClick={onOpenDetail}
          className="flex-1 min-w-0 text-left group"
          title="View faction reputation"
        >
          <p className="text-sm font-semibold text-slate-100 truncate group-hover:text-amber-300 transition-colors">
            {member.name}
          </p>
          {member.player_name && (
            <p className="text-xs text-slate-500 truncate">{member.player_name}</p>
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" title="Set from the player's own app">
            <span className="text-xs text-slate-500">Init</span>
            <span className="w-8 text-center text-xs text-slate-300 py-1">
              {member.initiative ?? '—'}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-slate-600 hover:text-red-400 transition-colors"
          >
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
        <div className="px-4 pb-4 border-t border-border pt-3">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-2">Resources</p>
          <ResourceTracker resources={member.resources} onChange={handleResourceChange} />
        </div>
      )}
    </div>
  )
}
