import type { Reputation } from '../../types'

interface Tier {
  min: number
  label: string
  color: string
}

const TIERS: Tier[] = [
  { min:  60, label: 'Revered',    color: '#c9a84c' },
  { min:  20, label: 'Friendly',   color: '#22c55e' },
  { min: -20, label: 'Neutral',    color: '#94a3b8' },
  { min: -60, label: 'Unfriendly', color: '#f97316' },
  { min: -101,label: 'Hostile',    color: '#ef4444' }
]

function getTier(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]
}

export function FactionRepBar({
  rep,
  onScoreChange
}: {
  rep: Reputation
  onScoreChange: (score: number) => void
}) {
  const tier = getTier(rep.score)
  const isPositive = rep.score >= 0

  // Each side of the bar is 50% of total width. score ±100 fills its side completely.
  const fillPercent = Math.abs(rep.score) / 100 * 50

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width   // 0 → 1
    const raw = Math.round((pct * 200) - 100)           // map to -100..+100
    onScoreChange(Math.min(100, Math.max(-100, raw)))
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200 truncate max-w-[55%]">
          {rep.faction_name}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">
            {rep.score > 0 ? '+' : ''}{rep.score}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
            style={{ color: tier.color, borderColor: tier.color + '50', backgroundColor: tier.color + '18' }}>
            {tier.label}
          </span>
        </div>
      </div>

      <div
        className="relative h-4 rounded-full overflow-hidden cursor-pointer select-none group"
        style={{ backgroundColor: '#1e2436' }}
        onClick={handleClick}
        title="Click to set reputation"
      >
        {/* Tick marks at ±25, ±50, ±75 */}
        {[-75, -50, -25, 25, 50, 75].map((tick) => (
          <div
            key={tick}
            className="absolute top-0 h-full w-px opacity-20"
            style={{ left: `${(tick + 100) / 2}%`, backgroundColor: '#94a3b8' }}
          />
        ))}

        {/* Negative fill (red, grows from center leftward) */}
        {rep.score < 0 && (
          <div
            className="absolute top-0 h-full rounded-l-full transition-all duration-200"
            style={{
              right: '50%',
              width: `${fillPercent}%`,
              background: `linear-gradient(to left, #f97316, #ef4444)`
            }}
          />
        )}

        {/* Positive fill (green, grows from center rightward) */}
        {rep.score > 0 && (
          <div
            className="absolute top-0 h-full rounded-r-full transition-all duration-200"
            style={{
              left: '50%',
              width: `${fillPercent}%`,
              background: isPositive && rep.score >= 60
                ? `linear-gradient(to right, #22c55e, #c9a84c)`
                : `linear-gradient(to right, #22c55e, #4ade80)`
            }}
          />
        )}

        {/* Center divider */}
        <div
          className="absolute top-0 h-full w-0.5 -translate-x-px"
          style={{ left: '50%', backgroundColor: '#e2e8f0', opacity: 0.5 }}
        />

        {/* Score indicator pip */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-slate-900 transition-all duration-200 shadow-lg"
          style={{
            left: `calc(${(rep.score + 100) / 2}% - 5px)`,
            backgroundColor: rep.score === 0 ? '#94a3b8' : tier.color
          }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-xs text-slate-600 px-0.5 select-none">
        <span>-100</span>
        <span>-50</span>
        <span className="text-slate-500">0</span>
        <span>+50</span>
        <span>+100</span>
      </div>
    </div>
  )
}
