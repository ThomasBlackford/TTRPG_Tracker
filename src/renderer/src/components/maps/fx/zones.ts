import {
  TAU, at, between, blobPath, circlePath, clamp, ease, heartPath, kitePath, lerp, mix, paint, puffCluster, rgba, ring, rng,
  runeRing, seg, shape, slashPath, sparkle, spikePath, starPath
} from './kit'
import type { Ctx, ZoneParams } from './kit'

// Zones linger until dismissed, so `t` just keeps counting up and every motion
// is periodic (sin/cos or a modulo cycle). They pop in over the first half
// second; the wrapper at the bottom handles that.

export interface ZoneFx {
  draw: (ctx: Ctx, t: number, p: ZoneParams) => void
}

// A thick, inked edge ring with tick marks — the "this is where it ends" line.
function edge(ctx: Ctx, cx: number, cy: number, r: number, u: number, fill: string, ink: string, thick = 7, dash?: number[], alpha = 1): void {
  if (r < 3) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  ctx.beginPath(); circlePath(ctx, cx, cy, r)
  ctx.strokeStyle = ink; ctx.lineWidth = (thick + 5) * u; ctx.lineCap = 'butt'
  ctx.stroke()
  if (dash) ctx.setLineDash(dash.map((d) => d * u))
  ctx.strokeStyle = fill; ctx.lineWidth = thick * u
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = prev
}

// ── Smoke ───────────────────────────────────────────────────────────────────

const SMOKE = { ink: '#2a2630', body: '#908a98', light: '#bdb8c4', dark: '#6a6472' }

function smoke(ctx: Ctx, t: number, p: ZoneParams): void {
  const { cx, cy, r, u } = p
  const circles: { x: number; y: number; r: number }[] = []
  const ringCount = 15
  for (let i = 0; i < ringCount; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 1)
    const dir = i % 2 ? 1 : -1
    const a = (i / ringCount) * TAU + (t / 1000) * 0.11 * dir + between(rn, -0.1, 0.1)
    const rr = r * (0.78 + 0.05 * Math.sin(t / 900 + i * 1.9))
    circles.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, r: r * between(rn, 0.2, 0.28) * (1 + 0.06 * Math.sin(t / 700 + i)) })
  }
  for (let i = 0; i < 9; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 2)
    const a = between(rn, 0, TAU) + (t / 1000) * 0.07 * (i % 2 ? 1 : -1)
    const d = between(rn, 0, 0.5) * r
    circles.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: r * between(rn, 0.3, 0.42) })
  }
  puffCluster(ctx, circles, SMOKE.body, SMOKE.ink, 3.5 * u, 0.86)

  // Lit crescents on the upper-left of each outer billow, and shadow arcs below.
  for (let i = 0; i < ringCount; i++) {
    const c = circles[i]
    shape(ctx, () => ctx.arc(c.x - c.r * 0.12, c.y - c.r * 0.12, c.r * 0.7, Math.PI * 1.05, Math.PI * 1.72), null, SMOKE.light, Math.max(2, c.r * 0.16), 0.75)
    shape(ctx, () => ctx.arc(c.x + c.r * 0.1, c.y + c.r * 0.12, c.r * 0.72, Math.PI * 0.1, Math.PI * 0.6), null, SMOKE.dark, Math.max(2, c.r * 0.14), 0.55)
  }
}

// ── Hold Person ─────────────────────────────────────────────────────────────

const GOLD = { ink: '#4a3000', gold: '#ffc83a', amber: '#e08a00', cream: '#fff3c2' }

function chainLinks(ctx: Ctx, cx: number, cy: number, ang: number, r0: number, r1: number, u: number, glow: number): void {
  const n = 7
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1)
    const d = lerp(r0, r1, f)
    const x = cx + Math.cos(ang) * d
    const y = cy + Math.sin(ang) * d
    const lit = Math.max(0, 1 - Math.abs(f - glow) * 4)
    at(ctx, x, y, ang + (i % 2 ? Math.PI / 2 : 0), () => {
      const w = 9 * u
      const h = 5.5 * u
      shape(ctx, () => { ctx.roundRect(-w, -h, w * 2, h * 2, h) }, mix(GOLD.amber, GOLD.cream, lit), GOLD.ink, 2.2 * u)
      shape(ctx, () => { ctx.roundRect(-w * 0.55, -h * 0.4, w * 1.1, h * 0.8, h * 0.4) }, GOLD.ink, null, 0)
    })
  }
}

function holdPerson(ctx: Ctx, t: number, p: ZoneParams): void {
  const { cx, cy, r, u } = p
  const pulse = 0.5 + 0.5 * Math.sin(t / 700)
  shape(ctx, () => circlePath(ctx, cx, cy, r), 'rgba(255,200,70,0.10)', null, 0)
  edge(ctx, cx, cy, r, u, GOLD.gold, GOLD.ink, 6)

  // Two rune bands turning in opposite directions.
  runeRing(ctx, cx, cy, r * 0.9, t / 9000, GOLD.gold, 0.85, { glyphs: 14, width: Math.max(1.5, r * 0.012), seed: p.seed, ink: GOLD.ink })
  runeRing(ctx, cx, cy, r * 0.58, -t / 6500, GOLD.cream, 0.75, { glyphs: 8, width: Math.max(1.5, r * 0.012), seed: p.seed + 4, fill: 'rgba(255,200,70,0.12)', ink: GOLD.ink })

  // Six chains lock toward the middle; a bright pulse runs outward along them.
  const glow = (t % 1800) / 1800
  for (let i = 0; i < 6; i++) chainLinks(ctx, cx, cy, (i / 6) * TAU + Math.PI / 6, r * 0.14, r * 0.52, u, glow)

  // The lock at the centre.
  const hr = r * 0.13
  shape(ctx, () => starPath(ctx, cx, cy, hr * 1.25, hr * 0.98, 6, Math.PI / 6), GOLD.gold, GOLD.ink, 3 * u)
  shape(ctx, () => circlePath(ctx, cx, cy - hr * 0.1, hr * 0.38), GOLD.ink, null, 0)
  shape(ctx, () => { ctx.moveTo(cx - hr * 0.16, cy); ctx.lineTo(cx + hr * 0.16, cy); ctx.lineTo(cx + hr * 0.3, cy + hr * 0.62); ctx.lineTo(cx - hr * 0.3, cy + hr * 0.62); ctx.closePath() }, GOLD.ink, null, 0)
  ring(ctx, cx, cy, hr * (1.5 + pulse * 0.4), 2.5 * u, GOLD.cream, 0.5 * (1 - pulse))
}

// ── Fear ────────────────────────────────────────────────────────────────────

const FEAR = { ink: '#07020d', night: '#1b0830', violet: '#7a2fd0', magenta: '#ff4fd8', white: '#ffffff' }

function eyePair(ctx: Ctx, x: number, y: number, s: number, open: number, alpha: number): void {
  if (open <= 0.04 || alpha <= 0.01) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  for (const dx of [-1, 1]) {
    const ex = x + dx * s * 1.1
    ctx.save()
    ctx.translate(ex, y)
    ctx.rotate(dx * -0.28)
    ctx.beginPath()
    ctx.moveTo(-s, 0)
    ctx.quadraticCurveTo(0, -s * 0.9 * open, s, 0)
    ctx.quadraticCurveTo(0, s * 0.9 * open, -s, 0)
    ctx.closePath()
    paint(ctx, FEAR.magenta, FEAR.ink, Math.max(1.5, s * 0.22))
    ctx.fillStyle = FEAR.white
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.2, s * 0.62 * open, 0, 0, TAU); ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = prev
}

function fear(ctx: Ctx, t: number, p: ZoneParams): void {
  const { cx, cy, r, u } = p
  const dread = 0.6 + 0.4 * Math.sin(t / 800)

  shape(ctx, () => spikePath(ctx, cx, cy, rng(p.seed + 3), 22, r, r * 0.84, t / 7000, 0.18), 'rgba(18,6,30,0.8)', rgba(FEAR.violet, 0.9), 3 * u)
  shape(ctx, () => circlePath(ctx, cx, cy, r * 0.78), 'rgba(10,3,18,0.45)', null, 0)

  // Slow, dark spiral turning at the heart of it.
  for (let a = 0; a < 3; a++) {
    ctx.beginPath()
    for (let s = 0; s <= 30; s++) {
      const f = s / 30
      const ang = (a / 3) * TAU - t / 1800 + f * 3.4
      const rr = r * 0.62 * f
      if (s === 0) ctx.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr)
      else ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr)
    }
    ctx.strokeStyle = rgba(FEAR.violet, 0.55 * dread); ctx.lineWidth = 4 * u; ctx.lineCap = 'round'; ctx.stroke()
  }

  // Shadow tendrils reach in from the rim, writhing.
  for (let i = 0; i < 11; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 4)
    const a = (i / 11) * TAU + between(rn, -0.2, 0.2)
    const cycle = ((t + between(rn, 0, 4000)) % between(rn, 2200, 3400)) / 2800
    const reach = Math.sin(Math.min(1, cycle) * Math.PI)
    const r0 = r * 0.98
    const r1 = r * (0.98 - 0.5 * reach)
    const bend = Math.sin(t / 500 + i) * r * 0.1
    shape(ctx, () => slashPath(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a + 0.12) * r1, cy + Math.sin(a + 0.12) * r1, bend, r * 0.07),
      FEAR.night, FEAR.violet, 2 * u, 0.95)
  }

  // Eyes open in the dark, one pair at a time.
  for (let i = 0; i < 6; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 5)
    const a = between(rn, 0, TAU)
    const d = between(rn, 0.2, 0.62) * r
    const period = between(rn, 2800, 4400)
    const k = ((t + between(rn, 0, period)) % period) / period
    const open = k < 0.1 ? ease.outBack(k / 0.1, 1.5) : k < 0.75 ? 1 : 1 - seg(k, 0.75, 0.85)
    const blink = k > 0.4 && k < 0.45 ? 0.1 : 1
    eyePair(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(5, r * 0.075), open * blink, 1)
  }
}

// ── Charm ───────────────────────────────────────────────────────────────────

const LOVE = { ink: '#4a0f2a', deep: '#d02a6a', pink: '#ff6fa8', light: '#ffb3d1', white: '#ffffff' }

function charm(ctx: Ctx, t: number, p: ZoneParams): void {
  const { cx, cy, r, u } = p
  shape(ctx, () => circlePath(ctx, cx, cy, r), 'rgba(255,111,168,0.15)', null, 0)
  shape(ctx, () => circlePath(ctx, cx, cy, r * 0.62), 'rgba(255,179,209,0.10)', null, 0)

  // A ring of little hearts around the edge pulses in a travelling wave.
  const n = Math.max(12, Math.round((r * TAU) / (30 * u)))
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const wave = 0.5 + 0.5 * Math.sin(a * 3 - t / 380)
    const s = (6 + 5 * wave) * u
    shape(ctx, () => heartPath(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, s), i % 2 ? LOVE.pink : LOVE.light, LOVE.ink, 2 * u)
  }

  // Big hearts float up from the middle and fade.
  for (let i = 0; i < 8; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 6)
    const period = between(rn, 3200, 4600)
    const k = ((t + between(rn, 0, period)) % period) / period
    const x0 = cx + between(rn, -0.55, 0.55) * r
    const y0 = cy + between(rn, -0.1, 0.5) * r
    const s = between(rn, 10, 20) * u * ease.outBack(seg(k, 0, 0.12), 1.8)
    const px = x0 + Math.sin(k * TAU * 1.5 + i) * 14 * u
    const py = y0 - k * r * 0.95
    const alpha = Math.min(1, k * 8) * (1 - ease.inCubic(seg(k, 0.6, 1)))
    shape(ctx, () => heartPath(ctx, px, py, s), i % 3 === 0 ? LOVE.deep : LOVE.pink, LOVE.ink, 2.5 * u, alpha)
    shape(ctx, () => ctx.arc(px - s * 0.45, py - s * 0.28, s * 0.4, Math.PI * 1.1, Math.PI * 1.65), null, LOVE.white, Math.max(1.5, s * 0.16), alpha * 0.85)
  }
  for (let i = 0; i < 10; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 7)
    const a = between(rn, 0, TAU)
    const d = between(rn, 0.1, 0.9) * r
    const k = ((t / 900 + between(rn, 0, 1)) % 1)
    sparkle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, (4 + 6 * Math.sin(k * Math.PI)) * u, t / 300 + i, LOVE.white, null, 1)
  }
}

// ── Sleep ───────────────────────────────────────────────────────────────────

const DREAM = { ink: '#1d1850', indigo: '#4a3fa0', lav: '#b9b2f0', pale: '#e4e0ff', gold: '#ffe27a' }

function bigZ(ctx: Ctx, x: number, y: number, s: number, rot: number, alpha: number): void {
  if (alpha <= 0.01 || s < 3) return
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.moveTo(-s, -s); ctx.lineTo(s, -s); ctx.lineTo(s, -s * 0.55); ctx.lineTo(-s * 0.2, s * 0.55); ctx.lineTo(s, s * 0.55)
  ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.lineTo(-s, s * 0.55); ctx.lineTo(s * 0.2, -s * 0.55); ctx.lineTo(-s, -s * 0.55)
  ctx.closePath()
  paint(ctx, DREAM.pale, DREAM.ink, Math.max(2, s * 0.22))
  ctx.restore()
}

function sleep(ctx: Ctx, t: number, p: ZoneParams): void {
  const { cx, cy, r, u } = p
  const breathe = 1 + 0.025 * Math.sin(t / 1100)

  // A dream-cloud rim around an indigo dome.
  const circles: { x: number; y: number; r: number }[] = []
  const n = 16
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + t / 12000
    const rr = r * 0.9 * breathe
    circles.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, r: r * (0.15 + 0.03 * Math.sin(t / 900 + i * 2)) })
  }
  circles.push({ x: cx, y: cy, r: r * 0.9 * breathe })
  puffCluster(ctx, circles, 'rgba(74,63,160,0.46)', DREAM.ink, 3 * u, 1)
  shape(ctx, () => circlePath(ctx, cx, cy, r * 0.66), 'rgba(110,100,200,0.22)', null, 0)

  // A crescent moon rocks gently at the centre.
  const mx = cx
  const my = cy + Math.sin(t / 1300) * r * 0.03
  const mr = r * 0.26
  ctx.save()
  ctx.translate(mx, my)
  ctx.rotate(-0.4 + Math.sin(t / 1900) * 0.08)
  ctx.beginPath()
  ctx.arc(0, 0, mr, Math.PI * 0.18, Math.PI * 1.82, false)
  ctx.arc(mr * 0.38, -mr * 0.04, mr * 0.78, Math.PI * 1.72, Math.PI * 0.28, true)
  ctx.closePath()
  paint(ctx, DREAM.gold, DREAM.ink, 3 * u)
  ctx.restore()

  // Stars twinkle; Zs drift up and to the right, growing.
  for (let i = 0; i < 9; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 8)
    const a = between(rn, 0, TAU)
    const d = between(rn, 0.25, 0.85) * r
    const k = (t / 1400 + between(rn, 0, 1)) % 1
    sparkle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, (4 + 6 * Math.sin(k * Math.PI)) * u, 0, DREAM.pale, null, 1)
  }
  for (let i = 0; i < 6; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 9)
    const period = between(rn, 3600, 5200)
    const k = ((t + between(rn, 0, period)) % period) / period
    const x0 = cx + between(rn, -0.4, 0.2) * r
    const s = lerp(7, 15, k) * u
    bigZ(ctx, x0 + k * r * 0.55, cy + r * 0.3 - k * r * 0.95, s, -0.15 + Math.sin(k * 6 + i) * 0.1, Math.sin(k * Math.PI) * 0.95)
  }
}

// ── Silence ─────────────────────────────────────────────────────────────────

const HUSH = { ink: '#1c2630', slate: '#7f93a6', light: '#c9d6e2', white: '#ffffff' }

function silence(ctx: Ctx, t: number, p: ZoneParams): void {
  const { cx, cy, r, u } = p
  shape(ctx, () => circlePath(ctx, cx, cy, r), 'rgba(110,130,150,0.2)', null, 0)
  edge(ctx, cx, cy, r, u, HUSH.light, HUSH.ink, 4, [12, 9], 0.9)
  edge(ctx, cx, cy, r * 0.93, u, HUSH.slate, HUSH.ink, 1.5, undefined, 0.6)

  // Sound rings collapse *inward* and die — noise smothered.
  for (let i = 0; i < 3; i++) {
    const k = ((t / 2600 + i / 3) % 1)
    const rr = r * 0.9 * (1 - ease.outCubic(k))
    ring(ctx, cx, cy, rr, lerp(5, 1.5, k) * u, HUSH.white, Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.75, HUSH.ink, 1.5 * u)
  }

  // The mute mark: a source dot, sound arcs, and a bold slash through them.
  const s = r * 0.2
  const ox = cx - s * 0.5
  shape(ctx, () => circlePath(ctx, ox, cy, s * 0.22), HUSH.white, HUSH.ink, 3 * u)
  for (let i = 1; i <= 3; i++) {
    shape(ctx, () => ctx.arc(ox, cy, s * (0.5 + i * 0.42), -0.7, 0.7), null, HUSH.ink, 8 * u)
    shape(ctx, () => ctx.arc(ox, cy, s * (0.5 + i * 0.42), -0.7, 0.7), null, HUSH.white, 4 * u)
  }
  ctx.lineCap = 'round'
  ctx.strokeStyle = HUSH.ink; ctx.lineWidth = 13 * u
  ctx.beginPath(); ctx.moveTo(cx - s * 1.35, cy - s * 1.35); ctx.lineTo(cx + s * 1.35, cy + s * 1.35); ctx.stroke()
  ctx.strokeStyle = '#e04848'; ctx.lineWidth = 7 * u; ctx.stroke()
}

// ── Web ─────────────────────────────────────────────────────────────────────

const WEB = { ink: '#2b2b2b', silk: '#f4f2e8', dew: '#bfe8ff' }

function web(ctx: Ctx, t: number, p: ZoneParams): void {
  const { cx, cy, r, u } = p
  const SPOKES = 10
  const RINGS = 5
  const sway = Math.sin(t / 2200) * 0.025
  const sag = 0.16 + 0.03 * Math.sin(t / 1500)
  const R0 = r * 0.96

  shape(ctx, () => circlePath(ctx, cx, cy, r), 'rgba(235,235,225,0.07)', null, 0)

  const strands = () => {
    ctx.beginPath()
    for (let i = 0; i < SPOKES; i++) {
      const a = (i / SPOKES) * TAU + sway
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0)
    }
    for (let ringI = 1; ringI <= RINGS; ringI++) {
      const f = ringI / RINGS
      for (let i = 0; i < SPOKES; i++) {
        const a0 = (i / SPOKES) * TAU + sway
        const a1 = ((i + 1) / SPOKES) * TAU + sway
        const x0 = cx + Math.cos(a0) * R0 * f, y0 = cy + Math.sin(a0) * R0 * f
        const x1 = cx + Math.cos(a1) * R0 * f, y1 = cy + Math.sin(a1) * R0 * f
        const am = (a0 + a1) / 2
        const cxm = cx + Math.cos(am) * R0 * f * (1 - sag)
        const cym = cy + Math.sin(am) * R0 * f * (1 - sag)
        ctx.moveTo(x0, y0)
        ctx.quadraticCurveTo(cxm, cym, x1, y1)
      }
    }
  }
  ctx.lineCap = 'round'
  strands(); ctx.strokeStyle = WEB.ink; ctx.lineWidth = 5 * u; ctx.stroke()
  strands(); ctx.strokeStyle = WEB.silk; ctx.lineWidth = 2.4 * u; ctx.stroke()

  // Dew drops catch the light at the junctions.
  for (let i = 0; i < 12; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 10)
    const si = Math.floor(rn() * SPOKES)
    const ri = 2 + Math.floor(rn() * (RINGS - 1))
    const a = (si / SPOKES) * TAU + sway
    const d = (ri / RINGS) * R0
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d
    shape(ctx, () => circlePath(ctx, x, y, 4.2 * u), 'rgba(191,232,255,0.8)', WEB.ink, 1.5 * u)
    const g = (t / 1600 + rn()) % 1
    if (g < 0.2) sparkle(ctx, x, y, (5 + 8 * Math.sin((g / 0.2) * Math.PI)) * u, 0, '#ffffff', null, 1)
  }

  // A spider patrols the middle ring.
  const sa = t / 2600
  const sd = R0 * 0.4
  const sx = cx + Math.cos(sa) * sd
  const sy = cy + Math.sin(sa) * sd
  at(ctx, sx, sy, sa + Math.PI / 2, () => {
    ctx.strokeStyle = WEB.ink; ctx.lineWidth = 2.2 * u; ctx.lineCap = 'round'
    for (let l = 0; l < 4; l++) {
      for (const sd2 of [-1, 1]) {
        const w = Math.sin(t / 90 + l * 1.3 + (sd2 > 0 ? 0 : 1.5)) * 3 * u
        ctx.beginPath()
        ctx.moveTo(0, (l - 1.5) * 4 * u)
        ctx.lineTo(sd2 * 9 * u, (l - 1.5) * 5.5 * u + w)
        ctx.lineTo(sd2 * 15 * u, (l - 1.5) * 8 * u + w * 1.4)
        ctx.stroke()
      }
    }
    shape(ctx, () => ctx.ellipse(0, 4 * u, 6 * u, 8 * u, 0, 0, TAU), WEB.ink, null, 0)
    shape(ctx, () => circlePath(ctx, 0, -6 * u, 4 * u), WEB.ink, null, 0)
    shape(ctx, () => circlePath(ctx, 0, 4 * u, 2 * u), '#e04848', null, 0)
  })
}

// ── Darkness ────────────────────────────────────────────────────────────────

const VOID = { ink: '#05020a', void: '#0c0616', purple: '#7a3fd0', violet: '#b07dff', star: '#ffffff' }

function darkness(ctx: Ctx, t: number, p: ZoneParams): void {
  const { cx, cy, r, u } = p
  // The void itself: nearly opaque, edge breathing like ink in water.
  shape(ctx, () => blobPath(ctx, cx, cy, r, t / 1400, 9, 0.045), 'rgba(6,3,14,0.9)', VOID.purple, 3.5 * u)
  shape(ctx, () => blobPath(ctx, cx, cy, r * 0.94, -t / 1600, 7, 0.05), null, rgba(VOID.violet, 0.4), 1.5 * u)

  // Roiling ink billows along the rim.
  for (let i = 0; i < 10; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 11)
    const a = (i / 10) * TAU + t / 5200 * (i % 2 ? 1 : -1)
    const d = r * between(rn, 0.55, 0.9) * (1 + 0.05 * Math.sin(t / 800 + i))
    const rr = r * between(rn, 0.14, 0.24)
    puffCluster(ctx, [{ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: rr }, { x: cx + Math.cos(a + 0.12) * d * 0.96, y: cy + Math.sin(a + 0.12) * d * 0.96, r: rr * 0.7 }],
      VOID.void, rgba(VOID.purple, 0.8), 2.2 * u, 0.95)
  }

  // Specks of "star" wink in the void.
  for (let i = 0; i < 12; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 12)
    const a = between(rn, 0, TAU)
    const d = Math.sqrt(rn()) * r * 0.8
    const k = (t / 1700 + between(rn, 0, 1)) % 1
    const tw = Math.sin(k * Math.PI)
    if (tw > 0.05) sparkle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, (2.5 + 5 * tw) * u, 0, i % 3 ? VOID.violet : VOID.star, null, tw)
  }

  // A slow whirl at the centre, like something looking back.
  for (let a = 0; a < 3; a++) {
    ctx.beginPath()
    for (let s = 0; s <= 26; s++) {
      const f = s / 26
      const ang = (a / 3) * TAU + t / 2400 + f * 3
      const rr = r * 0.34 * f
      if (s === 0) ctx.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr)
      else ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr)
    }
    ctx.strokeStyle = rgba(VOID.purple, 0.55); ctx.lineWidth = 3 * u; ctx.lineCap = 'round'; ctx.stroke()
  }
}

// ── Registry ────────────────────────────────────────────────────────────────

// Wraps every zone with the shared pop-in: the radius overshoots slightly as
// it appears, and the whole thing fades up so it never just "snaps" on.
function popIn(draw: ZoneFx['draw']): ZoneFx['draw'] {
  return (ctx, t, p) => {
    const g = ease.outBack(seg(t, 0, 520), 1.25)
    if (g <= 0.01) return
    const prev = ctx.globalAlpha
    ctx.globalAlpha = prev * clamp(seg(t, 0, 160))
    draw(ctx, t, { ...p, r: p.r * g })
    ctx.globalAlpha = prev
  }
}

export const ZONES = {
  smoke:       { draw: popIn(smoke) },
  hold_person: { draw: popIn(holdPerson) },
  fear:        { draw: popIn(fear) },
  charm:       { draw: popIn(charm) },
  sleep:       { draw: popIn(sleep) },
  silence:     { draw: popIn(silence) },
  web:         { draw: popIn(web) },
  darkness:    { draw: popIn(darkness) }
} satisfies Record<string, ZoneFx>

void kitePath
