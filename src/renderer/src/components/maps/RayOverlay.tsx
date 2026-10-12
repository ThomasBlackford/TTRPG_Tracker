import { useMemo } from 'react'
import type { RayEvent } from '../../types'
import { FxCanvas } from './fx/FxCanvas'
import { RAYS } from './fx/rays'
import { hashSeed } from './fx/kit'
import { fxUnit } from './VfxOverlay'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }

interface Props {
  ray: RayEvent
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
}

export const RAY_DURATIONS: Record<RayEvent['type'], number> = Object.fromEntries(
  Object.entries(RAYS).map(([id, fx]) => [id, fx.duration])
) as Record<RayEvent['type'], number>

export function RayOverlay({ ray, imgRect, pan, scale }: Props) {
  const fx = RAYS[ray.type]
  const seed = useMemo(() => hashSeed(ray.id), [ray.id])
  if (!fx) return null

  const toX = (v: number) => imgRect.offsetX + pan.x + v * imgRect.width * scale
  const toY = (v: number) => imgRect.offsetY + pan.y + v * imgRect.height * scale
  const x1 = toX(ray.from.x)
  const y1 = toY(ray.from.y)
  const x2 = toX(ray.to.x)
  const y2 = toY(ray.to.y)
  const u = fxUnit(imgRect, scale)

  return <FxCanvas draw={(ctx, t, w, h) => fx.draw(ctx, t, { x1, y1, x2, y2, u, w, h, seed })} />
}
