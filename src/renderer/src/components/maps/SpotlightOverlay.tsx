interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }
interface Pt { x: number; y: number }

interface Props {
  pos: Pt | null
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
}

export function SpotlightOverlay({ pos, imgRect, pan, scale }: Props) {
  if (!pos) return null

  const sx = imgRect.offsetX + pan.x + pos.x * imgRect.width  * scale
  const sy = imgRect.offsetY + pan.y + pos.y * imgRect.height * scale

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: sx, top: sy }}
    >
      {/* Outer pulsing ring */}
      <div
        style={{
          position: 'absolute',
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: '3px solid rgba(250,204,21,0.6)',
          animation: 'spotlight-pulse 1.8s ease-in-out infinite',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 24px rgba(250,204,21,0.35)',
        }}
      />
      {/* Inner dot */}
      <div
        style={{
          position: 'absolute',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'rgba(250,204,21,0.9)',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 8px rgba(250,204,21,0.8)',
        }}
      />
    </div>
  )
}
