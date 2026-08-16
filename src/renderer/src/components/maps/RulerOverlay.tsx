import type { MapData } from '../../types'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }
interface Pt { x: number; y: number }

interface Props {
  start: Pt | null
  end: Pt | null           // frozen end
  liveEnd: Pt | null       // cursor position while placing second point
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
  mapData: MapData
  natW: number
  natH: number
  shareToPlayers: boolean
  onShareToggle: () => void
  readOnly?: boolean       // player view
}

function toScreen(pt: Pt, imgRect: ImgRect, pan: { x: number; y: number }, scale: number) {
  return {
    sx: imgRect.offsetX + pan.x + pt.x * imgRect.width  * scale,
    sy: imgRect.offsetY + pan.y + pt.y * imgRect.height * scale,
  }
}

function calcDistance(start: Pt, end: Pt, mapData: MapData, natW: number, natH: number) {
  // start/end are normalized fractions of image width/height respectively —
  // convert each axis back to natural image pixels using its own dimension,
  // otherwise non-square maps get a skewed distance reading.
  const dx = (end.x - start.x) * natW
  const dy = (end.y - start.y) * natH
  const pixelDist = Math.sqrt(dx * dx + dy * dy)
  if (mapData.scale_pixels_per_unit <= 0) return null
  const units = pixelDist / mapData.scale_pixels_per_unit
  const feet  = units * mapData.scale_feet_per_unit
  return { units, feet }
}

export function RulerOverlay({ start, end, liveEnd, imgRect, pan, scale, mapData, natW, natH, shareToPlayers, onShareToggle, readOnly }: Props) {
  const activeEnd = end ?? liveEnd
  if (!start || !activeEnd) return null

  const a = toScreen(start,     imgRect, pan, scale)
  const b = toScreen(activeEnd, imgRect, pan, scale)

  const dist = calcDistance(start, activeEnd, mapData, natW, natH)
  const label = dist
    ? `${dist.feet.toFixed(1)} ft  (${dist.units.toFixed(1)} sq)`
    : `${Math.round(Math.hypot((activeEnd.x - start.x) * imgRect.width * scale, (activeEnd.y - start.y) * imgRect.height * scale))}px`

  const midX = (a.sx + b.sx) / 2
  const midY = (a.sy + b.sy) / 2
  const labelW = label.length * 7 + 20
  const frozen = !!end

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', maxWidth: 'none', overflow: 'visible' }}
    >
      {/* Dashed line */}
      <line
        x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy}
        stroke="#facc15"
        strokeWidth={frozen ? 2 : 1.5}
        strokeDasharray={frozen ? '10 5' : '6 4'}
        strokeLinecap="round"
        opacity={frozen ? 1 : 0.7}
      />

      {/* Endpoints */}
      <circle cx={a.sx} cy={a.sy} r={5} fill="#facc15" opacity={0.9} />
      <circle cx={b.sx} cy={b.sy} r={frozen ? 5 : 4} fill={frozen ? '#facc15' : 'rgba(250,204,21,0.5)'} />

      {/* Distance label */}
      <rect
        x={midX - labelW / 2} y={midY - 12}
        width={labelW} height={22}
        rx={5}
        fill="rgba(0,0,0,0.75)"
        stroke="rgba(250,204,21,0.25)"
        strokeWidth={1}
      />
      <text
        x={midX} y={midY + 4}
        textAnchor="middle"
        fill="#facc15"
        fontSize={12}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {label}
      </text>

      {/* Share toggle (DM only, frozen state) */}
      {frozen && !readOnly && (
        <g
          onClick={onShareToggle}
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
        >
          <rect
            x={midX - labelW / 2} y={midY + 14}
            width={labelW} height={18}
            rx={4}
            fill={shareToPlayers ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.05)'}
            stroke={shareToPlayers ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.1)'}
            strokeWidth={1}
          />
          <text
            x={midX} y={midY + 27}
            textAnchor="middle"
            fill={shareToPlayers ? '#facc15' : 'rgba(255,255,255,0.35)'}
            fontSize={10}
            fontFamily="Inter, system-ui, sans-serif"
          >
            {shareToPlayers ? '👁 Shown to players' : 'Show to players'}
          </text>
        </g>
      )}
    </svg>
  )
}
