import { Eye, EyeOff } from 'lucide-react'

interface Props {
  shareToPlayers: boolean
  onShareToggle: () => void
}

export function RulerControls({ shareToPlayers, onShareToggle }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-900/80 border-b border-border text-xs">
      <span className="text-slate-500">
        Click to set start, click again to set end. Measurements stay DM-only until shared.
      </span>

      <button
        onClick={onShareToggle}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ml-auto flex-shrink-0 ${
          shareToPlayers
            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
            : 'border-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
        }`}
      >
        {shareToPlayers ? <Eye size={11} /> : <EyeOff size={11} />}
        {shareToPlayers ? 'Shown to players' : 'Show to players'}
      </button>
    </div>
  )
}
