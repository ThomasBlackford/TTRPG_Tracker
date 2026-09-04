import type { MapData } from '../../types'
import { toScreen, calcDistance, type ImgRect, type Pt } from '../../lib/mapMath'

interface Props {
  kind: 'ray' | 'zone'
  first: Pt
  hover: Pt | null
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
  mapData: MapData
  natW: number
  natH: number
}

// The in-progress preview while placing a ray (line, first click = origin)
// or a zone (circle, first click = center) — same dashed-line-plus-label
// language as the Ruler, so it reads as "you're aiming something" rather
// than a different tool entirely.
export function VfxTargetingOverlay({ kind, first, hover, imgRect, pan, scale, mapData, natW, natH }: Props) {
  const target = hover ?? first
  const a = toScreen(first, imgRect, pan, scale)
  const b = toScreen(target, imgRect, pan, scale)
  const dist = calcDistance(first, target, mapData, natW, natH)
  const label = dist ? `${dist.feet.toFixed(0)} ft` : ''

  const midX = (a.sx + b.sx) / 2
  const midY = (a.sy + b.sy) / 2
  const labelW = Math.max(36, label.length * 7 + 16)
  const r = Math.hypot(b.sx - a.sx, b.sy - a.sy)

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', maxWidth: 'none', overflow: 'visible' }}>
      {kind === 'ray' ? (
        <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke="#f472b6" strokeWidth={2} strokeDasharray="8 5" strokeLinecap="round" opacity={0.8} />
      ) : (
        <circle cx={a.sx} cy={a.sy} r={r} fill="rgba(244,114,182,0.08)" stroke="#f472b6" strokeWidth={2} strokeDasharray="8 5" opacity={0.8} />
      )}
      <circle cx={a.sx} cy={a.sy} r={5} fill="#f472b6" opacity={0.9} />
      {kind === 'ray' && <circle cx={b.sx} cy={b.sy} r={4} fill="rgba(244,114,182,0.6)" />}

      {label && (
        <>
          <rect x={midX - labelW / 2} y={midY - 12} width={labelW} height={22} rx={5} fill="rgba(0,0,0,0.75)" stroke="rgba(244,114,182,0.3)" strokeWidth={1} />
          <text x={midX} y={midY + 4} textAnchor="middle" fill="#f472b6" fontSize={12} fontFamily="Inter, system-ui, sans-serif">
            {label}
          </text>
        </>
      )}
    </svg>
  )
}
