import { useRef } from 'react'
import type { RayEvent } from '../../types'
import { useEffectCanvas } from './VfxOverlay'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }

interface Props {
  ray: RayEvent
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
}

export const RAY_DURATIONS: Record<RayEvent['type'], number> = {
  poison_ray: 1350,
  ice_ray: 1300,
  fire_ray: 1350,
  lightning_ray: 1100,
}

function rand(min: number, max: number) { return min + Math.random() * (max - min) }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3) }

type RGB = [number, number, number]
function rgba([r, g, b]: RGB, a: number) {
  return `rgba(${r | 0},${g | 0},${b | 0},${Math.max(0, Math.min(1, a))})`
}

// Every ray shares the same three-phase timeline (grow → hold → fade) and
// the same "traveling tracer + impact burst" shape — only the palette and
// particle behavior differ per damage type. That shared shell is what keeps
// four distinct rays from being four times the code.
const GROW_MS = 160

function useRayCanvas(
  x1: number, y1: number, x2: number, y2: number, durationMs: number,
  draw: (ctx: CanvasRenderingContext2D, elapsed: number, beamT: number, growT: number) => void
) {
  return useEffectCanvas((ctx, elapsed) => {
    if (elapsed > durationMs) return
    const growT = easeOutCubic(Math.min(1, elapsed / GROW_MS))
    const beamT = elapsed / durationMs // 0-1 across the whole lifetime, for fade
    draw(ctx, elapsed, beamT, growT)
  })
}

function beamAlpha(beamT: number): number {
  // Full strength through the hold, fading over the last ~35% of life.
  return beamT < 0.6 ? 1 : Math.max(0, 1 - (beamT - 0.6) / 0.4)
}

// ── Poison Ray — sickly green bolt with bubbling toxic droplets ─────────

function PoisonRayFx({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const drops = useRef<{ t0: number; offset: number; size: number; drift: number }[]>()
  if (!drops.current) {
    drops.current = Array.from({ length: 16 }, () => ({
      t0: rand(0, 0.9), offset: rand(-6, 6), size: rand(2, 5), drift: rand(-10, 10),
    }))
  }
  const canvasRef = useRayCanvas(x1, y1, x2, y2, RAY_DURATIONS.poison_ray, (ctx, elapsed, beamT, growT) => {
    const alpha = beamAlpha(beamT)
    const ex = x1 + (x2 - x1) * growT
    const ey = y1 + (y2 - y1) * growT

    ctx.globalCompositeOperation = 'lighter'
    const grad = ctx.createLinearGradient(x1, y1, ex, ey)
    grad.addColorStop(0, rgba([70, 140, 40], alpha * 0.9))
    grad.addColorStop(1, rgba([160, 230, 60], alpha))
    ctx.strokeStyle = grad
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(140,220,60,0.8)'
    ctx.shadowBlur = 14
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke()
    ctx.shadowBlur = 0

    for (const d of drops.current!) {
      const dt = (elapsed / RAY_DURATIONS.poison_ray - d.t0) / 0.5
      if (dt < 0 || dt > 1 || growT < 0.99) continue
      const px = x1 + (x2 - x1) * dt + d.drift * dt
      const py = y1 + (y2 - y1) * dt + d.offset
      ctx.fillStyle = rgba([120, 200, 60], alpha * (1 - dt) * 0.8)
      ctx.beginPath(); ctx.arc(px, py, d.size, 0, Math.PI * 2); ctx.fill()
    }

    if (growT >= 0.99) {
      const impactR = 20 + 14 * Math.sin(elapsed / 60)
      const ig = ctx.createRadialGradient(x2, y2, 0, x2, y2, impactR)
      ig.addColorStop(0, rgba([160, 230, 60], alpha * 0.6))
      ig.addColorStop(1, rgba([90, 160, 40], 0))
      ctx.fillStyle = ig
      ctx.beginPath(); ctx.arc(x2, y2, impactR, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Ice Ray — pale crystalline shard-line with drifting frost motes ─────

function IceRayFx({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const motes = useRef<{ t0: number; offset: number; size: number; phase: number }[]>()
  if (!motes.current) {
    motes.current = Array.from({ length: 20 }, () => ({
      t0: rand(0, 0.85), offset: rand(-9, 9), size: rand(1.5, 3.5), phase: rand(0, Math.PI * 2),
    }))
  }
  const canvasRef = useRayCanvas(x1, y1, x2, y2, RAY_DURATIONS.ice_ray, (ctx, elapsed, beamT, growT) => {
    const alpha = beamAlpha(beamT)
    const ex = x1 + (x2 - x1) * growT
    const ey = y1 + (y2 - y1) * growT

    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = rgba([230, 250, 255], alpha)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(190,235,255,0.9)'
    ctx.shadowBlur = 16
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke()
    // A thinner, brighter core on top of the glow pass
    ctx.shadowBlur = 0
    ctx.lineWidth = 1.2
    ctx.strokeStyle = rgba([255, 255, 255], alpha)
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke()

    for (const m of motes.current!) {
      const dt = (elapsed / RAY_DURATIONS.ice_ray - m.t0) / 0.55
      if (dt < 0 || dt > 1 || growT < 0.99) continue
      const px = x1 + (x2 - x1) * dt + m.offset * Math.sin(elapsed / 120 + m.phase)
      const py = y1 + (y2 - y1) * dt
      const twinkle = 0.5 + 0.5 * Math.sin(elapsed / 70 + m.phase)
      ctx.fillStyle = rgba([220, 245, 255], alpha * (1 - dt) * twinkle)
      ctx.beginPath(); ctx.arc(px, py, m.size, 0, Math.PI * 2); ctx.fill()
    }

    if (growT >= 0.99) {
      const impactR = 22
      const ig = ctx.createRadialGradient(x2, y2, 0, x2, y2, impactR)
      ig.addColorStop(0, rgba([235, 250, 255], alpha * 0.7))
      ig.addColorStop(1, rgba([180, 225, 255], 0))
      ctx.fillStyle = ig
      ctx.beginPath(); ctx.arc(x2, y2, impactR, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Fire Ray (Scorching Ray) — searing orange bolt with flame licks ─────

function FireRayFx({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const flames = useRef<{ t0: number; offset: number; size: number; phase: number }[]>()
  if (!flames.current) {
    flames.current = Array.from({ length: 18 }, () => ({
      t0: rand(0, 0.9), offset: rand(-5, 5), size: rand(4, 9), phase: rand(0, Math.PI * 2),
    }))
  }
  const canvasRef = useRayCanvas(x1, y1, x2, y2, RAY_DURATIONS.fire_ray, (ctx, elapsed, beamT, growT) => {
    const alpha = beamAlpha(beamT)
    const ex = x1 + (x2 - x1) * growT
    const ey = y1 + (y2 - y1) * growT

    ctx.globalCompositeOperation = 'lighter'
    const grad = ctx.createLinearGradient(x1, y1, ex, ey)
    grad.addColorStop(0, rgba([255, 240, 180], alpha))
    grad.addColorStop(0.5, rgba([255, 150, 40], alpha))
    grad.addColorStop(1, rgba([220, 60, 20], alpha))
    ctx.strokeStyle = grad
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(255,140,40,0.9)'
    ctx.shadowBlur = 18
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke()
    ctx.shadowBlur = 0

    for (const f of flames.current!) {
      const dt = (elapsed / RAY_DURATIONS.fire_ray - f.t0) / 0.4
      if (dt < 0 || dt > 1 || growT < 0.99) continue
      const px = x1 + (x2 - x1) * dt
      const py = y1 + (y2 - y1) * dt + f.offset + Math.sin(elapsed / 90 + f.phase) * 3
      const s = f.size * (1 - dt * 0.5)
      const fg = ctx.createRadialGradient(px, py, 0, px, py, s)
      fg.addColorStop(0, rgba([255, 220, 140], alpha * (1 - dt)))
      fg.addColorStop(1, rgba([255, 100, 30], 0))
      ctx.fillStyle = fg
      ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI * 2); ctx.fill()
    }

    if (growT >= 0.99) {
      const impactR = 26 + 10 * Math.sin(elapsed / 50)
      const ig = ctx.createRadialGradient(x2, y2, 0, x2, y2, impactR)
      ig.addColorStop(0, rgba([255, 230, 160], alpha * 0.8))
      ig.addColorStop(0.6, rgba([255, 120, 40], alpha * 0.5))
      ig.addColorStop(1, rgba([200, 40, 10], 0))
      ctx.fillStyle = ig
      ctx.beginPath(); ctx.arc(x2, y2, impactR, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Lightning Ray — a jagged, flickering bolt constrained to one line ───

function generateBoltAlong(x1: number, y1: number, x2: number, y2: number, jitter: number): [number, number][] {
  const segments = 9
  const pts: [number, number][] = [[x1, y1]]
  for (let i = 1; i < segments; i++) {
    const t = i / segments
    const bx = x1 + (x2 - x1) * t
    const by = y1 + (y2 - y1) * t
    // perpendicular jitter so the bolt doesn't just cut straight across
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len, ny = dx / len
    const j = (Math.random() - 0.5) * jitter
    pts.push([bx + nx * j, by + ny * j])
  }
  pts.push([x2, y2])
  return pts
}

function LightningRayFx({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const boltRef = useRef<{ at: number; pts: [number, number][] }[]>([])
  const nextAtRef = useRef(0)

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    if (elapsed > RAY_DURATIONS.lightning_ray) return
    if (elapsed >= nextAtRef.current) {
      boltRef.current.push({ at: elapsed, pts: generateBoltAlong(x1, y1, x2, y2, 16) })
      nextAtRef.current = elapsed + rand(70, 130)
    }
    boltRef.current = boltRef.current.filter((b) => elapsed - b.at < 140)

    const overallFade = elapsed > RAY_DURATIONS.lightning_ray * 0.7
      ? Math.max(0, 1 - (elapsed - RAY_DURATIONS.lightning_ray * 0.7) / (RAY_DURATIONS.lightning_ray * 0.3))
      : 1

    ctx.globalCompositeOperation = 'lighter'
    for (const b of boltRef.current) {
      const age = elapsed - b.at
      const alpha = (1 - age / 140) * overallFade
      const passes: [number, number][] = [[7, 0.15], [3, 0.4], [1.4, 0.9]]
      for (const [width, a] of passes) {
        ctx.beginPath()
        ctx.moveTo(b.pts[0][0], b.pts[0][1])
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1])
        ctx.strokeStyle = rgba([210, 235, 255], alpha * a)
        ctx.lineWidth = width
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke()
      }
    }

    if (elapsed < 90) {
      ctx.fillStyle = rgba([255, 255, 255], (1 - elapsed / 90) * 0.15)
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    }
    ctx.globalCompositeOperation = 'source-over'
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

export function RayOverlay({ ray, imgRect, pan, scale }: Props) {
  const x1 = imgRect.offsetX + pan.x + ray.from.x * imgRect.width * scale
  const y1 = imgRect.offsetY + pan.y + ray.from.y * imgRect.height * scale
  const x2 = imgRect.offsetX + pan.x + ray.to.x * imgRect.width * scale
  const y2 = imgRect.offsetY + pan.y + ray.to.y * imgRect.height * scale

  switch (ray.type) {
    case 'poison_ray': return <PoisonRayFx x1={x1} y1={y1} x2={x2} y2={y2} />
    case 'ice_ray': return <IceRayFx x1={x1} y1={y1} x2={x2} y2={y2} />
    case 'fire_ray': return <FireRayFx x1={x1} y1={y1} x2={x2} y2={y2} />
    case 'lightning_ray': return <LightningRayFx x1={x1} y1={y1} x2={x2} y2={y2} />
    default: return null
  }
}
