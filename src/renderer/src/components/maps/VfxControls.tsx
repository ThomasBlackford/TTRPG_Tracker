import {
  Zap, Flame, Snowflake, Skull, Sparkles, Vibrate, CloudRain, CloudLightning,
  Droplets, Cloudy, X, Anchor, Ghost, Heart, Moon, VolumeX, Spline, CircleOff,
  Angry, Ban, Sun, Bone, Swords
} from 'lucide-react'
import type { VfxType, RayType, ZoneType, AmbientVfxState, ZoneMarker, VfxPending } from '../../types'
import { VFX_POINT_TYPES } from '../../types'

interface Props {
  pending: VfxPending
  onPickBurst: (type: VfxType) => void
  onPickRay: (type: RayType) => void
  onPickZone: (type: ZoneType) => void
  ambientVfx: AmbientVfxState
  onToggleAmbient: (key: keyof AmbientVfxState) => void
  zones: ZoneMarker[]
  zoneCap: number
  onZoneCapChange: (n: number) => void
  onDismissZone: (id: string) => void
}

const BURSTS: { type: VfxType; label: string; icon: React.ReactNode; activeClass: string }[] = [
  { type: 'lightning', label: 'Lightning', icon: <Zap size={14} />, activeClass: 'bg-sky-500/20 border-sky-500/40 text-sky-300' },
  { type: 'fireball',  label: 'Fireball',  icon: <Flame size={14} />, activeClass: 'bg-orange-500/20 border-orange-500/40 text-orange-300' },
  { type: 'frost',     label: 'Frost',     icon: <Snowflake size={14} />, activeClass: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' },
  { type: 'poison',    label: 'Poison',    icon: <Skull size={14} />, activeClass: 'bg-purple-500/20 border-purple-500/40 text-purple-300' },
  { type: 'heal',      label: 'Heal',      icon: <Sparkles size={14} />, activeClass: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
  { type: 'impact',    label: 'Impact',    icon: <Vibrate size={14} />, activeClass: 'bg-slate-500/20 border-slate-500/40 text-slate-300' },
  { type: 'rage',         label: 'Rage',         icon: <Angry size={14} />, activeClass: 'bg-red-600/20 border-red-600/40 text-red-400' },
  { type: 'counterspell', label: 'Counterspell', icon: <Ban size={14} />, activeClass: 'bg-violet-500/20 border-violet-500/40 text-violet-300' },
  { type: 'radiant',      label: 'Radiant',      icon: <Sun size={14} />, activeClass: 'bg-amber-300/20 border-amber-300/40 text-amber-200' },
  { type: 'necrotic',     label: 'Necrotic',     icon: <Bone size={14} />, activeClass: 'bg-purple-700/20 border-purple-700/40 text-purple-400' },
  { type: 'crit',         label: 'Critical Hit', icon: <Swords size={14} />, activeClass: 'bg-white/20 border-white/40 text-white' },
]

const RAYS: { type: RayType; label: string; icon: React.ReactNode; activeClass: string }[] = [
  { type: 'poison_ray',    label: 'Poison Ray',    icon: <Droplets size={14} />, activeClass: 'bg-lime-500/20 border-lime-500/40 text-lime-300' },
  { type: 'ice_ray',       label: 'Ray of Frost',  icon: <Snowflake size={14} />, activeClass: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' },
  { type: 'fire_ray',      label: 'Scorching Ray', icon: <Flame size={14} />, activeClass: 'bg-orange-500/20 border-orange-500/40 text-orange-300' },
  { type: 'lightning_ray', label: 'Lightning Ray', icon: <Zap size={14} />, activeClass: 'bg-sky-500/20 border-sky-500/40 text-sky-300' },
]

const ZONES: { type: ZoneType; label: string; icon: React.ReactNode; activeClass: string }[] = [
  { type: 'smoke', label: 'Smoke Cloud', icon: <Cloudy size={14} />, activeClass: 'bg-slate-400/20 border-slate-400/40 text-slate-200' },
  { type: 'hold_person', label: 'Hold Person', icon: <Anchor size={14} />, activeClass: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
  { type: 'fear', label: 'Fear', icon: <Ghost size={14} />, activeClass: 'bg-purple-500/20 border-purple-500/40 text-purple-300' },
  { type: 'charm', label: 'Charm', icon: <Heart size={14} />, activeClass: 'bg-pink-500/20 border-pink-500/40 text-pink-300' },
  { type: 'sleep', label: 'Sleep', icon: <Moon size={14} />, activeClass: 'bg-indigo-400/20 border-indigo-400/40 text-indigo-300' },
  { type: 'silence', label: 'Silence', icon: <VolumeX size={14} />, activeClass: 'bg-slate-400/20 border-slate-400/40 text-slate-300' },
  { type: 'web', label: 'Web', icon: <Spline size={14} />, activeClass: 'bg-stone-400/20 border-stone-400/40 text-stone-300' },
  { type: 'darkness', label: 'Darkness', icon: <CircleOff size={14} />, activeClass: 'bg-violet-700/30 border-violet-500/40 text-violet-300' },
]

const ZONE_LABELS: Record<ZoneType, string> = {
  smoke: 'Smoke Cloud', hold_person: 'Hold Person', fear: 'Fear', charm: 'Charm',
  sleep: 'Sleep', silence: 'Silence', web: 'Web', darkness: 'Darkness',
}

function iconBtn(
  key: string, icon: React.ReactNode, label: string, title: string,
  isActive: boolean, activeClass: string, onClick: () => void
) {
  return (
    <button
      key={key}
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
        isActive ? activeClass : 'border-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
      }`}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  )
}

export function VfxControls({
  pending, onPickBurst, onPickRay, onPickZone, ambientVfx, onToggleAmbient,
  zones, zoneCap, onZoneCapChange, onDismissZone,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-2 bg-slate-900/80 border-b border-border text-xs">
      {/* Bursts */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-500 w-16 flex-shrink-0">Bursts:</span>
        <div className="flex items-center gap-1.5">
          {BURSTS.map(({ type, label, icon, activeClass }) => {
            const isPoint = VFX_POINT_TYPES.includes(type)
            const isPending = pending?.kind === 'burst' && pending.type === type
            return iconBtn(
              type, icon, label,
              isPoint ? `${label} — click the map to place it` : `${label} — plays across the whole TV screen`,
              isPending, activeClass, () => onPickBurst(type)
            )
          })}
        </div>
      </div>

      {/* Rays */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-500 w-16 flex-shrink-0">Rays:</span>
        <div className="flex items-center gap-1.5">
          {RAYS.map(({ type, label, icon, activeClass }) => {
            const isPending = pending?.kind === 'ray' && pending.type === type
            return iconBtn(type, icon, label, `${label} — click an origin, then a target`, isPending, activeClass, () => onPickRay(type))
          })}
        </div>
      </div>

      {/* Zones */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-500 w-16 flex-shrink-0">Zones:</span>
        <div className="flex items-center gap-1.5">
          {ZONES.map(({ type, label, icon, activeClass }) => {
            const isPending = pending?.kind === 'zone' && pending.type === type
            return iconBtn(type, icon, label, `${label} — click a center, then click to set its radius. Lingers until dismissed.`, isPending, activeClass, () => onPickZone(type))
          })}
        </div>
        <div className="w-px h-4 bg-border" />
        <label className="flex items-center gap-1.5 text-slate-500" title="Max simultaneous lingering zones — the oldest is dismissed automatically past this">
          Max
          <input
            type="range" min={2} max={16} value={zoneCap}
            onChange={(e) => onZoneCapChange(parseInt(e.target.value))}
            className="w-20 accent-fuchsia-400"
          />
          <span className="text-slate-400 w-4">{zoneCap}</span>
        </label>
      </div>

      {/* Loops */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-500 w-16 flex-shrink-0">Loops:</span>
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
      </div>

      {/* Active Effects — the currently-lingering zones, each individually dismissible */}
      {zones.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border/60">
          <span className="text-slate-500 w-16 flex-shrink-0">Active:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {zones.map((z) => (
              <span
                key={z.id}
                className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/25 text-fuchsia-200"
              >
                {ZONE_LABELS[z.type]}
                <button onClick={() => onDismissZone(z.id)} title="Dismiss" className="text-fuchsia-400/60 hover:text-fuchsia-200 transition-colors">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
