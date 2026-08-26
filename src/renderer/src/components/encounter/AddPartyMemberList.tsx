import { UserPlus } from 'lucide-react'
import type { PartyMember } from '../../types'

interface Props {
  available: PartyMember[]
  onAdd: (memberId: string) => void
}

export function AddPartyMemberList({ available, onAdd }: Props) {
  if (available.length === 0) return null

  return (
    <div className="space-y-2 mb-5">
      <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Add Player</p>
      <div className="space-y-1.5">
        {available.map((m) => (
          <button
            key={m.id}
            onClick={() => onAdd(m.id)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                       bg-sky-500/10 border border-sky-500/30 text-sky-300
                       hover:bg-sky-500/20 transition-colors text-left"
          >
            <UserPlus size={14} className="flex-shrink-0" />
            <span className="truncate">{m.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
