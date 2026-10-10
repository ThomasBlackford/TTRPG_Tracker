import type { MapData, MapToken } from '../../types'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }

// A token covers `size` grid squares, so it scales with the map's own scale
// and with zoom — a Large creature is visibly two squares wide at any zoom.
export function tokenDiameter(token: MapToken, map: MapData, imgRect: ImgRect, natW: number, scale: number): number {
  if (!natW || !imgRect.width) return 36
  const cellPx = map.scale_pixels_per_unit * (imgRect.width / natW) * scale
  return Math.max(22, token.size * cellPx)
}

interface Props {
  token: MapToken
  left: number // screen-space centre
  top: number
  diameter: number
  isCurrent: boolean
  rank: number | null // position in the initiative order, if in the fight
  down: boolean
  dimmed?: boolean // hidden from players (DM view only)
  selected?: boolean
  interactive?: boolean
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: (e: React.PointerEvent) => void
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  const last = words[words.length - 1]
  // "Goblin 3" → G3, "Aria Stormwind" → AS
  return (words[0][0] + (/^\d+$/.test(last) ? last : last[0])).toUpperCase()
}

// A circular, squarely-labelled creature token. Square corners everywhere else
// in the app, but a token reads as a disc on a map — that curve is deliberate.
export function TokenMarker({
  token, left, top, diameter, isCurrent, rank, down, dimmed, selected, interactive,
  onPointerDown, onPointerMove, onPointerUp
}: Props) {
  const fontSize = Math.max(9, Math.min(22, diameter * 0.36))
  return (
    <div
      data-token="1"
      className="absolute"
      style={{
        left,
        top,
        width: diameter,
        height: diameter,
        transform: 'translate(-50%, -50%)',
        zIndex: isCurrent ? 40 : selected ? 35 : 20,
        cursor: interactive ? 'grab' : 'default',
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: interactive ? 'auto' : 'none',
        opacity: dimmed ? 0.45 : down ? 0.55 : 1,
        filter: down ? 'grayscale(1)' : undefined
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title={token.name}
    >
      <div
        className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold overflow-hidden transition-[box-shadow] duration-500"
        style={{
          background: token.image_path ? '#000' : `radial-gradient(circle at 30% 30%, ${token.color}, #000 130%)`,
          border: `2px solid ${isCurrent ? '#fff' : token.color}`,
          boxShadow: isCurrent
            ? `0 0 0 3px ${token.color}, 0 0 22px 6px ${token.color}`
            : selected
              ? `0 0 0 2px #fff, 0 2px 8px rgba(0,0,0,.7)`
              : '0 2px 8px rgba(0,0,0,.7)',
          fontSize,
          letterSpacing: '0.02em'
        }}
      >
        {token.image_path ? (
          <img src={`file:///${token.image_path.replace(/\\/g, '/')}`} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          initials(token.name)
        )}
      </div>

      {rank != null && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-black border border-white/40 text-white flex items-center justify-center"
          style={{ fontSize: 9, fontWeight: 700 }}
        >
          {rank}
        </span>
      )}
    </div>
  )
}
