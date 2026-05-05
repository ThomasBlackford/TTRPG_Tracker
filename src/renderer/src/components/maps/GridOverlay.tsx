import type { MapData } from '../../types'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }

interface Props {
  mapData: MapData
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
  natW: number
  natH: number
}

export function GridOverlay({ mapData, imgRect, pan, scale, natW }: Props) {
  if (!natW || mapData.scale_pixels_per_unit <= 0) return null

  const imgLeft = imgRect.offsetX + pan.x
  const imgTop  = imgRect.offsetY + pan.y
  const imgW    = imgRect.width  * scale
  const imgH    = imgRect.height * scale

  // Grid spacing in display pixels
  const spacing = (mapData.scale_pixels_per_unit / natW) * imgW

  if (spacing < 4) return null  // too dense to be useful

  // Grid offset in display pixels
  const offX = (mapData.grid_offset_x / natW) * imgW
  const offY = (mapData.grid_offset_y / natW) * imgW  // use natW to keep square grid

  const lines: React.ReactNode[] = []
  const clipId = 'grid-clip'

  // Vertical lines
  const startCol = Math.floor(-offX / spacing)
  const endCol   = Math.ceil((imgW - offX) / spacing)
  for (let i = startCol; i <= endCol; i++) {
    const x = imgLeft + offX + i * spacing
    if (x < imgLeft - 1 || x > imgLeft + imgW + 1) continue
    lines.push(
      <line key={`v${i}`} x1={x} y1={imgTop} x2={x} y2={imgTop + imgH}
        stroke="rgba(255,255,255,0.18)" strokeWidth={0.75} />
    )
  }

  // Horizontal lines
  const startRow = Math.floor(-offY / spacing)
  const endRow   = Math.ceil((imgH - offY) / spacing)
  for (let i = startRow; i <= endRow; i++) {
    const y = imgTop + offY + i * spacing
    if (y < imgTop - 1 || y > imgTop + imgH + 1) continue
    lines.push(
      <line key={`h${i}`} x1={imgLeft} y1={y} x2={imgLeft + imgW} y2={y}
        stroke="rgba(255,255,255,0.18)" strokeWidth={0.75} />
    )
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', maxWidth: 'none', overflow: 'visible' }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={imgLeft} y={imgTop} width={imgW} height={imgH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{lines}</g>
    </svg>
  )
}
