import { Layers, MapPin as MapPinIcon, Tag } from 'lucide-react'
import type { MapPin } from '../../types'

const PIN_SIZE = 32

interface Props {
  pin: MapPin
  left: number
  top: number
  isSelected: boolean
  isDragging: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}

export function MapPinMarker({ pin, left, top, isSelected, isDragging, onPointerDown, onPointerMove, onPointerUp }: Props) {
  const color = pin.color
  const isMapLink = !!pin.child_map_id
  const isCardLink = !!pin.card_id

  return (
    <div
      className="absolute group"
      style={{
        left,
        top,
        transform: 'translate(-50%, -100%)',
        zIndex: isSelected || isDragging ? 50 : 10,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none'
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Pin SVG */}
      <svg
        width={PIN_SIZE}
        height={PIN_SIZE + 8}
        viewBox="0 0 32 40"
        style={{ filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.6)) drop-shadow(0 0 ${isSelected ? '8px' : '0px'} ${color})` }}
        className="transition-all duration-150"
      >
        {/* Teardrop body */}
        <path
          d="M16 0C7.163 0 0 7.163 0 16c0 11.6 16 24 16 24s16-12.4 16-24C32 7.163 24.837 0 16 0z"
          fill={color}
          opacity={isDragging ? 0.7 : 1}
        />
        {/* Inner circle */}
        <circle cx="16" cy="15" r="9" fill="rgba(0,0,0,0.25)" />
        <circle cx="16" cy="15" r="8" fill="white" opacity="0.12" />
      </svg>

      {/* Icon overlay, centered on the circle (16px from top in SVG = ~14px in rendered) */}
      <div
        className="absolute pointer-events-none"
        style={{ left: PIN_SIZE / 2, top: 15, transform: 'translate(-50%, -50%)' }}
      >
        {isMapLink ? (
          <Layers size={13} color="white" strokeWidth={2.5} />
        ) : isCardLink ? (
          <MapPinIcon size={13} color="white" strokeWidth={2.5} />
        ) : (
          <Tag size={11} color="white" strokeWidth={2.5} />
        )}
      </div>

      {/* Tooltip — appears on hover above the pin */}
      {pin.label && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md
                     bg-slate-900/95 border border-border text-white text-xs whitespace-nowrap
                     opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-100
                     shadow-lg"
          style={{ marginBottom: PIN_SIZE + 12 }}
        >
          {pin.label}
          {isMapLink && <span className="ml-1 text-amber-400">↗</span>}
        </div>
      )}

      {/* Selected ring */}
      {isSelected && (
        <div
          className="absolute rounded-full border-2 pointer-events-none animate-pulse"
          style={{
            width: PIN_SIZE + 8,
            height: PIN_SIZE + 8,
            left: -4,
            top: -4,
            borderColor: color,
            opacity: 0.6
          }}
        />
      )}
    </div>
  )
}
