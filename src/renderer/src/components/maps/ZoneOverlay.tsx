import { useRef } from 'react'
import type { ZoneMarker } from '../../types'
import { useEffectCanvas } from './VfxOverlay'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }

interface Props {
  zone: ZoneMarker
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
}

function rand(min: number, max: number) { return min + Math.random() * (max - min) }
type RGB = [number, number, number]
function rgba([r, g, b]: RGB, a: number) {
  return `rgba(${r | 0},${g | 0},${b | 0},${Math.max(0, Math.min(1, a))})`
}

// Zones loop forever on a modulo-time cycle — same technique as the
// Rain/Storm ambient loops — since there's no fixed duration to animate
// toward; they're removed by unmounting (dismissed from the Active Effects
// list), not by expiring.

interface Puff { x0: number; y0: number; period: number; startOffset: number; size: number; drift: number }

function makePuffs(count: number, r: number): Puff[] {
  return Array.from({ length: count }, () => {
    const angle = rand(0, Math.PI * 2)
    const dist = rand(0, r * 0.7)
    return {
      x0: Math.cos(angle) * dist, y0: Math.sin(angle) * dist,
      period: rand(3500, 5500), startOffset: rand(0, 6000),
      size: rand(r * 0.22, r * 0.4), drift: rand(0.3, 0.7),
    }
  })
}

// Shared dashed boundary ring — most zones want some version of "here's
// where it ends," styled per-effect via color/dash/alpha.
function boundaryRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: RGB, alpha: number, dash: number[] = [6, 8]) {
  ctx.strokeStyle = rgba(color, alpha)
  ctx.setLineDash(dash)
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  ctx.setLineDash([])
}

function SmokeZoneFx({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const puffs = useRef<Puff[]>()
  if (!puffs.current) puffs.current = makePuffs(14, r)

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    boundaryRing(ctx, cx, cy, r, [170, 170, 175], 0.25)

    ctx.globalCompositeOperation = 'source-over'
    for (const p of puffs.current!) {
      const cycle = ((elapsed + p.startOffset) % p.period) / p.period
      const wobble = Math.sin(cycle * Math.PI * 2) * r * 0.12 * p.drift
      const px = cx + p.x0 + wobble
      const py = cy + p.y0 + Math.cos(cycle * Math.PI * 2 * 0.7) * r * 0.1 * p.drift
      const breathe = 0.75 + 0.25 * Math.sin(cycle * Math.PI * 2)
      const alpha = 0.22 * breathe
      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size)
      grad.addColorStop(0, rgba([190, 190, 195], alpha))
      grad.addColorStop(0.6, rgba([140, 140, 148], alpha * 0.6))
      grad.addColorStop(1, rgba([100, 100, 108], 0))
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill()
    }
  })

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Hold Person — a still, binding rune circle; deliberately near-static ─
// ("frozen" reads better as stillness with a slow pulse than as motion).

function HoldPersonFx({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const spokes = useRef<number[]>()
  if (!spokes.current) spokes.current = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + rand(-0.1, 0.1))

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    const pulse = 0.6 + 0.4 * Math.sin(elapsed / 1400)
    boundaryRing(ctx, cx, cy, r, [232, 184, 74], 0.3 * pulse, [2, 3])

    // Slow-rotating rune ring, most of a full turn every ~40s.
    const rot = elapsed / 6500
    ctx.strokeStyle = rgba([232, 184, 74], 0.35 * pulse)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5)
      ctx.lineTo(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74)
      ctx.stroke()
    }

    // Static shackle-beams — restraint, not movement.
    ctx.globalCompositeOperation = 'lighter'
    for (const a of spokes.current!) {
      const x1 = cx + Math.cos(a) * r * 0.15, y1 = cy + Math.sin(a) * r * 0.15
      const x2 = cx + Math.cos(a) * r * 0.95, y2 = cy + Math.sin(a) * r * 0.95
      const grad = ctx.createLinearGradient(x1, y1, x2, y2)
      grad.addColorStop(0, rgba([255, 220, 140], 0.5 * pulse))
      grad.addColorStop(1, rgba([255, 220, 140], 0))
      ctx.strokeStyle = grad
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    }
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.3)
    cg.addColorStop(0, rgba([255, 225, 150], 0.35 * pulse))
    cg.addColorStop(1, rgba([255, 225, 150], 0))
    ctx.fillStyle = cg
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Fear — a dark, oppressive aura with jagged tendrils reaching out ────

interface Tendril { angle: number; period: number; startOffset: number; segments: number }

function FearZoneFx({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const tendrils = useRef<Tendril[]>()
  if (!tendrils.current) {
    tendrils.current = Array.from({ length: 9 }, () => ({
      angle: rand(0, Math.PI * 2), period: rand(1800, 2800), startOffset: rand(0, 3000), segments: 5,
    }))
  }

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    const dread = 0.55 + 0.45 * Math.sin(elapsed / 900)
    ctx.globalCompositeOperation = 'source-over'
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    core.addColorStop(0, rgba([30, 10, 35], 0.32 * dread))
    core.addColorStop(1, rgba([15, 5, 20], 0))
    ctx.fillStyle = core
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()

    boundaryRing(ctx, cx, cy, r, [110, 40, 130], 0.25, [3, 6])

    ctx.globalCompositeOperation = 'lighter'
    for (const t of tendrils.current!) {
      const cycle = ((elapsed + t.startOffset) % t.period) / t.period
      const reach = Math.sin(cycle * Math.PI) // grows out then retracts
      let x = cx, y = cy
      const pts: [number, number][] = [[x, y]]
      for (let i = 1; i <= t.segments; i++) {
        const frac = (i / t.segments) * reach
        const wobble = Math.sin(frac * 8 + t.angle * 4) * r * 0.05
        x = cx + Math.cos(t.angle) * r * frac + Math.cos(t.angle + Math.PI / 2) * wobble
        y = cy + Math.sin(t.angle) * r * frac + Math.sin(t.angle + Math.PI / 2) * wobble
        pts.push([x, y])
      }
      ctx.strokeStyle = rgba([150, 60, 180], 0.4 * reach)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Charm — a warm, gentle glow with petals drifting slowly upward ──────

interface Petal { angle: number; dist: number; period: number; startOffset: number; size: number }

function CharmZoneFx({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const petals = useRef<Petal[]>()
  if (!petals.current) {
    petals.current = Array.from({ length: 12 }, () => ({
      angle: rand(0, Math.PI * 2), dist: rand(0, r * 0.6),
      period: rand(2600, 3800), startOffset: rand(0, 5000), size: rand(3, 6),
    }))
  }

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    const pulse = 0.6 + 0.4 * Math.sin(elapsed / 1600)
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    core.addColorStop(0, rgba([255, 150, 180], 0.16 * pulse))
    core.addColorStop(1, rgba([255, 150, 180], 0))
    ctx.fillStyle = core
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
    boundaryRing(ctx, cx, cy, r, [255, 150, 180], 0.22 * pulse)

    ctx.globalCompositeOperation = 'lighter'
    for (const p of petals.current!) {
      const t = ((elapsed + p.startOffset) % p.period) / p.period
      const px = cx + Math.cos(p.angle) * p.dist + Math.sin(t * Math.PI * 4) * 6
      const py = cy + Math.sin(p.angle) * p.dist - t * r * 0.85
      const alpha = Math.sin(t * Math.PI) * 0.7
      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2)
      grad.addColorStop(0, rgba([255, 180, 200], alpha))
      grad.addColorStop(1, rgba([255, 120, 160], 0))
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(px, py, p.size * 2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Sleep — a dim lavender dome with drifting "z" glyphs ────────────────

interface SleepGlyph { x0: number; size: number; period: number; startOffset: number }

function SleepZoneFx({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const glyphs = useRef<SleepGlyph[]>()
  if (!glyphs.current) {
    glyphs.current = Array.from({ length: 9 }, () => ({
      x0: rand(-r * 0.6, r * 0.6), size: rand(10, 18), period: rand(3200, 4600), startOffset: rand(0, 5000),
    }))
  }

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    const breathe = 0.55 + 0.25 * Math.sin(elapsed / 2200)
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    core.addColorStop(0, rgba([160, 150, 230], 0.18 * breathe))
    core.addColorStop(1, rgba([160, 150, 230], 0))
    ctx.fillStyle = core
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
    boundaryRing(ctx, cx, cy, r, [180, 170, 235], 0.2)

    ctx.font = '600 16px Georgia, serif'
    ctx.textAlign = 'center'
    for (const g of glyphs.current!) {
      const t = ((elapsed + g.startOffset) % g.period) / g.period
      const px = cx + g.x0
      const py = cy + r * 0.5 - t * r * 1.0
      const alpha = Math.sin(t * Math.PI) * 0.6
      ctx.fillStyle = rgba([210, 200, 245], alpha)
      ctx.font = `600 ${g.size}px Georgia, serif`
      ctx.fillText('z', px, py)
    }
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Silence — a muted zone where outward ripples die before the edge ────

interface Ripple { start: number }

function SilenceZoneFx({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const ripplesRef = useRef<Ripple[]>([])
  const nextAtRef = useRef(0)
  const RIPPLE_LIFE = 1400

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    if (elapsed >= nextAtRef.current) {
      ripplesRef.current.push({ start: elapsed })
      nextAtRef.current = elapsed + 900
    }
    ripplesRef.current = ripplesRef.current.filter((rp) => elapsed - rp.start < RIPPLE_LIFE)

    const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    wash.addColorStop(0, rgba([210, 220, 225], 0.06))
    wash.addColorStop(1, rgba([210, 220, 225], 0))
    ctx.fillStyle = wash
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()

    for (const rp of ripplesRef.current) {
      const t = (elapsed - rp.start) / RIPPLE_LIFE
      // Ripple dies (muffles out) at ~55% of the radius instead of reaching
      // the edge — sound smothered, not sound that got somewhere.
      const rippleR = r * 0.55 * t
      const alpha = (1 - t) * 0.35
      ctx.strokeStyle = rgba([200, 210, 220], alpha)
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(cx, cy, rippleR, 0, Math.PI * 2); ctx.stroke()
    }

    boundaryRing(ctx, cx, cy, r, [180, 190, 200], 0.28, [2, 5])
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Web — an actual spiderweb, radial + concentric threads, gentle sway ─

function WebZoneFx({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const SPOKES = 8
  const RINGS = 4

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    const sway = Math.sin(elapsed / 2600) * 0.04
    ctx.strokeStyle = rgba([225, 225, 220], 0.4)
    ctx.lineWidth = 1

    const spokePts: [number, number][] = []
    for (let i = 0; i < SPOKES; i++) {
      const a = (i / SPOKES) * Math.PI * 2 + sway
      const x = cx + Math.cos(a) * r * 0.92, y = cy + Math.sin(a) * r * 0.92
      spokePts.push([x, y])
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke()
    }
    for (let ring = 1; ring <= RINGS; ring++) {
      const frac = ring / RINGS
      ctx.beginPath()
      for (let i = 0; i <= SPOKES; i++) {
        const a = (i / SPOKES) * Math.PI * 2 + sway
        const x = cx + Math.cos(a) * r * 0.92 * frac
        const y = cy + Math.sin(a) * r * 0.92 * frac
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // A glint traveling along one strand.
    const glintIdx = Math.floor(elapsed / 900) % SPOKES
    const glintT = (elapsed % 900) / 900
    const [gx, gy] = spokePts[glintIdx]
    const px = cx + (gx - cx) * glintT, py = cy + (gy - cy) * glintT
    ctx.globalCompositeOperation = 'lighter'
    const gg = ctx.createRadialGradient(px, py, 0, px, py, 5)
    gg.addColorStop(0, rgba([255, 255, 255], 0.7))
    gg.addColorStop(1, rgba([255, 255, 255], 0))
    ctx.fillStyle = gg
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    boundaryRing(ctx, cx, cy, r, [220, 220, 215], 0.2)
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Darkness — a dense, near-opaque void with roiling black tendrils ────

function DarknessZoneFx({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const puffs = useRef<Puff[]>()
  if (!puffs.current) puffs.current = makePuffs(10, r).map((p) => ({ ...p, period: p.period * 1.6 }))

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    core.addColorStop(0, rgba([5, 2, 10], 0.82))
    core.addColorStop(0.75, rgba([8, 3, 16], 0.7))
    core.addColorStop(1, rgba([40, 15, 60], 0.15))
    ctx.fillStyle = core
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()

    ctx.globalCompositeOperation = 'source-over'
    for (const p of puffs.current!) {
      const cycle = ((elapsed + p.startOffset) % p.period) / p.period
      const wobble = Math.sin(cycle * Math.PI * 2) * r * 0.15
      const px = cx + p.x0 + wobble
      const py = cy + p.y0 + Math.cos(cycle * Math.PI * 2 * 0.6) * r * 0.12
      const alpha = 0.3 + 0.2 * Math.sin(cycle * Math.PI * 2)
      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size)
      grad.addColorStop(0, rgba([15, 5, 25], alpha))
      grad.addColorStop(1, rgba([15, 5, 25], 0))
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill()
    }

    boundaryRing(ctx, cx, cy, r, [120, 60, 170], 0.35, [4, 4])
  })
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

export function ZoneOverlay({ zone, imgRect, pan, scale }: Props) {
  const cx = imgRect.offsetX + pan.x + zone.center.x * imgRect.width * scale
  const cy = imgRect.offsetY + pan.y + zone.center.y * imgRect.height * scale
  const ex = imgRect.offsetX + pan.x + zone.edge.x * imgRect.width * scale
  const ey = imgRect.offsetY + pan.y + zone.edge.y * imgRect.height * scale
  const r = Math.max(12, Math.hypot(ex - cx, ey - cy))

  switch (zone.type) {
    case 'smoke': return <SmokeZoneFx cx={cx} cy={cy} r={r} />
    case 'hold_person': return <HoldPersonFx cx={cx} cy={cy} r={r} />
    case 'fear': return <FearZoneFx cx={cx} cy={cy} r={r} />
    case 'charm': return <CharmZoneFx cx={cx} cy={cy} r={r} />
    case 'sleep': return <SleepZoneFx cx={cx} cy={cy} r={r} />
    case 'silence': return <SilenceZoneFx cx={cx} cy={cy} r={r} />
    case 'web': return <WebZoneFx cx={cx} cy={cy} r={r} />
    case 'darkness': return <DarknessZoneFx cx={cx} cy={cy} r={r} />
    default: return null
  }
}
