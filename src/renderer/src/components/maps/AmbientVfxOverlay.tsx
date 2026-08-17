import { useRef } from 'react'
import { useEffectCanvas } from './VfxOverlay'

function rand(min: number, max: number) { return min + Math.random() * (max - min) }

// ── Rain — continuous, seamlessly-looping falling streaks ───────────────
// Each drop's position is a pure function of (elapsed + its own phase
// offset) mod its fall duration, so it loops forever with no reset "pop"
// and no per-frame state to maintain.

interface Drop {
  x0: number          // percent of screen width
  fallDuration: number
  startOffset: number
  length: number
  drift: number        // px of sideways drift over one fall
  opacity: number
}

function makeDrops(count: number): Drop[] {
  return Array.from({ length: count }, () => ({
    x0: rand(-5, 105),
    fallDuration: rand(650, 1150),
    startOffset: rand(0, 5000),
    length: rand(14, 28),
    drift: rand(18, 34),
    opacity: rand(0.22, 0.5),
  }))
}

export function RainLoop() {
  const drops = useRef<Drop[]>()
  if (!drops.current) drops.current = makeDrops(220)

  const canvasRef = useEffectCanvas((ctx, elapsed, w, h) => {
    for (const d of drops.current!) {
      const cycle = (elapsed + d.startOffset) % d.fallDuration
      const progress = cycle / d.fallDuration
      const x = (d.x0 / 100) * w + progress * d.drift
      const y = -40 + progress * (h + 80)
      ctx.strokeStyle = `rgba(190,215,255,${d.opacity.toFixed(3)})`
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - d.drift * 0.12, y - d.length)
      ctx.stroke()
    }
  })

  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(20,30,55,0.1), rgba(10,14,26,0.2))' }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
    </>
  )
}

// ── Storm — self-triggering lightning strikes at random intervals ───────
// Independent of the manual one-shot Lightning effect; runs on its own
// clock for as long as the toggle is on.

type Pt = [number, number]
interface Strike { start: number; main: Pt[]; branches: Pt[][] }

function generateBoltPx(w: number, h: number): Pt[] {
  let x = w * rand(0.2, 0.8)
  let y = 0
  const pts: Pt[] = [[x, y]]
  while (y < h) {
    y += h * rand(0.08, 0.14)
    x += rand(-1, 1) * w * 0.03
    pts.push([x, Math.min(y, h)])
  }
  return pts
}

function generateBranchPx(ox: number, oy: number, w: number, h: number): Pt[] {
  let x = ox
  let y = oy
  const targetY = Math.min(oy + h * rand(0.12, 0.28), h)
  const pts: Pt[] = [[x, y]]
  while (y < targetY) {
    y += h * rand(0.06, 0.1)
    x += rand(-1, 1) * w * 0.025
    pts.push([x, Math.min(y, targetY)])
  }
  return pts
}

function drawBolt(ctx: CanvasRenderingContext2D, pts: Pt[], alpha: number, thin: boolean) {
  if (pts.length < 2 || alpha <= 0) return
  const passes: [number, number][] = thin ? [[3, 0.15], [1, 0.8]] : [[8, 0.12], [4, 0.28], [1.6, 0.9]]
  for (const [width, a] of passes) {
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.strokeStyle = `rgba(220,238,255,${(alpha * a).toFixed(3)})`
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

const STRIKE_LIFETIME = 700

export function StormLoop() {
  const strikesRef = useRef<Strike[]>([])
  const nextAtRef = useRef<number | null>(null)

  const canvasRef = useEffectCanvas((ctx, elapsed, w, h) => {
    if (nextAtRef.current === null) nextAtRef.current = elapsed + rand(600, 2200)

    if (elapsed >= nextAtRef.current) {
      const main = generateBoltPx(w, h)
      const branches = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => {
        const originIdx = 1 + Math.floor(Math.random() * (main.length - 2))
        const [ox, oy] = main[originIdx]
        return generateBranchPx(ox, oy, w, h)
      })
      strikesRef.current.push({ start: elapsed, main, branches })
      nextAtRef.current = elapsed + rand(4000, 11000)
    }

    strikesRef.current = strikesRef.current.filter((s) => elapsed - s.start < STRIKE_LIFETIME)

    for (const s of strikesRef.current) {
      const age = elapsed - s.start
      const envelope = Math.max(0, Math.sin((age / STRIKE_LIFETIME) * Math.PI))
      const flicker = 0.6 + 0.4 * Math.sin(age * 0.09)
      const alpha = envelope * flicker

      ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.5).toFixed(3)})`
      ctx.fillRect(0, 0, w, h)

      drawBolt(ctx, s.main, alpha, false)
      for (const b of s.branches) drawBolt(ctx, b, alpha * 0.7, true)
    }
  })

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}
