import type { Reputation } from '../../types'

const THRESHOLDS = [
  { score: 0,   label: 'Hostile',     color: '#ef4444' },
  { score: 20,  label: 'Unfriendly',  color: '#f97316' },
  { score: 40,  label: 'Neutral',     color: '#eab308' },
  { score: 65,  label: 'Friendly',    color: '#22c55e' },
  { score: 85,  label: 'Revered',     color: '#3b82f6' }
]

function reputationLabel(score: number) {
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= THRESHOLDS[i].score) return THRESHOLDS[i]
  }
  return THRESHOLDS[0]
}

export function FactionRepBar({
  rep,
  onScoreChange
}: {
  rep: Reputation
  onScoreChange: (score: number) => void
}) {
  const threshold = reputationLabel(rep.score)

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onScoreChange(Math.round(pct * 100))
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400 font-medium truncate max-w-[60%]">{rep.faction_name}</span>
        <span className="text-xs font-medium" style={{ color: threshold.color }}>
          {threshold.label}
        </span>
      </div>
      <div
        className="relative h-2 rounded-full bg-surface-overlay cursor-pointer overflow-hidden"
        onClick={handleClick}
        title={`${rep.score}/100 — click to adjust`}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
          style={{ width: `${rep.score}%`, backgroundColor: threshold.color }}
        />
        {THRESHOLDS.slice(1).map((t) => (
          <div
            key={t.score}
            className="absolute top-0 h-full w-px bg-surface-raised/50"
            style={{ left: `${t.score}%` }}
          />
        ))}
      </div>
    </div>
  )
}
