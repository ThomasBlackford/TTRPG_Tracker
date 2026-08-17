import { useEffect, useMemo, useRef } from 'react'
import type { VfxEvent } from '../../types'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }

interface Props {
  effect: VfxEvent
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
}

export const VFX_DURATIONS: Record<VfxEvent['type'], number> = {
  lightning: 800,
  fireball: 1450,
  frost: 1500,
  poison: 2600,
  heal: 1200,
  impact: 600,
}

// ── Shared canvas + rAF harness ──────────────────────────────────────────
// Clears and redraws the whole canvas every frame from scratch, computing
// each particle's state as a pure function of elapsed time. That keeps
// everything frame-rate independent and immune to dropped frames — no
// per-frame integration to accumulate error.

export function useEffectCanvas(draw: (ctx: CanvasRenderingContext2D, elapsedMs: number, w: number, h: number) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const start = performance.now()

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function frame(now: number) {
      const elapsed = now - start
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      drawRef.current(ctx, elapsed, canvas!.width, canvas!.height)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return canvasRef
}

function rand(min: number, max: number) { return min + Math.random() * (max - min) }

type RGB = [number, number, number]
function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  const c = Math.max(0, Math.min(1, t))
  return [a[0] + (b[0] - a[0]) * c, a[1] + (b[1] - a[1]) * c, a[2] + (b[2] - a[2]) * c]
}
function rgba([r, g, b]: RGB, a: number) {
  return `rgba(${r | 0},${g | 0},${b | 0},${Math.max(0, Math.min(1, a))})`
}

function easeOutCubic(t: number) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3) }

export function VfxOverlay({ effect, imgRect, pan, scale }: Props) {
  const sx = imgRect.offsetX + pan.x + (effect.x ?? 0.5) * imgRect.width * scale
  const sy = imgRect.offsetY + pan.y + (effect.y ?? 0.5) * imgRect.height * scale

  switch (effect.type) {
    case 'lightning': return <LightningFx />
    case 'impact':    return <ImpactFx x={sx} y={sy} />
    case 'fireball':  return <FireballFx x={sx} y={sy} />
    case 'frost':     return <FrostFx x={sx} y={sy} />
    case 'poison':    return <PoisonFx x={sx} y={sy} />
    case 'heal':      return <HealFx x={sx} y={sy} />
    default:          return null
  }
}

// ── Lightning — jagged main bolt + procedural branches ───────────────────

function generateBolt(startX: number, startY: number, endYTarget: number, span: number): string {
  let x = startX
  let y = startY
  const pts = [`${x},${y}`]
  while (y < endYTarget) {
    y += 10 + Math.random() * 9
    x += (Math.random() - 0.5) * span
    pts.push(`${x},${Math.min(y, endYTarget)}`)
  }
  return pts.join(' ')
}

function LightningFx() {
  const bolt = useMemo(() => {
    const startX = 20 + Math.random() * 60
    const points = generateBolt(startX, 0, 100, 18)
    const coords = points.split(' ').map((p) => p.split(',').map(Number))
    // Spawn 2-3 branches forking off random points along the main bolt
    const branches = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => {
      const originIdx = 1 + Math.floor(Math.random() * (coords.length - 2))
      const [ox, oy] = coords[originIdx]
      const dir = Math.random() > 0.5 ? 1 : -1
      const branchPts = generateBolt(ox, oy, Math.min(oy + rand(15, 35), 100), 14).split(' ')
      // bias the branch sideways off the main bolt
      return branchPts
        .map((p, i) => {
          const [px, py] = p.split(',').map(Number)
          return `${px + dir * i * 1.6},${py}`
        })
        .join(' ')
    })
    return { main: points, branches }
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden vfx-shake-root">
      <div
        className="absolute inset-0 bg-white"
        style={{ animation: 'vfx-lightning-flash 700ms ease-out forwards' }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={bolt.main}
          fill="none"
          stroke="#eaf6ff"
          strokeWidth={0.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{
            filter: 'drop-shadow(0 0 6px #bfe3ff) drop-shadow(0 0 14px #7fb8ff)',
            animation: 'vfx-bolt-fade 700ms ease-out forwards',
          }}
        />
        {bolt.branches.map((pts, i) => (
          <polyline
            key={i}
            points={pts}
            fill="none"
            stroke="#cfeaff"
            strokeWidth={0.35}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{
              filter: 'drop-shadow(0 0 4px #bfe3ff)',
              opacity: 0.8,
              animation: 'vfx-bolt-fade 600ms ease-out forwards',
              animationDelay: `${20 + i * 15}ms`,
            }}
          />
        ))}
      </svg>
    </div>
  )
}

// ── Fireball — explosion burst + rising flame licks + trailing smoke ────

interface FireParticle {
  spawn: number; maxLife: number; angle: number; speed: number
  size: number; kind: 'burst' | 'flame' | 'smoke'
  wobbleFreq: number; wobbleAmp: number; phase: number; drift: number
}

const FLAME_HOT: RGB = [255, 250, 220]
const FLAME_MID: RGB = [255, 150, 40]
const FLAME_LOW: RGB = [170, 30, 10]
const SMOKE_LIGHT: RGB = [140, 140, 140]
const SMOKE_DARK: RGB = [40, 40, 45]

function makeFireParticles(): FireParticle[] {
  const parts: FireParticle[] = []
  for (let i = 0; i < 34; i++) {
    parts.push({
      spawn: rand(0, 120), maxLife: rand(280, 480), angle: rand(0, Math.PI * 2),
      speed: rand(60, 160), size: rand(5, 12), kind: 'burst',
      wobbleFreq: 0, wobbleAmp: 0, phase: 0, drift: 0,
    })
  }
  for (let i = 0; i < 26; i++) {
    parts.push({
      spawn: rand(0, 350), maxLife: rand(500, 850), angle: rand(-Math.PI * 0.65, -Math.PI * 0.35),
      speed: rand(30, 70), size: rand(8, 18), kind: 'flame',
      wobbleFreq: rand(4, 8), wobbleAmp: rand(4, 10), phase: rand(0, Math.PI * 2), drift: rand(-8, 8),
    })
  }
  for (let i = 0; i < 12; i++) {
    parts.push({
      spawn: rand(250, 600), maxLife: rand(500, 750), angle: -Math.PI / 2,
      speed: rand(15, 35), size: rand(14, 24), kind: 'smoke',
      wobbleFreq: rand(2, 4), wobbleAmp: rand(6, 14), phase: rand(0, Math.PI * 2), drift: rand(-10, 10),
    })
  }
  return parts
}

function FireballFx({ x, y }: { x: number; y: number }) {
  const particles = useRef<FireParticle[]>()
  if (!particles.current) particles.current = makeFireParticles()

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    for (const p of particles.current!) {
      const age = elapsed - p.spawn
      if (age < 0 || age > p.maxLife) continue
      const t = age / p.maxLife

      if (p.kind === 'burst') {
        const dist = p.speed * easeOutCubic(t) * (p.maxLife / 1000)
        const px = x + Math.cos(p.angle) * dist
        const py = y + Math.sin(p.angle) * dist
        const alpha = 1 - t
        const color = lerpRgb(FLAME_HOT, FLAME_MID, t * 1.6)
        ctx.globalCompositeOperation = 'lighter'
        const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * (1 - t * 0.4))
        grad.addColorStop(0, rgba(color, alpha))
        grad.addColorStop(1, rgba(color, 0))
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(px, py, p.size * (1 - t * 0.4), 0, Math.PI * 2)
        ctx.fill()
      } else if (p.kind === 'flame') {
        const sec = age / 1000
        const px = x + Math.cos(p.angle) * p.speed * sec + Math.sin(sec * p.wobbleFreq + p.phase) * p.wobbleAmp
        const py = y + Math.sin(p.angle) * p.speed * sec - 10
        const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
        const color = t < 0.4 ? lerpRgb(FLAME_HOT, FLAME_MID, t / 0.4) : lerpRgb(FLAME_MID, FLAME_LOW, (t - 0.4) / 0.6)
        const size = p.size * (1 + t * 0.4)
        ctx.globalCompositeOperation = 'lighter'
        const grad = ctx.createRadialGradient(px, py, 0, px, py, size)
        grad.addColorStop(0, rgba(color, alpha * 0.9))
        grad.addColorStop(1, rgba(color, 0))
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(px, py, size, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const sec = age / 1000
        const px = x + p.drift * sec + Math.sin(sec * p.wobbleFreq + p.phase) * p.wobbleAmp
        const py = y + Math.sin(p.angle) * p.speed * sec - 6
        const alpha = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.35
        const color = lerpRgb(SMOKE_LIGHT, SMOKE_DARK, t)
        const size = p.size * (1 + t * 0.8)
        ctx.globalCompositeOperation = 'source-over'
        const grad = ctx.createRadialGradient(px, py, 0, px, py, size)
        grad.addColorStop(0, rgba(color, alpha))
        grad.addColorStop(1, rgba(color, 0))
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(px, py, size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  })

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: '#ff7a29', animation: 'vfx-screen-flash 900ms ease-out forwards' }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

// ── Frost — crack lines + drifting icy mist dust ─────────────────────────

interface MistParticle {
  spawn: number; maxLife: number; angle: number; speed: number; size: number; phase: number
}

function FrostFx({ x, y }: { x: number; y: number }) {
  const cracks = useMemo(() => Array.from({ length: 7 }, () => Math.random() * 360), [])
  const particles = useRef<MistParticle[]>()
  if (!particles.current) {
    particles.current = Array.from({ length: 22 }, () => ({
      spawn: rand(0, 300), maxLife: rand(700, 1100), angle: rand(0, Math.PI * 2),
      speed: rand(20, 55), size: rand(1.5, 3.5), phase: rand(0, Math.PI * 2),
    }))
  }

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    for (const p of particles.current!) {
      const age = elapsed - p.spawn
      if (age < 0 || age > p.maxLife) continue
      const sec = age / 1000
      const t = age / p.maxLife
      const px = x + Math.cos(p.angle) * p.speed * sec
      const py = y + Math.sin(p.angle) * p.speed * sec + sec * 12
      const twinkle = 0.5 + 0.5 * Math.sin(elapsed / 90 + p.phase)
      const alpha = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * twinkle
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = rgba([230, 250, 255], alpha)
      ctx.beginPath()
      ctx.arc(px, py, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  })

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute rounded-full"
        style={{
          left: x, top: y, width: 160, height: 160,
          background: 'radial-gradient(circle, #eaffff 0%, #bfe8ff 40%, transparent 72%)',
          animation: 'vfx-frost-core 1200ms ease-out forwards',
        }}
      />
      <svg className="absolute overflow-visible" style={{ left: x - 80, top: y - 80, width: 160, height: 160 }}>
        {cracks.map((angle, i) => (
          <line
            key={i}
            x1={80} y1={80}
            x2={80 + Math.cos((angle * Math.PI) / 180) * 70}
            y2={80 + Math.sin((angle * Math.PI) / 180) * 70}
            stroke="#eaffff"
            strokeWidth={1.5}
            strokeDasharray={70}
            style={{
              filter: 'drop-shadow(0 0 3px #bfe8ff)',
              animation: 'vfx-frost-crack 1200ms ease-out forwards',
              animationDelay: `${i * 25}ms`,
            }}
          />
        ))}
      </svg>
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

// ── Poison — billowing cluster of soft overlapping gas puffs ─────────────

interface PuffParticle {
  spawn: number; maxLife: number; angle: number; speed: number
  baseSize: number; wobbleFreq: number; wobbleAmp: number; phase: number; green: boolean
}

function PoisonFx({ x, y }: { x: number; y: number }) {
  const particles = useRef<PuffParticle[]>()
  if (!particles.current) {
    particles.current = Array.from({ length: 20 }, () => ({
      spawn: rand(0, 500), maxLife: rand(1400, 2000), angle: rand(0, Math.PI * 2),
      speed: rand(10, 28), baseSize: rand(26, 52),
      wobbleFreq: rand(0.6, 1.4), wobbleAmp: rand(10, 22), phase: rand(0, Math.PI * 2),
      green: Math.random() > 0.45,
    }))
  }

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    for (const p of particles.current!) {
      const age = elapsed - p.spawn
      if (age < 0 || age > p.maxLife) continue
      const sec = age / 1000
      const t = age / p.maxLife
      const wobble = Math.sin(sec * p.wobbleFreq + p.phase) * p.wobbleAmp
      const px = x + Math.cos(p.angle) * p.speed * sec * 10 + wobble
      const py = y + Math.sin(p.angle) * p.speed * sec * 10 - sec * 6
      const alpha = (t < 0.25 ? t / 0.25 : t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1) * 0.55
      const size = p.baseSize * (1 + t * 0.9)
      const color: RGB = p.green ? [90, 170, 60] : [150, 80, 200]
      ctx.globalCompositeOperation = 'source-over'
      const grad = ctx.createRadialGradient(px, py, 0, px, py, size)
      grad.addColorStop(0, rgba(color, alpha))
      grad.addColorStop(0.7, rgba(color, alpha * 0.5))
      grad.addColorStop(1, rgba(color, 0))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(px, py, size, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', filter: 'url(#fog-filter)' }}
    />
  )
}

// ── Heal — rising, twinkling sparkles with a soft glow trail ─────────────

interface SparkParticle {
  spawn: number; maxLife: number; angle: number; dist: number
  size: number; wobbleFreq: number; wobbleAmp: number; phase: number; gold: boolean
}

function HealFx({ x, y }: { x: number; y: number }) {
  const particles = useRef<SparkParticle[]>()
  if (!particles.current) {
    particles.current = Array.from({ length: 16 }, (_, i) => ({
      spawn: rand(0, 200), maxLife: rand(700, 950),
      angle: (i / 16) * Math.PI * 2 + rand(-0.3, 0.3), dist: rand(45, 95),
      size: rand(2.5, 5), wobbleFreq: rand(3, 6), wobbleAmp: rand(4, 10),
      phase: rand(0, Math.PI * 2), gold: Math.random() > 0.5,
    }))
  }

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    for (const p of particles.current!) {
      const age = elapsed - p.spawn
      if (age < 0 || age > p.maxLife) continue
      const t = age / p.maxLife
      const eased = easeOutCubic(t)
      const px = x + Math.cos(p.angle) * p.dist * eased + Math.sin(age / 90 + p.phase) * p.wobbleAmp * 0.3
      const py = y + Math.sin(p.angle) * p.dist * eased - eased * 40
      const twinkle = 0.55 + 0.45 * Math.sin(age / 60 + p.phase)
      const alpha = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * twinkle
      const color: RGB = p.gold ? [255, 226, 140] : [140, 255, 176]
      ctx.globalCompositeOperation = 'lighter'
      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.4)
      grad.addColorStop(0, rgba(color, alpha))
      grad.addColorStop(1, rgba(color, 0))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(px, py, p.size * 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  })

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Impact — screen shake/vignette + a few flung debris shards ──────────

interface DebrisParticle {
  angle: number; speed: number; size: number; rot: number; rotSpeed: number
}

function ImpactFx({ x, y }: { x: number; y: number }) {
  const particles = useRef<DebrisParticle[]>()
  if (!particles.current) {
    particles.current = Array.from({ length: 10 }, () => ({
      angle: rand(-Math.PI, 0), speed: rand(90, 220), size: rand(3, 7),
      rot: rand(0, Math.PI * 2), rotSpeed: rand(-8, 8),
    }))
  }

  const canvasRef = useEffectCanvas((ctx, elapsed) => {
    const maxLife = 500
    if (elapsed > maxLife) return
    const sec = elapsed / 1000
    const t = elapsed / maxLife
    for (const p of particles.current!) {
      const px = x + Math.cos(p.angle) * p.speed * sec
      const py = y + Math.sin(p.angle) * p.speed * sec + 260 * sec * sec
      const alpha = 1 - t
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(p.rot + p.rotSpeed * sec)
      ctx.fillStyle = rgba([50, 45, 40], alpha)
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      ctx.restore()
    }
  })

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden vfx-shake-root">
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.6) 100%)',
          animation: 'vfx-impact-vignette 550ms ease-out forwards',
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
