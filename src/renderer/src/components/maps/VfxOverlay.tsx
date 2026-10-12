import { useMemo } from 'react'
import type { VfxEvent } from '../../types'
import { FxCanvas } from './fx/FxCanvas'
import { BURSTS } from './fx/bursts'
import { hashSeed } from './fx/kit'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }

interface Props {
  effect: VfxEvent
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
}

export const VFX_DURATIONS: Record<VfxEvent['type'], number> = Object.fromEntries(
  Object.entries(BURSTS).map(([id, fx]) => [id, fx.duration])
) as Record<VfxEvent['type'], number>

// Whether an effect should also shake the whole presentation window.
export function vfxShakes(type: VfxEvent['type']): boolean {
  return !!(BURSTS[type] as { shake?: boolean } | undefined)?.shake
}

// Effects are sized in "u" units so they keep their footprint on the map when
// the DM zooms: 1u ≈ 1/1300th of the rendered map width.
export function fxUnit(imgRect: ImgRect, scale: number): number {
  return Math.max(0.5, Math.min(3, (imgRect.width * scale) / 1300))
}

export function VfxOverlay({ effect, imgRect, pan, scale }: Props) {
  const fx = BURSTS[effect.type]
  const seed = useMemo(() => hashSeed(effect.id), [effect.id])
  if (!fx) return null

  const x = imgRect.offsetX + pan.x + (effect.x ?? 0.5) * imgRect.width * scale
  const y = imgRect.offsetY + pan.y + (effect.y ?? 0.5) * imgRect.height * scale
  const u = fxUnit(imgRect, scale)

  return (
    <FxCanvas
      draw={(ctx, t, w, h) => fx.draw(ctx, t, { x, y, u, w, h, seed })}
    />
  )
}
