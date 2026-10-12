import {
  TAU, at, between, blobPath, boltPoints, circlePath, clamp, drawBolt, ease, flamePath, flash, kitePath, lerp, mix,
  paint, puffCluster, radialWedges, rgba, ring, rng, seg, shape, sparkle, spikePath, starPath
} from './kit'
import type { Ctx, RayParams } from './kit'

// Rays share one timeline — charge → shoot → hold → collapse — and one
// geometry; each element dresses it differently.

export interface RayFx {
  duration: number
  draw: (ctx: Ctx, t: number, p: RayParams) => void
}

const CHARGE_END = 200
const SHOOT_END = 330
const HOLD_END = 1050

interface Frame {
  ang: number
  len: number
  cs: number
  sn: number
  charge: number // 0→1 while the orb forms
  head: number // 0→1 how far the beam has travelled
  width: number // overall width multiplier (collapses at the end)
  landed: boolean
  hit: number // 0→1 over the impact flash
  fade: number // 1→0 over the collapse
}

function frameOf(t: number, D: number, p: RayParams): Frame {
  const dx = p.x2 - p.x1
  const dy = p.y2 - p.y1
  const len = Math.max(1, Math.hypot(dx, dy))
  const head = ease.outExpo(seg(t, CHARGE_END, SHOOT_END))
  return {
    ang: Math.atan2(dy, dx),
    len,
    cs: dx / len,
    sn: dy / len,
    charge: ease.outBack(seg(t, 0, CHARGE_END), 1.6),
    head,
    width: 1 - ease.inCubic(seg(t, HOLD_END, D)),
    landed: t >= SHOOT_END - 20,
    hit: seg(t, SHOOT_END - 20, SHOOT_END + 220),
    fade: 1 - seg(t, HOLD_END, D)
  }
}

// A point `s` (0..1 along the full ray) offset sideways by `off` px.
function along(p: RayParams, f: Frame, s: number, off = 0): [number, number] {
  return [p.x1 + f.cs * f.len * s - f.sn * off, p.y1 + f.sn * f.len * s + f.cs * off]
}

function beamPath(p: RayParams, f: Frame, wave: (s: number) => number, steps = 48): [number, number][] {
  const pts: [number, number][] = []
  const end = f.head
  const n = Math.max(2, Math.ceil(steps * end))
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * end
    pts.push(along(p, f, s, wave(s)))
  }
  return pts
}

function strokeLine(ctx: Ctx, pts: [number, number][], width: number, color: string, alpha = 1, cap: CanvasLineCap = 'round'): void {
  if (pts.length < 2 || width <= 0.2 || alpha <= 0.003) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = cap
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.globalAlpha = prev
}

// ── Fire ray (Scorching Ray) ────────────────────────────────────────────────

const FIRE = { ink: '#2a0a06', deep: '#a8200c', red: '#e63b14', orange: '#ff8a1f', yellow: '#ffd23a', cream: '#fff4c6' }

function fireRay(ctx: Ctx, t: number, p: RayParams): void {
  const { u } = p
  const D = 1400
  const f = frameOf(t, D, p)
  const wob = (s: number) => Math.sin(s * 22 - t / 55) * 4.5 * u + Math.sin(s * 9 - t / 90) * 3 * u

  // Impact scorch + blast at the target.
  if (f.landed) {
    const k = f.hit
    const out = f.fade
    shape(ctx, () => blobPath(ctx, p.x2, p.y2, 44 * u * ease.outCubic(k), 1.1, 7, 0.16), 'rgba(24,10,6,0.6)', null, 0, out)
    const pulse = 1 + 0.07 * Math.sin(t / 45)
    for (const [m, col, lw] of [[1, FIRE.deep, 4], [0.76, FIRE.orange, 2.5], [0.5, FIRE.yellow, 0], [0.26, FIRE.cream, 0]] as [number, string, number][]) {
      shape(ctx, () => blobPath(ctx, p.x2, p.y2, 46 * u * m * ease.outBack(k, 1.8) * pulse * (0.5 + 0.5 * f.width), t / 120 + m * 4, 5, 0.12),
        col, lw ? FIRE.ink : null, lw * u, out)
    }
    const rk = seg(t, SHOOT_END - 20, SHOOT_END + 420)
    if (rk > 0 && rk < 1) ring(ctx, p.x2, p.y2, 90 * u * ease.outExpo(rk), lerp(14, 1.5, rk) * u, FIRE.cream, 1 - rk, FIRE.ink, 1.5 * u)
    const hk = seg(t, SHOOT_END - 20, SHOOT_END + 170)
    if (hk > 0 && hk < 1) shape(ctx, () => starPath(ctx, p.x2, p.y2, 80 * u * ease.outCubic(hk), 30 * u * ease.outCubic(hk), 10, t / 300), FIRE.cream, FIRE.yellow, 4 * u, 1 - hk)
  }

  // The beam: four stacked flame-coloured strokes with a licking edge.
  const pts = beamPath(p, f, wob)
  const pulse = 1 + 0.08 * Math.sin(t / 38)
  const w = f.width * pulse
  strokeLine(ctx, pts, 44 * u * w, FIRE.ink)
  strokeLine(ctx, pts, 33 * u * w, FIRE.red)
  strokeLine(ctx, pts, 23 * u * w, FIRE.orange)
  strokeLine(ctx, pts, 13 * u * w, FIRE.yellow)
  strokeLine(ctx, pts, 5.5 * u * w, FIRE.cream)

  // Little flames peel off the beam, alternating sides.
  for (let i = 0; i < 14; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 1)
    const s = (i + 0.5) / 14
    if (s > f.head) continue
    const flick = (t / 130 + i * 0.37 + rn()) % 1
    const side = i % 2 ? 1 : -1
    const off = wob(s) + side * 14 * u
    const [fx, fy] = along(p, f, s, off)
    const h = (22 + 18 * Math.sin(flick * Math.PI)) * u * f.width
    // Leaning back toward the origin, like flame blown by the beam's speed.
    at(ctx, fx, fy, f.ang + side * (Math.PI / 2 + 0.75) + Math.PI / 2, () => {
      shape(ctx, () => flamePath(ctx, 0, 0, h, 8 * u, Math.sin(t / 60 + i) * 4 * u), FIRE.orange, FIRE.ink, 2 * u)
      shape(ctx, () => flamePath(ctx, 0, 0, h * 0.55, 4.5 * u, 0), FIRE.yellow, null, 0)
    })
  }

  // Embers streak down the beam toward the target.
  for (let i = 0; i < 16; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 2)
    const speed = between(rn, 0.7, 1.5)
    const off = between(rn, -12, 12) * u
    const phase = between(rn, 0, 1)
    const s = ((t / 1000) * speed + phase) % 1
    if (s > f.head) continue
    const [ex, ey] = along(p, f, s, off + wob(s))
    at(ctx, ex, ey, f.ang, () => shape(ctx, () => kitePath(ctx, 13 * u, 6 * u, 0.4), s % 0.3 > 0.15 ? FIRE.yellow : FIRE.cream, FIRE.ink, 1.2 * u, f.width))
  }

  // Origin: a fire orb forms, pulses, then gutters out.
  const orb = f.charge * (0.55 + 0.45 * f.width)
  if (orb > 0.02) {
    const r = 27 * u * orb * (1 + 0.1 * Math.sin(t / 50))
    shape(ctx, () => blobPath(ctx, p.x1, p.y1, r, t / 90, 6, 0.12), FIRE.red, FIRE.ink, 4 * u)
    shape(ctx, () => blobPath(ctx, p.x1, p.y1, r * 0.66, -t / 100, 5, 0.12), FIRE.orange, null, 0)
    shape(ctx, () => blobPath(ctx, p.x1, p.y1, r * 0.34, t / 80, 5, 0.1), FIRE.cream, null, 0)
  }
  if (t < CHARGE_END) radialWedges(ctx, p.x1, p.y1, 12 * u, 80 * u * (1 - f.charge * 0.5), 12, rng(p.seed + 3), FIRE.orange, 5 * u, 0.8 * (1 - seg(t, 120, CHARGE_END)), 0, 0.5, true)
}

// ── Ice ray (Ray of Frost) ──────────────────────────────────────────────────

const ICE = { ink: '#0b2a4a', deep: '#1d6fb8', mid: '#47b7ef', light: '#a6e6ff', white: '#ffffff' }

function snowflake(ctx: Ctx, x: number, y: number, r: number, rot: number, alpha: number): void {
  if (alpha <= 0.003 || r < 2) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  for (const [lw, col] of [[r * 0.2, ICE.ink], [r * 0.11, ICE.mid], [r * 0.05, ICE.white]] as [number, string][]) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU
      const cs = Math.cos(a), sn = Math.sin(a)
      ctx.moveTo(0, 0); ctx.lineTo(cs * r, sn * r)
      for (const fr of [0.45, 0.72]) {
        const bx = cs * r * fr, by = sn * r * fr, bl = r * (fr === 0.45 ? 0.32 : 0.22)
        for (const sgn of [-1, 1]) {
          const a2 = a + sgn * 0.95
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a2) * bl, by + Math.sin(a2) * bl)
        }
      }
    }
    ctx.stroke()
    ctx.restore()
  }
  ctx.globalAlpha = prev
}

function iceRay(ctx: Ctx, t: number, p: RayParams): void {
  const { u } = p
  const D = 1350
  const f = frameOf(t, D, p)

  // Frozen ground where it lands.
  if (f.landed) {
    const k = ease.outExpo(f.hit)
    shape(ctx, () => spikePath(ctx, p.x2, p.y2, rng(p.seed + 5), 14, 74 * u * k, 44 * u * k, 0.3, 0.35),
      'rgba(160,226,255,0.4)', ICE.white, 2.5 * u, f.fade)
    snowflake(ctx, p.x2, p.y2, 58 * u * ease.outBack(f.hit, 1.4), t / 2400, f.fade)
    const rk = seg(t, SHOOT_END - 20, SHOOT_END + 440)
    if (rk > 0 && rk < 1) ring(ctx, p.x2, p.y2, 100 * u * ease.outExpo(rk), lerp(14, 1.5, rk) * u, ICE.light, 1 - rk, ICE.ink, 1.5 * u)
  }

  // The beam: a clean, hard-edged lance of ice, with faceted crystals strung along it.
  const pts = beamPath(p, f, () => 0, 2)
  const w = f.width * (1 + 0.04 * Math.sin(t / 60))
  strokeLine(ctx, pts, 36 * u * w, ICE.ink, 1, 'butt')
  strokeLine(ctx, pts, 26 * u * w, ICE.deep, 1, 'butt')
  strokeLine(ctx, pts, 16 * u * w, ICE.mid, 1, 'butt')
  strokeLine(ctx, pts, 6 * u * w, ICE.white, 1, 'butt')

  const crystals = Math.max(2, Math.floor(f.len / (46 * u)))
  for (let i = 1; i < crystals; i++) {
    const s = i / crystals
    if (s > f.head) break
    const [cx, cy] = along(p, f, s, 0)
    const sz = (22 + (i % 2) * 8) * u * f.width
    at(ctx, cx, cy, f.ang, () => {
      shape(ctx, () => { ctx.moveTo(-sz * 0.7, 0); ctx.lineTo(0, -sz * 0.62); ctx.lineTo(sz * 0.7, 0); ctx.lineTo(0, sz * 0.62); ctx.closePath() }, ICE.light, ICE.ink, 2.5 * u)
      shape(ctx, () => { ctx.moveTo(-sz * 0.7, 0); ctx.lineTo(0, -sz * 0.62); ctx.lineTo(sz * 0.7, 0); ctx.closePath() }, ICE.white, null, 0, 0.9)
    })
  }

  // Shards spin off sideways; sparkles twinkle in the wake.
  for (let i = 0; i < 18; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 3)
    const s0 = between(rn, 0.05, 0.95)
    const life = between(rn, 420, 800)
    const born = SHOOT_END + between(rn, 0, 500)
    const k = seg(t, born, born + life)
    if (k <= 0 || k >= 1 || s0 > f.head) continue
    const side = rn() > 0.5 ? 1 : -1
    const off = side * (16 + 54 * ease.outCubic(k)) * u
    const [sx, sy] = along(p, f, s0, off)
    if (i % 3 === 0) sparkle(ctx, sx, sy, (5 + 8 * Math.sin(k * Math.PI)) * u, t / 200 + i, ICE.white, null, 1)
    else at(ctx, sx, sy, f.ang + side * 1.2 + k * 5, () => shape(ctx, () => kitePath(ctx, 15 * u, 7 * u, 0.4), ICE.mid, ICE.ink, 1.5 * u, 1 - k))
  }

  // Origin: a snowflake sigil spins up.
  const oa = f.charge * (0.4 + 0.6 * f.width)
  snowflake(ctx, p.x1, p.y1, 38 * u * oa, t / 380, f.fade > 0.05 ? 1 : 0)
  if (t < CHARGE_END) radialWedges(ctx, p.x1, p.y1, 12 * u, 80 * u * (1 - f.charge * 0.5), 12, rng(p.seed + 3), ICE.light, 5 * u, 0.8 * (1 - seg(t, 120, CHARGE_END)), 0, 0.5, true)
}

// ── Poison ray ──────────────────────────────────────────────────────────────

const TOX = { ink: '#12240d', deep: '#2f6b1c', green: '#58b32a', lime: '#a5e63c', hi: '#e5ff9a' }

function poisonRay(ctx: Ctx, t: number, p: RayParams): void {
  const { u } = p
  const D = 1450
  const f = frameOf(t, D, p)
  const wave = (s: number) => Math.sin(s * 16 - t / 85) * 13 * u * Math.min(1, s * 6)

  // Splash: a puddle of goo and a ring where it hits.
  if (f.landed) {
    const k = ease.outBack(f.hit, 1.5)
    shape(ctx, () => blobPath(ctx, p.x2, p.y2, 50 * u * k, t / 300, 7, 0.17), TOX.deep, TOX.ink, 4 * u, f.fade)
    shape(ctx, () => blobPath(ctx, p.x2, p.y2, 34 * u * k, -t / 280, 6, 0.15), TOX.green, null, 0, f.fade)
    shape(ctx, () => blobPath(ctx, p.x2, p.y2, 16 * u * k, t / 240, 5, 0.12), TOX.lime, null, 0, f.fade)
    const rk = seg(t, SHOOT_END - 20, SHOOT_END + 420)
    if (rk > 0 && rk < 1) ring(ctx, p.x2, p.y2, 96 * u * ease.outExpo(rk), lerp(14, 2, rk) * u, TOX.lime, 1 - rk, TOX.ink, 1.5 * u)
  }

  const pts = beamPath(p, f, wave, 60)
  const w = f.width
  strokeLine(ctx, pts, 36 * u * w, TOX.ink)
  strokeLine(ctx, pts, 27 * u * w, TOX.deep)
  strokeLine(ctx, pts, 18 * u * w, TOX.green)
  strokeLine(ctx, pts, 9 * u * w, TOX.lime)
  strokeLine(ctx, pts, 3 * u * w, TOX.hi)

  // Bubbles ride the beam, drifting off the edge; droplets fall away.
  for (let i = 0; i < 16; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 4)
    const speed = between(rn, 0.5, 1.1)
    const s = (((t / 1000) * speed + between(rn, 0, 1)) % 1)
    if (s > f.head) continue
    const drift = ((s * 7 + i) % 1) * 22 * u * (i % 2 ? 1 : -1)
    const [bx, by] = along(p, f, s, wave(s) + drift)
    const r = between(rn, 4.5, 9) * u * f.width
    shape(ctx, () => circlePath(ctx, bx, by, r), 'rgba(200,255,120,0.4)', TOX.ink, 2 * u)
    shape(ctx, () => ctx.arc(bx, by, r * 0.6, Math.PI * 1.15, Math.PI * 1.65), null, TOX.hi, 1.6 * u)
  }
  for (let i = 0; i < 8; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 5)
    const born = SHOOT_END + between(rn, 0, 650)
    const k = seg(t, born, born + 520)
    const s0 = between(rn, 0.1, 0.95)
    if (k <= 0 || k >= 1 || s0 > f.head) continue
    const [dx, dy] = along(p, f, s0, wave(s0))
    shape(ctx, () => flamePath(ctx, dx, dy + 14 * u * k + 40 * u * k * k, 13 * u * (1 - k * 0.3), 5 * u, 0), TOX.green, TOX.ink, 1.5 * u, 1 - k)
  }

  // Origin: a toxic puff swirls.
  const orb = f.charge * (0.5 + 0.5 * f.width)
  if (orb > 0.02) {
    const r = 22 * u * orb
    puffCluster(ctx, [{ x: p.x1, y: p.y1, r }, { x: p.x1 + r * 0.7, y: p.y1 + r * 0.1, r: r * 0.7 }, { x: p.x1 - r * 0.6, y: p.y1 + r * 0.2, r: r * 0.65 }], TOX.green, TOX.ink, 3.5 * u, 1)
    shape(ctx, () => ctx.arc(p.x1 - r * 0.2, p.y1 - r * 0.2, r * 0.6, Math.PI * 1.1, Math.PI * 1.7), null, TOX.hi, 3 * u)
  }
}

// ── Lightning ray ───────────────────────────────────────────────────────────

const BOLT = { ink: '#0a1e4a', body: '#4aa8ff', core: '#ffffff', glow: '#bfe4ff' }

function lightningRay(ctx: Ctx, t: number, p: RayParams): void {
  const { u } = p
  const D = 1150
  const f = frameOf(t, D, p)
  const tick = Math.floor(t / 55) // re-roll the jag a few times a second, like a real arc
  const segs = Math.max(4, Math.round(f.len / (46 * u)))
  const jitter = 38 * u

  // Impact: white star + shards + glow ring.
  if (f.landed) {
    const k = f.hit
    shape(ctx, () => starPath(ctx, p.x2, p.y2, 62 * u * ease.outCubic(k) * (0.7 + 0.3 * Math.sin(t / 30)), 20 * u * ease.outCubic(k), 9, tick * 0.7), BOLT.core, BOLT.body, 4 * u, f.fade)
    const rk = seg(t, SHOOT_END - 20, SHOOT_END + 400)
    if (rk > 0 && rk < 1) ring(ctx, p.x2, p.y2, 90 * u * ease.outExpo(rk), lerp(14, 1.5, rk) * u, BOLT.glow, 1 - rk, BOLT.ink, 1.5 * u)
    for (let i = 0; i < 10; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 6 + tick * 3)
      const a = between(rn, 0, TAU)
      const d = between(rn, 20, 62) * u
      const s = between(rn, 6, 12) * u
      at(ctx, p.x2 + Math.cos(a) * d, p.y2 + Math.sin(a) * d, a, () => shape(ctx, () => kitePath(ctx, s * 2, s, 0.4), BOLT.glow, BOLT.ink, 1.2 * u, f.fade))
    }
  }

  // The arc: a fresh jagged path every few frames, with two flickering forks.
  const end = f.head
  if (end > 0.01 && f.width > 0.02) {
    const ex = p.x1 + f.cs * f.len * end
    const ey = p.y1 + f.sn * f.len * end
    const main = boltPoints(rng(p.seed + tick * 13), p.x1, p.y1, ex, ey, Math.max(3, Math.round(segs * end)), jitter)
    drawBolt(ctx, main, 9 * u * f.width, BOLT, 1)
    for (let b = 0; b < 2; b++) {
      const rb = rng(p.seed + tick * 29 + b * 5)
      const idx = 1 + Math.floor(rb() * Math.max(1, main.length - 2))
      const [bx, by] = main[Math.min(idx, main.length - 1)]
      const dir = b % 2 ? 1 : -1
      const ang = f.ang + dir * between(rb, 0.5, 0.95)
      const bl = between(rb, 50, 100) * u
      const branch = boltPoints(rb, bx, by, bx + Math.cos(ang) * bl, by + Math.sin(ang) * bl, 4, 22 * u)
      drawBolt(ctx, branch, 4.6 * u * f.width, BOLT, 0.9)
    }
    // A second, fainter arc hugging the first.
    const ghost = boltPoints(rng(p.seed + tick * 7 + 99), p.x1, p.y1, ex, ey, Math.max(3, Math.round(segs * end)), jitter * 1.3)
    drawBolt(ctx, ghost, 3.4 * u * f.width, BOLT, 0.45)
  }

  // Origin: a spiky crackling star.
  const orb = f.charge * (0.5 + 0.5 * f.width)
  if (orb > 0.02) {
    shape(ctx, () => spikePath(ctx, p.x1, p.y1, rng(p.seed + tick), 8, 36 * u * orb, 13 * u * orb, tick * 0.9, 0.35), BOLT.core, BOLT.body, 3.5 * u)
    shape(ctx, () => circlePath(ctx, p.x1, p.y1, 10 * u * orb), BOLT.body, null, 0)
  }
  flash(ctx, p.w, p.h, BOLT.glow, 0.14 * ease.outCubic(seg(t, CHARGE_END, SHOOT_END)) * f.fade)
}

function until(duration: number, draw: RayFx['draw']): RayFx['draw'] {
  return (ctx, t, p) => {
    if (t < 0 || t > duration) return
    draw(ctx, t, p)
  }
}

export const RAYS = {
  fire_ray:      { duration: 1400, draw: until(1400, fireRay) },
  ice_ray:       { duration: 1350, draw: until(1350, iceRay) },
  poison_ray:    { duration: 1450, draw: until(1450, poisonRay) },
  lightning_ray: { duration: 1150, draw: until(1150, lightningRay) }
} satisfies Record<string, RayFx>

void mix; void paint; void rgba
