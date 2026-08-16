import { Eye, EyeOff } from 'lucide-react'

interface Props {
  brushRadius: number
  brushMode: 'reveal' | 'hide'
  onBrushRadius: (r: number) => void
  onBrushMode: (m: 'reveal' | 'hide') => void
  onRevealAll: () => void
  onHideAll: () => void
}

const BRUSH_SIZES = [
  { label: 'S', value: 0 },
  { label: 'M', value: 1 },
  { label: 'L', value: 2 },
  { label: 'XL', value: 4 },
]

export function FogControls({ brushRadius, brushMode, onBrushRadius, onBrushMode, onRevealAll, onHideAll }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-900/80 border-b border-border text-xs">
      {/* Mode toggle */}
      <div className="flex rounded-md overflow-hidden border border-border">
        <button
          onClick={() => onBrushMode('reveal')}
          className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
            brushMode === 'reveal'
              ? 'bg-amber-500/20 text-amber-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye size={11} /> Reveal
        </button>
        <button
          onClick={() => onBrushMode('hide')}
          className={`flex items-center gap-1 px-2.5 py-1 transition-colors border-l border-border ${
            brushMode === 'hide'
              ? 'bg-blue-500/20 text-blue-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <EyeOff size={11} /> Hide
        </button>
      </div>

      {/* Brush size */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500 mr-1">Brush:</span>
        {BRUSH_SIZES.map((s) => (
          <button
            key={s.value}
            onClick={() => onBrushRadius(s.value)}
            className={`w-7 h-6 rounded text-xs font-medium transition-colors ${
              brushRadius === s.value
                ? 'bg-slate-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-slate-600 italic hidden lg:inline mr-1">
          You see through fog faintly — players see it solid.
        </span>
        <button
          onClick={onRevealAll}
          className="px-2.5 py-1 rounded text-amber-400 hover:bg-amber-500/10 transition-colors"
        >
          Reveal All
        </button>
        <button
          onClick={onHideAll}
          className="px-2.5 py-1 rounded text-blue-400 hover:bg-blue-500/10 transition-colors"
        >
          Hide All
        </button>
      </div>
    </div>
  )
}
