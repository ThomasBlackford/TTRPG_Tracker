import { useMemo } from 'react'
import type { ZoneMarker } from '../../types'
import { FxCanvas } from './fx/FxCanvas'
import { ZONES } from './fx/zones'
import { hashSeed } from './fx/kit'
import { fxUnit } from './VfxOverlay'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }

interface Props {
  zone: ZoneMarker
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
}

// Zones loop until dismissed. Each gets a canvas just big enough for itself
// (with room for the pop-in overshoot and edge ornaments) rather than a
// full-window one, so a dozen lingering zones stay cheap to repaint.
export function ZoneOverlay({ zone, imgRect, pan, scale }: Props) {
  const fx = ZONES[zone.type]
  const seed = useMemo(() => hashSeed(zone.id), [zone.id])
  if (!fx) return null

  const cx = imgRect.offsetX + pan.x + zone.center.x * imgRect.width * scale
  const cy = imgRect.offsetY + pan.y + zone.center.y * imgRect.height * scale
  const ex = imgRect.offsetX + pan.x + zone.edge.x * imgRect.width * scale
  const ey = imgRect.offsetY + pan.y + zone.edge.y * imgRect.height * scale
  const r = Math.max(14, Math.hypot(ex - cx, ey - cy))
  const u = fxUnit(imgRect, scale)

  const reach = r * 1.4 + 24 * u
  const box = { x: cx - reach, y: cy - reach, w: reach * 2, h: reach * 2 }

  return <FxCanvas box={box} draw={(ctx, t) => fx.draw(ctx, t, { cx, cy, r, u, seed })} />
}
