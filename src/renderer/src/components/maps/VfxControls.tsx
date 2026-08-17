import { Zap, Flame, Snowflake, Skull, Sparkles, Vibrate, CloudRain, CloudLightning } from 'lucide-react'
import type { VfxType, AmbientVfxState } from '../../types'
import { VFX_POINT_TYPES } from '../../types'

interface Props {
  pendingType: VfxType | null
  onPick: (type: VfxType) => void
  ambientVfx: AmbientVfxState
  onToggleAmbient: (key: keyof AmbientVfxState) => void
}

const EFFECTS: { type: VfxType; label: string; icon: React.ReactNode; activeClass: string }[] = [
  { type: 'lightning', label: 'Lightning', icon: <Zap size={13} />, activeClass: 'bg-sky-500/20 border-sky-500/40 text-sky-300' },
  { type: 'fireball',  label: 'Fireball',  icon: <Flame size={13} />, activeClass: 'bg-orange-500/20 border-orange-500/40 text-orange-300' },
  { type: 'frost',     label: 'Frost',     icon: <Snowflake size={13} />, activeClass: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' },
  { type: 'poison',    label: 'Poison',    icon: <Skull size={13} />, activeClass: 'bg-purple-500/20 border-purple-500/40 text-purple-300' },
  { type: 'heal',      label: 'Heal',      icon: <Sparkles size={13} />, activeClass: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
  { type: 'impact',    label: 'Impact',    icon: <Vibrate size={13} />, activeClass: 'bg-slate-500/20 border-slate-500/40 text-slate-300' },
]

export function VfxControls({ pendingType, onPick, ambientVfx, onToggleAmbient }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-900/80 border-b border-border text-xs flex-wrap">
      <span className="text-slate-500">Effects:</span>
      <div className="flex items-center gap-1.5">
        {EFFECTS.map(({ type, label, icon, activeClass }) => {
          const isPoint = VFX_POINT_TYPES.includes(type)
          const isPending = pendingType === type
          return (
            <button
              key={type}
              onClick={() => onPick(type)}
              title={isPoint ? `Click the map to place ${label}` : `${label} plays across the whole TV screen`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
                isPending ? activeClass : 'border-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              {icon} {label}
            </button>
          )
        })}
      </div>

      <div className="w-px h-4 bg-border" />

      <span className="text-slate-500">Loops:</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onToggleAmbient('rain')}
          title="Toggle continuous rain on the TV — stays on until you turn it off"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
            ambientVfx.rain
              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : 'border-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
          }`}
        >
          <CloudRain size={13} /> Rain
        </button>
        <button
          onClick={() => onToggleAmbient('stormLightning')}
          title="Toggle a thunderstorm — random lightning strikes on their own until you turn it off"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
            ambientVfx.stormLightning
              ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
              : 'border-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
          }`}
        >
          <CloudLightning size={13} /> Storm
        </button>
      </div>

      <span className="text-slate-600 ml-auto hidden xl:inline">
        {pendingType && VFX_POINT_TYPES.includes(pendingType)
          ? 'Click on the map to fire it'
          : 'Screen effects fire immediately on click'}
      </span>
    </div>
  )
}
