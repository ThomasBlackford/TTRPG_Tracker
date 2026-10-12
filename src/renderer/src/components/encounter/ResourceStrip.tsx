import type { PlayerSnapshot } from '../../types'

// Spell slots, hit dice and class resources as they are on the player's own
// sheet right now — so the DM can see who's running dry without asking.

function Pips({ current, max, tone }: { current: number; max: number; tone: string }) {
  if (max > 12) return <span className="text-slate-300">{current}/{max}</span>
  return (
    <span className="inline-flex gap-[3px] align-middle">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`w-[7px] h-[7px] border ${i < current ? tone : 'border-slate-700 bg-transparent'}`} />
      ))}
    </span>
  )
}

export interface ResourceSummary {
  slotsLeft: number
  slotsMax: number
  hitDice: string | null
  low: boolean // out of something that matters
}

export function summarize(s: PlayerSnapshot): ResourceSummary {
  const slots = s.spellSlots.filter((x) => x.max > 0)
  const slotsLeft = slots.reduce((n, x) => n + x.current, 0)
  const slotsMax = slots.reduce((n, x) => n + x.max, 0)
  const hd = s.hit_dice_total != null ? `${s.hit_dice_current ?? 0}/${s.hit_dice_total}` : null
  const low = (slotsMax > 0 && slotsLeft === 0) || (s.hit_dice_total != null && (s.hit_dice_current ?? 0) === 0)
  return { slotsLeft, slotsMax, hitDice: hd, low }
}

export function ResourceStrip({ snapshot, dense = false }: { snapshot: PlayerSnapshot; dense?: boolean }) {
  const slots = snapshot.spellSlots.filter((s) => s.max > 0)
  const resources = snapshot.resources.filter((r) => r.max > 0)
  const features = (snapshot.features ?? []).filter((f) => f.max > 0)
  const hasHd = snapshot.hit_dice_total != null

  if (slots.length === 0 && resources.length === 0 && features.length === 0 && !hasHd) {
    return <p className="text-[11px] text-slate-600">Nothing tracked on their sheet yet.</p>
  }

  return (
    <div className={`flex flex-wrap items-center ${dense ? 'gap-x-3 gap-y-1' : 'gap-x-4 gap-y-1.5'} text-[11px] text-slate-400`}>
      {slots.map((s) => (
        <span key={s.level} className="inline-flex items-center gap-1.5" title={`Level ${s.level} spell slots — ${s.current} of ${s.max} left`}>
          <span className="text-slate-600">L{s.level}</span>
          <Pips current={s.current} max={s.max} tone={s.current === 0 ? 'border-red-500' : 'border-sky-400 bg-sky-400'} />
        </span>
      ))}
      {hasHd && (
        <span className={`inline-flex items-center gap-1.5 ${(snapshot.hit_dice_current ?? 0) === 0 ? 'text-red-300' : ''}`} title="Hit Dice left">
          <span className="text-slate-600">HD</span>
          {snapshot.hit_dice_current ?? 0}/{snapshot.hit_dice_total}
          <span className="text-slate-600">{snapshot.hit_die_size}</span>
        </span>
      )}
      {resources.map((r) => (
        <span key={r.id} className={`inline-flex items-center gap-1.5 ${r.current === 0 ? 'text-red-300' : ''}`} title={`${r.name}: ${r.current} of ${r.max}`}>
          <span className="text-slate-600 max-w-[7rem] truncate">{r.name}</span>
          <Pips current={r.current} max={r.max} tone={r.current === 0 ? 'border-red-500' : 'border-amber-400 bg-amber-400'} />
        </span>
      ))}
      {features.map((f) => (
        <span key={f.name} className={`inline-flex items-center gap-1.5 ${f.current === 0 ? 'text-red-300' : ''}`} title={`${f.name} (${f.recharge.replace('_', ' ')})`}>
          <span className="text-slate-600 max-w-[7rem] truncate">{f.name}</span>
          <Pips current={f.current} max={f.max} tone={f.current === 0 ? 'border-red-500' : 'border-emerald-400 bg-emerald-400'} />
        </span>
      ))}
    </div>
  )
}
