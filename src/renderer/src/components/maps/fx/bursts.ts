import {
  TAU, additive, annulusPath, at, between, blobPath, boltPoints, circlePath, clamp, drawBolt, ease, flamePath,
  flash, heartPath, kiteFacetPath, kitePath, lerp, mix, paint, puffCluster, radialWedges, rgba, ring, rng, runeRing,
  seg, shape, slashPath, sparkle, spikePath, starPath, tri, vignette
} from './kit'
import type { Ctx, PointParams } from './kit'

// Every burst is a pure function of (elapsed ms, params). Sizes are in `u`
// units (≈1 on a normal map, scaling with zoom) so a fireball keeps its
// footprint on the map when the DM zooms in.

export interface BurstFx {
  duration: number
  // Screen effects ignore x/y and shake the whole window.
  screen?: boolean
  shake?: boolean
  draw: (ctx: Ctx, t: number, p: PointParams) => void
}

// A particle that flies out with drag: position = v · (1 − e^(−k·s)) / k.
function drift(speed: number, sec: number, drag = 3): number {
  return (speed * (1 - Math.exp(-drag * sec))) / drag
}

// ── Fireball ────────────────────────────────────────────────────────────────

const FIRE = {
  ink: '#2a0a06', deep: '#a8200c', red: '#e63b14', orange: '#ff8a1f', yellow: '#ffd23a', cream: '#fff4c6',
  smokeDark: '#2e2622', smokeLight: '#65574d'
}

function fireball(ctx: Ctx, t: number, p: PointParams): void {
  const { x, y, u } = p

  // Scorch mark on the ground — drawn first so everything sits on top of it.
  const scorchGrow = ease.outCubic(seg(t, 40, 320))
  const scorchFade = 1 - seg(t, 900, 1600)
  shape(ctx, () => blobPath(ctx, x, y, 98 * u * scorchGrow, 1.3, 7, 0.16), 'rgba(24,10,6,0.6)', null, 0, scorchFade)

  // Smoke billows up after the blast — dark, outlined, with a lit crescent.
  for (let i = 0; i < 7; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 1)
    const a = between(rn, 0, TAU)
    const d = between(rn, 8, 62) * u
    const start = 280 + i * 50
    const k = seg(t, start, start + 1000)
    if (k <= 0) continue
    const rise = ease.outQuad(k) * between(rn, 50, 95) * u
    const px = x + Math.cos(a) * d * (0.6 + k * 0.5)
    const py = y + Math.sin(a) * d * 0.7 - rise
    const r = (26 + 36 * ease.outQuad(k)) * u
    const alpha = clamp(seg(t, start, start + 220)) * (1 - seg(t, start + 600, start + 1000)) * 0.92
    puffCluster(ctx, [{ x: px, y: py, r }, { x: px + r * 0.55, y: py + r * 0.15, r: r * 0.7 }, { x: px - r * 0.5, y: py + r * 0.2, r: r * 0.65 }],
      FIRE.smokeDark, FIRE.ink, 3 * u, alpha)
    shape(ctx, () => { ctx.arc(px - r * 0.22, py - r * 0.22, r * 0.62, Math.PI * 1.05, Math.PI * 1.7) },
      null, rgba(FIRE.smokeLight, 0.8), 5 * u, alpha)
  }

  // Shockwaves: thick-to-thin rings, cream then orange.
  for (let i = 0; i < 2; i++) {
    const s0 = i * 90
    const k = seg(t, s0, s0 + 560)
    if (k <= 0 || k >= 1) continue
    const rr = (i === 0 ? 178 : 124) * u * ease.outExpo(k)
    const th = lerp(i === 0 ? 24 : 16, 1.5, ease.outCubic(k)) * u
    ring(ctx, x, y, rr, th, i === 0 ? FIRE.cream : FIRE.orange, 1 - ease.inCubic(k), FIRE.ink, 1.5 * u)
  }

  // The fireball body: four stacked wobbly layers that collapse inside-out.
  const grow = ease.outBack(seg(t, 0, 280), 1.5)
  const layers = [
    { m: 1.0, fill: FIRE.deep, lw: 5 },
    { m: 0.8, fill: FIRE.orange, lw: 3 },
    { m: 0.55, fill: FIRE.yellow, lw: 2.5 },
    { m: 0.3, fill: FIRE.cream, lw: 0 }
  ]
  layers.forEach((l, i) => {
    const collapse = 1 - ease.inCubic(seg(t, 360, 1020 - i * 170))
    const r = 106 * u * l.m * grow * collapse
    if (r < 1) return
    shape(ctx, () => blobPath(ctx, x, y, r, t / 150 + i * 1.7, 5 + (i % 2), 0.11 - i * 0.01),
      l.fill, l.lw ? FIRE.ink : null, l.lw * u)
  })

  // Flame tongues thrown outward around the rim.
  for (let i = 0; i < 13; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 2)
    const a = (i / 13) * TAU + between(rn, -0.2, 0.2)
    const start = between(rn, 20, 170)
    const life = between(rn, 420, 700)
    const k = seg(t, start, start + life)
    if (k <= 0 || k >= 1) continue
    const dist = (62 + between(rn, 14, 52) * ease.outCubic(k)) * u + 26 * u * k
    const sc = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.95 + 0.05
    const h = between(rn, 54, 94) * u * sc
    const w = between(rn, 15, 22) * u * sc
    const sway = Math.sin(t / 70 + i) * 7 * u
    at(ctx, x + Math.cos(a) * dist, y + Math.sin(a) * dist, a + Math.PI / 2, () => {
      shape(ctx, () => flamePath(ctx, 0, 0, h, w, sway), FIRE.orange, FIRE.ink, 3 * u)
      shape(ctx, () => flamePath(ctx, 0, 0, h * 0.64, w * 0.6, sway * 0.7), FIRE.yellow, null, 0)
      shape(ctx, () => flamePath(ctx, 0, 0, h * 0.32, w * 0.3, sway * 0.4), FIRE.cream, null, 0)
    })
  }

  // Embers: little kites flung out with drag, each with a streak behind it.
  for (let i = 0; i < 26; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 3)
    const a = between(rn, 0, TAU)
    const speed = between(rn, 260, 640) * u
    const life = between(rn, 620, 1150)
    const k = seg(t, 0, life)
    if (k <= 0 || k >= 1) continue
    const sec = t / 1000
    const d = drift(speed, sec, 3.2)
    const px = x + Math.cos(a) * d
    const py = y + Math.sin(a) * d - 18 * u * sec
    const col = mix(FIRE.yellow, FIRE.red, k)
    const s = between(rn, 5, 11) * u * (1 - k * 0.6)
    ctx.strokeStyle = rgba(FIRE.orange, 0.7 * (1 - k))
    ctx.lineWidth = s * 0.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px - Math.cos(a) * s * 3.2, py - Math.sin(a) * s * 3.2)
    ctx.stroke()
    at(ctx, px, py, a, () => shape(ctx, () => kitePath(ctx, s * 1.8, s, 0.4), col, FIRE.ink, 1.5 * u), 1)
  }

  // Impact frame: a cream star slams in and is gone in a few frames.
  const hit = seg(t, 0, 190)
  if (hit > 0 && hit < 1) {
    const star = 1 - ease.inCubic(hit)
    shape(ctx, () => starPath(ctx, x, y, 150 * u * ease.outCubic(hit * 2.2 > 1 ? 1 : hit * 2.2), 66 * u * ease.outCubic(Math.min(1, hit * 2.2)), 12, t / 400),
      FIRE.cream, FIRE.yellow, 5 * u, star)
  }
  flash(ctx, p.w, p.h, FIRE.orange, 0.32 * (1 - seg(t, 0, 240)))
}

// ── Frost ───────────────────────────────────────────────────────────────────

const ICE = { ink: '#0b2a4a', deep: '#1d6fb8', mid: '#47b7ef', light: '#a6e6ff', white: '#ffffff' }

function snowflakeArm(ctx: Ctx, len: number, lw: number, color: string): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(len, 0)
  for (const f of [0.38, 0.66]) {
    const bx = len * f
    const bl = len * (f === 0.38 ? 0.34 : 0.24)
    ctx.moveTo(bx, 0); ctx.lineTo(bx + bl * 0.55, -bl * 0.85)
    ctx.moveTo(bx, 0); ctx.lineTo(bx + bl * 0.55, bl * 0.85)
  }
  ctx.stroke()
}

function frost(ctx: Ctx, t: number, p: PointParams): void {
  const { x, y, u } = p
  if (t >= 1800) return // everything has faded; don't repaint invisible shapes
  const fade = 1 - seg(t, 1250, 1800)

  // Frozen ground: an irregular crystalline patch with crack lines in it.
  const grow = ease.outExpo(seg(t, 0, 380))
  shape(ctx, () => spikePath(ctx, x, y, rng(p.seed + 5), 16, 138 * u * grow, 82 * u * grow, 0.2, 0.35),
    'rgba(160,226,255,0.34)', rgba(ICE.white, 0.9), 2.5 * u, fade)
  shape(ctx, () => spikePath(ctx, x, y, rng(p.seed + 9), 11, 82 * u * grow, 50 * u * grow, 0.9, 0.3),
    'rgba(214,244,255,0.5)', null, 0, fade)
  for (let i = 0; i < 9; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 4)
    const a = (i / 9) * TAU + between(rn, -0.25, 0.25)
    const k = ease.outCubic(seg(t, 40 + i * 18, 460))
    if (k <= 0) continue
    const len = between(rn, 90, 150) * u * k
    ctx.beginPath()
    ctx.moveTo(x, y)
    let px = x, py = y
    const segs = 5
    for (let s = 1; s <= segs; s++) {
      const f = (s / segs) * len
      const off = (rn() - 0.5) * 16 * u
      px = x + Math.cos(a) * f + Math.cos(a + Math.PI / 2) * off
      py = y + Math.sin(a) * f + Math.sin(a + Math.PI / 2) * off
      ctx.lineTo(px, py)
    }
    ctx.strokeStyle = rgba(ICE.ink, 0.55 * fade); ctx.lineWidth = 6 * u; ctx.lineJoin = 'round'; ctx.stroke()
    ctx.strokeStyle = rgba(ICE.white, 0.95 * fade); ctx.lineWidth = 2.5 * u; ctx.stroke()
  }

  // Outward shock ring.
  const rk = seg(t, 0, 460)
  if (rk > 0 && rk < 1) ring(ctx, x, y, 170 * u * ease.outExpo(rk), lerp(18, 1.5, rk) * u, ICE.light, 1 - ease.inCubic(rk), ICE.ink, 1.5 * u)

  // Snowflake blooms from the centre.
  const bloom = ease.outBack(seg(t, 60, 520), 1.2)
  if (bloom > 0.02) {
    const rot = t / 2600
    const len = 92 * u * bloom
    for (const pass of [{ lw: 11 * u, col: ICE.ink }, { lw: 6.5 * u, col: ICE.mid }, { lw: 3 * u, col: ICE.white }]) {
      ctx.save()
      ctx.globalAlpha = fade
      ctx.translate(x, y)
      ctx.rotate(rot)
      for (let i = 0; i < 6; i++) {
        ctx.save()
        ctx.rotate((i / 6) * TAU)
        snowflakeArm(ctx, len, pass.lw, pass.col)
        ctx.restore()
      }
      ctx.restore()
    }
    shape(ctx, () => starPath(ctx, x, y, 17 * u * bloom, 9 * u * bloom, 6, rot), ICE.white, ICE.deep, 2.5 * u, fade)
  }

  // Big crystals thrust out, stand, then shatter into small shards.
  for (let i = 0; i < 9; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 5)
    const a = (i / 9) * TAU + between(rn, -0.2, 0.2)
    const len = between(rn, 62, 118) * u
    const wid = between(rn, 22, 36) * u
    const born = 70 + i * 22
    const grow2 = ease.outBack(seg(t, born, born + 280), 1.3)
    const shatter = seg(t, 1120, 1300)
    const off = (28 + i % 3 * 6) * u
    if (grow2 > 0.02 && shatter < 1) {
      at(ctx, x + Math.cos(a) * off, y + Math.sin(a) * off, a, () => {
        const sc = grow2 * (1 - shatter * 0.4)
        ctx.globalAlpha = 1 - shatter
        shape(ctx, () => kitePath(ctx, len * sc, wid * sc, 0.32), ICE.deep, ICE.ink, 3 * u)
        shape(ctx, () => kiteFacetPath(ctx, len * sc, wid * sc, 0.32), ICE.light, null, 0)
        ctx.globalAlpha = 1
      })
    }
    if (shatter > 0) {
      for (let s = 0; s < 3; s++) {
        const sa = a + (s - 1) * 0.55
        const d = (off + len * 0.7) + drift(150 * u, (t - 1120) / 1000, 2.4) * (0.7 + s * 0.2)
        at(ctx, x + Math.cos(sa) * d, y + Math.sin(sa) * d, sa + (t - 1120) / 160 * (s - 1),
          () => shape(ctx, () => kitePath(ctx, 17 * u, 9 * u), ICE.mid, ICE.ink, 1.5 * u, 1 - seg(t, 1250, 1750)))
      }
    }
  }

  // Twinkling sparkles.
  for (let i = 0; i < 16; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 6)
    const a = between(rn, 0, TAU)
    const d = between(rn, 30, 160) * u
    const s0 = between(rn, 80, 700)
    const life = between(rn, 480, 900)
    const k = seg(t, s0, s0 + life)
    if (k <= 0 || k >= 1) continue
    sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d - 20 * u * k, (6 + 9 * Math.sin(k * Math.PI)) * u, t / 300 + i, ICE.white, null, 1)
  }

  flash(ctx, p.w, p.h, ICE.light, 0.3 * (1 - seg(t, 0, 200)))
  const core = seg(t, 0, 120)
  if (core < 1) shape(ctx, () => circlePath(ctx, x, y, 100 * u * (0.5 + core * 0.5)), ICE.white, null, 0, 1 - core)
}

// A stylized skull: round cranium, tapered jaw, hollow eyes, nose notch.
function skull(ctx: Ctx, x: number, y: number, s: number, fill: string, ink: string, alpha: number): void {
  if (alpha <= 0.003 || s < 2) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  ctx.beginPath()
  ctx.moveTo(x - s * 0.62, y + s * 0.18)
  ctx.bezierCurveTo(x - s * 1.05, y - s * 0.2, x - s * 0.75, y - s * 1.05, x, y - s * 1.05)
  ctx.bezierCurveTo(x + s * 0.75, y - s * 1.05, x + s * 1.05, y - s * 0.2, x + s * 0.62, y + s * 0.18)
  ctx.lineTo(x + s * 0.5, y + s * 0.78)
  ctx.lineTo(x + s * 0.22, y + s * 0.78)
  ctx.lineTo(x + s * 0.18, y + s * 0.95)
  ctx.lineTo(x - s * 0.18, y + s * 0.95)
  ctx.lineTo(x - s * 0.22, y + s * 0.78)
  ctx.lineTo(x - s * 0.5, y + s * 0.78)
  ctx.closePath()
  paint(ctx, fill, ink, Math.max(2, s * 0.1))
  ctx.fillStyle = ink
  for (const dx of [-0.36, 0.36]) {
    ctx.beginPath(); circlePath(ctx, x + dx * s, y - s * 0.12, s * 0.24); ctx.fill()
  }
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.14); ctx.lineTo(x - s * 0.1, y + s * 0.38); ctx.lineTo(x + s * 0.1, y + s * 0.38); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.5, s * 0.07)
  ctx.beginPath()
  for (const dx of [-0.18, 0, 0.18]) { ctx.moveTo(x + dx * s, y + s * 0.62); ctx.lineTo(x + dx * s, y + s * 0.9) }
  ctx.stroke()
  ctx.globalAlpha = prev
}

// ── Poison ──────────────────────────────────────────────────────────────────

const TOX = { ink: '#12240d', deep: '#2f6b1c', green: '#58b32a', lime: '#a5e63c', hi: '#e5ff9a', purple: '#7a3fb5' }

function poison(ctx: Ctx, t: number, p: PointParams): void {
  const { x, y, u } = p
  const total = 2800
  const fadeOut = 1 - seg(t, 2200, total)
  const fadeIn = ease.outCubic(seg(t, 0, 320))

  // Hazard ring on the ground: dashes that slowly turn.
  const hz = 118 * u * ease.outBack(seg(t, 0, 380), 1.1)
  ctx.save()
  ctx.globalAlpha = 0.7 * fadeOut
  ctx.setLineDash([16 * u, 12 * u])
  ctx.lineDashOffset = -t / 40
  ctx.lineWidth = 4 * u
  ctx.strokeStyle = TOX.lime
  ctx.beginPath(); circlePath(ctx, x, y, hz); ctx.stroke()
  ctx.restore()

  // Initial splash: droplets thrown outward and a bright ring.
  const sk = seg(t, 0, 520)
  if (sk > 0 && sk < 1) {
    ring(ctx, x, y, 126 * u * ease.outExpo(sk), lerp(18, 2, sk) * u, TOX.lime, 1 - sk, TOX.ink, 1.5 * u)
    for (let i = 0; i < 14; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 7)
      const a = (i / 14) * TAU + between(rn, -0.2, 0.2)
      const d = drift(between(rn, 220, 420) * u, t / 1000, 3.4)
      at(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, a + Math.PI / 2, () => {
        const s = between(rn, 8, 14) * u * (1 - sk * 0.5)
        shape(ctx, () => flamePath(ctx, 0, s, s * 2.2, s * 0.8, 0), TOX.green, TOX.ink, 2 * u, 1 - sk)
      })
    }
  }

  // The toxic cloud: lobed, outlined billows rolling slowly around the spot.
  for (let i = 0; i < 10; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 8)
    const a0 = (i / 10) * TAU
    const orbit = between(rn, 30, 96) * u * (0.35 + 0.65 * ease.outBack(seg(t, 0, 420), 1.4))
    const spin = (t / 1000) * (0.35 + (i % 3) * 0.12) * (i % 2 ? 1 : -1)
    const px = x + Math.cos(a0 + spin) * orbit
    const py = y + Math.sin(a0 + spin) * orbit * 0.9 - Math.sin(t / 700 + i) * 5 * u
    const r = between(rn, 34, 56) * u * (0.55 + 0.45 * fadeIn) * (1 + 0.07 * Math.sin(t / 380 + i))
    const col = i % 4 === 0 ? TOX.lime : i % 4 === 1 ? TOX.green : i % 4 === 2 ? '#7c52b8' : TOX.deep
    puffCluster(ctx, [{ x: px, y: py, r }, { x: px + r * 0.7, y: py + r * 0.2, r: r * 0.66 }, { x: px - r * 0.62, y: py + r * 0.25, r: r * 0.6 }],
      col, TOX.ink, 3.5 * u, 0.9 * fadeIn * fadeOut)
    shape(ctx, () => ctx.arc(px - r * 0.18, py - r * 0.2, r * 0.6, Math.PI * 1.1, Math.PI * 1.72), null, rgba(TOX.hi, 0.7), 5 * u, fadeIn * fadeOut)
  }

  // A skull emblem rises out of the cloud, wobbling, then dissolves.
  const sk2 = seg(t, 380, 1900)
  if (sk2 > 0 && sk2 < 1) {
    const pop = ease.outBack(seg(sk2, 0, 0.16), 1.9)
    const sy = y - 12 * u - ease.outQuad(sk2) * 44 * u
    skull(ctx, x + Math.sin(t / 260) * 5 * u, sy, 34 * u * pop, '#eaf7c6', TOX.ink, (1 - ease.inCubic(seg(sk2, 0.6, 1))) * 0.97)
  }

  // Bubbles rise and pop with a tiny ring.
  for (let i = 0; i < 16; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 9)
    const a = between(rn, 0, TAU)
    const d = between(rn, 0, 84) * u
    const s0 = between(rn, 200, 1700)
    const life = between(rn, 700, 1100)
    const k = seg(t, s0, s0 + life)
    if (k <= 0 || k >= 1) continue
    const r = between(rn, 6, 13) * u
    const bx = x + Math.cos(a) * d + Math.sin(t / 220 + i) * 4 * u
    const by = y + Math.sin(a) * d * 0.8 - k * 48 * u
    if (k < 0.86) {
      shape(ctx, () => circlePath(ctx, bx, by, r * (0.6 + k * 0.6)), 'rgba(200,255,120,0.28)', TOX.ink, 2 * u)
      shape(ctx, () => ctx.arc(bx, by, r * (0.6 + k * 0.6) * 0.62, Math.PI * 1.15, Math.PI * 1.65), null, TOX.hi, 2 * u)
    } else {
      const pk = seg(k, 0.86, 1)
      ring(ctx, bx, by, r * (1 + pk * 1.5), 2.5 * u, TOX.hi, 1 - pk)
    }
  }
}

// ── Heal ────────────────────────────────────────────────────────────────────

const HEAL = { ink: '#0b3a2a', mint: '#52f0a8', green: '#1fbf7a', gold: '#ffd96a', pale: '#c9ffe6', white: '#ffffff' }

function plusPath(ctx: Ctx, s: number): void {
  const a = s * 0.34
  const pts: [number, number][] = [[-a, -s], [a, -s], [a, -a], [s, -a], [s, a], [a, a], [a, s], [-a, s], [-a, a], [-s, a], [-s, -a], [-a, -a]]
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)))
  ctx.closePath()
}

function heal(ctx: Ctx, t: number, p: PointParams): void {
  const { x, y, u } = p
  const fade = 1 - seg(t, 1150, 1600)

  // A rune circle blooms on the ground and slowly turns.
  const pop = ease.outBack(seg(t, 0, 300), 1.3)
  runeRing(ctx, x, y, 96 * u * pop, t / 900, HEAL.mint, fade * clamp(seg(t, 0, 120)),
    { glyphs: 10, width: 3 * u, seed: p.seed, fill: 'rgba(82,240,168,0.16)', ink: HEAL.ink })

  // A pillar of light descends: banded, flat, no soft gradients.
  const beamIn = ease.outCubic(seg(t, 0, 200))
  const pw = 58 * u * beamIn * (1 + 0.05 * Math.sin(t / 60))
  const top = y - 520 * u
  const beamAlpha = fade * clamp(1 - seg(t, 800, 1150))
  const bandCols: [number, number, string][] = [[1.7, 0.2, HEAL.mint], [1.15, 0.38, HEAL.pale], [0.55, 0.95, HEAL.white]]
  for (const [wm, a, col] of bandCols) {
    shape(ctx, () => ctx.rect(x - pw * wm / 2, top, pw * wm, y - top), col, null, 0, a * beamAlpha)
  }

  // Pulse rings radiate out.
  for (let i = 0; i < 2; i++) {
    const k = seg(t, 120 + i * 140, 760 + i * 140)
    if (k <= 0 || k >= 1) continue
    ring(ctx, x, y, 140 * u * ease.outCubic(k), lerp(16, 2, k) * u, i === 0 ? HEAL.mint : HEAL.gold, 1 - k, HEAL.ink, 1.5 * u)
  }

  // Plus signs float up from the circle's rim.
  for (let i = 0; i < 9; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 10)
    const a = (i / 9) * TAU + between(rn, -0.2, 0.2)
    const s0 = 100 + i * 70
    const k = seg(t, s0, s0 + 900)
    if (k <= 0 || k >= 1) continue
    const px = x + Math.cos(a) * 66 * u + Math.sin(t / 230 + i * 2) * 7 * u
    const py = y + Math.sin(a) * 66 * u * 0.8 - ease.outQuad(k) * 130 * u
    const s = (13 + 5 * (i % 3)) * u * ease.outBack(seg(k, 0, 0.18), 1.6)
    const alpha = Math.min(1, k * 7) * (1 - ease.inCubic(seg(k, 0.55, 1)))
    ctx.save()
    ctx.translate(px, py)
    ctx.globalAlpha = alpha
    ctx.beginPath(); plusPath(ctx, s)
    paint(ctx, i % 2 ? HEAL.gold : HEAL.mint, HEAL.ink, 2.5 * u)
    ctx.restore()
  }

  // Sparkles twinkle upward.
  for (let i = 0; i < 14; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 11)
    const a = between(rn, 0, TAU)
    const d = between(rn, 20, 110) * u
    const s0 = between(rn, 60, 600)
    const k = seg(t, s0, s0 + between(rn, 600, 1000))
    if (k <= 0 || k >= 1) continue
    sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 - k * 60 * u, (5 + 8 * Math.sin(k * Math.PI)) * u, t / 260 + i,
      i % 2 ? HEAL.white : HEAL.gold, null, 1)
  }

  // Landing flash.
  const lf = seg(t, 0, 170)
  if (lf < 1) shape(ctx, () => circlePath(ctx, x, y, (30 + 90 * lf) * u), HEAL.white, null, 0, 1 - lf)
  flash(ctx, p.w, p.h, HEAL.pale, 0.16 * (1 - seg(t, 0, 200)))
}

// ── Impact (screen) ─────────────────────────────────────────────────────────

const STONE = { ink: '#14100d', dust: '#c9bda8', dustDark: '#8d8170', rock: '#5c5247', rockLight: '#8b7e6e', white: '#ffffff' }

function impact(ctx: Ctx, t: number, p: PointParams): void {
  const { w, h, u } = p
  const cx = w / 2
  const cy = h / 2
  const span = Math.min(w, h)

  // Cracks first, so the flash frames can sit on top of them.
  for (let i = 0; i < 10; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 12)
    const a = (i / 10) * TAU + between(rn, -0.22, 0.22)
    const len = between(rn, 0.32, 0.62) * span
    const k = ease.outExpo(seg(t, 30 + i * 6, 360))
    if (k <= 0) continue
    const fade = 1 - seg(t, 600, 1000)
    const pts: [number, number][] = [[cx, cy]]
    const segs = 7
    for (let s = 1; s <= segs; s++) {
      const f = (s / segs) * len * k
      const off = (rn() - 0.5) * 34 * u
      pts.push([cx + Math.cos(a) * f + Math.cos(a + Math.PI / 2) * off, cy + Math.sin(a) * f + Math.sin(a + Math.PI / 2) * off])
    }
    ctx.lineJoin = 'miter'; ctx.lineCap = 'round'; ctx.globalAlpha = fade
    for (const [lw, col] of [[16 * u, STONE.ink], [7 * u, '#f6e7c8']] as [number, string][]) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1])
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke()
    }
    ctx.globalAlpha = 1
    // a short side-crack off the middle of each one
    if (k > 0.5) {
      const m = pts[3]
      ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(m[0] + Math.cos(a + 0.9) * 60 * u * k, m[1] + Math.sin(a + 0.9) * 60 * u * k)
      ctx.strokeStyle = rgba(STONE.ink, fade); ctx.lineWidth = 6 * u; ctx.stroke()
    }
  }

  // Dust billows out along the cracks.
  for (let i = 0; i < 12; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 13)
    const a = (i / 12) * TAU + between(rn, -0.2, 0.2)
    const k = seg(t, 60 + i * 12, 760)
    if (k <= 0 || k >= 1) continue
    const d = ease.outCubic(k) * between(rn, 0.12, 0.34) * span + 30 * u
    const r = (22 + 38 * k) * u
    const px = cx + Math.cos(a) * d
    const py = cy + Math.sin(a) * d
    puffCluster(ctx, [{ x: px, y: py, r }, { x: px + r * 0.6, y: py + r * 0.2, r: r * 0.7 }], STONE.dust, STONE.ink, 3 * u, (1 - ease.inQuad(k)) * 0.95)
  }

  // Rock chunks tumble outward.
  for (let i = 0; i < 16; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 14)
    const a = between(rn, 0, TAU)
    const k = seg(t, 20, between(rn, 520, 900))
    if (k <= 0 || k >= 1) continue
    const d = drift(between(rn, 520, 1150) * u, t / 1000, 2.6) + 16 * u
    const s = between(rn, 9, 22) * u * (1 - k * 0.5)
    at(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, between(rn, 0, TAU) + t / 130 * (i % 2 ? 1 : -1), () => {
      shape(ctx, () => starPath(ctx, 0, 0, s, s * 0.62, 5), STONE.rock, STONE.ink, 2.5 * u, 1 - ease.inCubic(k))
      shape(ctx, () => { ctx.moveTo(-s * 0.5, -s * 0.2); ctx.lineTo(0, -s * 0.8); ctx.lineTo(s * 0.4, -s * 0.2) }, null, STONE.rockLight, 2 * u, 1 - ease.inCubic(k))
    })
  }

  // Shock ring.
  const rk = seg(t, 0, 460)
  if (rk > 0 && rk < 1) ring(ctx, cx, cy, span * 0.62 * ease.outExpo(rk), lerp(34, 2, rk) * u, STONE.white, 1 - ease.inCubic(rk), STONE.ink, 2 * u)

  // Impact frames: white, then a dark frame crossed by speed lines.
  if (t < 55) flash(ctx, w, h, '#ffffff', 1)
  else if (t < 120) {
    flash(ctx, w, h, '#000000', 0.62)
    radialWedges(ctx, cx, cy, span * 0.12, span * 0.75, 38, rng(p.seed + 3), '#ffffff', 12 * u, 0.95, 0, 0.45, false)
  } else flash(ctx, w, h, '#ffffff', 0.4 * (1 - seg(t, 120, 300)))
  vignette(ctx, w, h, '#000000', 0.6 * (1 - seg(t, 150, 760)), 0.45)
}

// ── Lightning (screen) ──────────────────────────────────────────────────────

const BOLT = { ink: '#0a1e4a', body: '#4aa8ff', core: '#ffffff', glow: '#bfe4ff' }

function lightning(ctx: Ctx, t: number, p: PointParams): void {
  const { w, h, u } = p
  const R = rng(p.seed)
  const sx = w * between(R, 0.3, 0.7)
  const ex = sx + between(R, -0.12, 0.12) * w
  const ey = h * between(R, 0.58, 0.8)
  const main = boltPoints(rng(p.seed + 11), sx, -30, ex, ey, 9, 150 * u)

  // The sky goes dark before it strikes.
  flash(ctx, w, h, '#050a1e', 0.42 * (1 - seg(t, 0, 760)))

  // Ground strike: spiky star, ring, wedges and sparks where the bolt lands.
  const gk = seg(t, 40, 560)
  if (gk > 0 && gk < 1) {
    const out = 1 - ease.inCubic(gk)
    shape(ctx, () => starPath(ctx, ex, ey, 110 * u * ease.outCubic(seg(gk, 0, 0.35)), 36 * u * ease.outCubic(seg(gk, 0, 0.35)), 10, 0.3),
      BOLT.core, BOLT.body, 5 * u, out)
    ring(ctx, ex, ey, 190 * u * ease.outExpo(gk), lerp(24, 2, gk) * u, BOLT.glow, out, BOLT.ink, 1.5 * u)
    radialWedges(ctx, ex, ey, 20 * u, 150 * u * ease.outCubic(gk), 14, rng(p.seed + 2), BOLT.core, 8 * u, out)
    for (let i = 0; i < 12; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 15)
      const a = between(rn, -Math.PI, 0)
      const d = drift(between(rn, 260, 600) * u, (t - 40) / 1000, 3)
      at(ctx, ex + Math.cos(a) * d, ey + Math.sin(a) * d, a, () => shape(ctx, () => kitePath(ctx, 13 * u, 6 * u, 0.4), BOLT.glow, BOLT.ink, 1.5 * u, out))
    }
    shape(ctx, () => blobPath(ctx, ex, ey, 54 * u, 2.2, 6, 0.15), 'rgba(8,10,20,0.55)', null, 0, 1 - seg(t, 300, 760))
  }

  // The bolt: visible in flickering bursts, then lingers as a fading ghost.
  const flick = t < 60 ? 1 : t < 100 ? 0.15 : t < 190 ? 1 : t < 230 ? 0.35 : 0.95
  const life = 1 - seg(t, 200, 760)
  const a = flick * life
  if (a > 0.01) {
    drawBolt(ctx, main, 7 * u, BOLT, a)
    for (let i = 0; i < 3; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 16)
      const ob = 2 + Math.floor(rn() * (main.length - 4))
      const [bx, by] = main[ob]
      const dir = i % 2 ? 1 : -1
      const branch = boltPoints(rng(p.seed + 20 + i), bx, by, bx + dir * between(rn, 90, 190) * u, by + between(rn, 90, 190) * u, 6, 46 * u)
      drawBolt(ctx, branch, 3.4 * u, BOLT, a * 0.9)
    }
  }

  // Strobing impact frames.
  if (t < 45) flash(ctx, w, h, '#ffffff', 1)
  else if (t >= 95 && t < 135) flash(ctx, w, h, '#dff0ff', 0.7)
  else if (t >= 135) flash(ctx, w, h, BOLT.glow, 0.28 * (1 - seg(t, 135, 480)))
  vignette(ctx, w, h, '#02061a', 0.5 * (1 - seg(t, 100, 800)), 0.5)
}

// ── Rage ────────────────────────────────────────────────────────────────────

const RAGE = { ink: '#2a0505', blood: '#7a0f12', red: '#e0261f', orange: '#ff6a2c', yellow: '#ffc14a', white: '#ffffff' }

// The classic comic "anger vein" mark: four concave wedges around a gap.
function angerMark(ctx: Ctx, x: number, y: number, s: number, rot: number, alpha: number): void {
  if (alpha <= 0.003 || s < 2) return
  const wedge = (scale: number) => {
    for (let i = 0; i < 4; i++) {
      const a = rot + Math.PI / 4 + (i / 4) * TAU
      const d = (ang: number, r: number): [number, number] => [x + Math.cos(ang) * r * scale, y + Math.sin(ang) * r * scale]
      const [p0x, p0y] = d(a - 0.66, s * 0.3)
      const [p1x, p1y] = d(a - 0.5, s)
      const [p3x, p3y] = d(a + 0.66, s * 0.3)
      const [cx, cy] = d(a, s * 0.34)
      ctx.moveTo(p0x, p0y)
      ctx.lineTo(p1x, p1y)
      ctx.arc(x, y, s * scale, a - 0.5, a + 0.5)
      ctx.lineTo(p3x, p3y)
      ctx.quadraticCurveTo(cx, cy, p0x, p0y)
    }
  }
  shape(ctx, () => wedge(1), RAGE.red, RAGE.ink, Math.max(2, s * 0.14), alpha)
  shape(ctx, () => wedge(0.62), RAGE.orange, null, 0, alpha)
}

function rage(ctx: Ctx, t: number, p: PointParams): void {
  const { x, y, u } = p
  const fade = 1 - seg(t, 1000, 1350)

  // Anticipation: lines rush inward as the aura condenses.
  const wind = seg(t, 0, 230)
  if (t < 260) {
    radialWedges(ctx, x, y, 22 * u, 190 * u * (1 - wind * 0.35), 22, rng(p.seed + 4), rgba(RAGE.red, 1), 7 * u, 0.9 * (1 - seg(t, 190, 260)), 0, 0.5, true)
    shape(ctx, () => blobPath(ctx, x, y, lerp(95, 26, ease.inCubic(wind)) * u, t / 60, 7, 0.14), RAGE.blood, RAGE.ink, 4 * u, 1 - seg(t, 230, 270))
  }

  // Ground cracks, glowing orange.
  const ck = ease.outExpo(seg(t, 240, 560))
  for (let i = 0; i < 9; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 17)
    const a = (i / 9) * TAU + between(rn, -0.2, 0.2)
    const len = between(rn, 70, 130) * u * ck
    if (len < 2) continue
    ctx.beginPath(); ctx.moveTo(x, y)
    for (let s = 1; s <= 4; s++) {
      const f = (s / 4) * len
      const off = (rn() - 0.5) * 18 * u
      ctx.lineTo(x + Math.cos(a) * f + Math.cos(a + 1.57) * off, y + Math.sin(a) * f + Math.sin(a + 1.57) * off)
    }
    ctx.lineJoin = 'miter'; ctx.globalAlpha = fade
    ctx.strokeStyle = RAGE.ink; ctx.lineWidth = 11 * u; ctx.stroke()
    ctx.strokeStyle = RAGE.orange; ctx.lineWidth = 5 * u; ctx.stroke()
    ctx.globalAlpha = 1
  }

  // The blast: a jagged ring that rips outward.
  const bk = seg(t, 230, 640)
  if (bk > 0 && bk < 1) {
    const rr = 178 * u * ease.outExpo(bk)
    const th = lerp(34, 3, ease.outCubic(bk)) * u
    const out = 1 - ease.inCubic(bk)
    for (const [lw, col] of [[th + 8 * u, RAGE.ink], [th, RAGE.red], [th * 0.45, RAGE.yellow]] as [number, string][]) {
      ctx.save(); ctx.globalAlpha = out
      ctx.beginPath(); spikePath(ctx, x, y, rng(p.seed + 6), 20, rr, rr * 0.8, t / 900, 0.3)
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.miterLimit = 4; ctx.stroke()
      ctx.restore()
    }
  }
  shape(ctx, () => starPath(ctx, x, y, 120 * u * ease.outCubic(seg(t, 230, 330)), 44 * u * ease.outCubic(seg(t, 230, 330)), 12, t / 300),
    RAGE.yellow, RAGE.ink, 5 * u, 1 - seg(t, 250, 420))

  // Flame aura licks upward around the figure.
  for (let i = 0; i < 16; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 18)
    const a = (i / 16) * TAU
    const start = 280 + (i % 4) * 40
    const k = seg(t, start, 1150)
    if (k <= 0) continue
    const px = x + Math.cos(a) * 74 * u
    const py = y + Math.sin(a) * 74 * u * 0.85
    const hgt = between(rn, 52, 104) * u * Math.min(1, k * 4) * (1 - ease.inCubic(seg(k, 0.65, 1)))
    const sway = Math.sin(t / 90 + i * 1.7) * 9 * u
    ctx.globalAlpha = fade
    shape(ctx, () => flamePath(ctx, px, py, hgt, 15 * u, sway), RAGE.red, RAGE.ink, 3 * u)
    shape(ctx, () => flamePath(ctx, px, py, hgt * 0.6, 9 * u, sway * 0.7), RAGE.orange, null, 0)
    shape(ctx, () => flamePath(ctx, px, py, hgt * 0.28, 4.5 * u, sway * 0.4), RAGE.yellow, null, 0)
    ctx.globalAlpha = 1
  }

  // Anger marks pop in beside the figure, trembling.
  const marks: [number, number, number, number][] = [[-96, -104, 46, 0.2], [92, -124, 34, -0.3]]
  marks.forEach(([mx, my, ms, rot], i) => {
    const pop = ease.outBack(seg(t, 250 + i * 70, 400 + i * 70), 2.2)
    const trem = Math.sin(t / 22 + i * 3) * 2.2 * u
    if (pop > 0.02) angerMark(ctx, x + mx * u + trem, y + my * u, ms * u * pop, rot + t / 3000, fade)
  })

  // Embers shoot upward.
  for (let i = 0; i < 18; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 19)
    const a = between(rn, -Math.PI * 0.95, -Math.PI * 0.05)
    const k = seg(t, 240, 240 + between(rn, 520, 900))
    if (k <= 0 || k >= 1) continue
    const d = drift(between(rn, 180, 420) * u, (t - 240) / 1000, 2.6)
    const s = between(rn, 5, 10) * u * (1 - k * 0.5)
    at(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, a, () => shape(ctx, () => kitePath(ctx, s * 2, s, 0.4), mix(RAGE.yellow, RAGE.red, k), RAGE.ink, 1.5 * u, 1 - k))
  }

  // Heartbeat vignette: two throbs of red at the screen edge.
  const beat = Math.max(tri(t, 120, 420), tri(t, 420, 760) * 0.8)
  vignette(ctx, p.w, p.h, RAGE.red, 0.5 * beat * fade, 0.4)
  flash(ctx, p.w, p.h, '#ff2a1a', 0.3 * (1 - seg(t, 230, 340)) * seg(t, 200, 235))
}

// ── Counterspell ────────────────────────────────────────────────────────────

const ARC = { ink: '#1b0a3a', violet: '#7b3fe4', purple: '#b56bff', lav: '#e3d0ff', white: '#ffffff', cyan: '#6ef0ff', magenta: '#ff5fd8' }

function counterspell(ctx: Ctx, t: number, p: PointParams): void {
  const { x, y, u } = p
  const baseR = 112 * u

  // 0–200ms: the spell circle slams down from large with a little overshoot.
  const slam = ease.outBack(seg(t, 0, 200), 1.6)
  const ringR = baseR * lerp(1.7, 1, slam)
  const a = clamp(seg(t, 0, 80)) * (t < 330 ? 1 : 0)

  if (a > 0) {
    // Chromatic split while it lands — cyan and magenta fringes either side.
    const split = (1 - seg(t, 200, 320)) * 5 * u
    for (const [dx, col] of [[-split, ARC.cyan], [split, ARC.magenta]] as [number, string][]) {
      runeRing(ctx, x + dx, y, ringR, t / 700, col, a * 0.7, { glyphs: 12, width: 3 * u, seed: p.seed })
    }
    runeRing(ctx, x, y, ringR, t / 700, ARC.lav, a, { glyphs: 12, width: 3.4 * u, seed: p.seed, fill: 'rgba(123,63,228,0.28)', ink: ARC.ink })

    // 200ms: the negate stroke ⊘ cuts across it.
    const bar = ease.outExpo(seg(t, 190, 280))
    if (bar > 0) {
      const ang = -Math.PI / 4
      const half = ringR * 1.1 * bar
      const dx = Math.cos(ang) * half
      const dy = Math.sin(ang) * half
      ctx.save()
      ctx.lineCap = 'round'
      ctx.strokeStyle = ARC.ink; ctx.lineWidth = 22 * u; ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke()
      ctx.strokeStyle = ARC.purple; ctx.lineWidth = 14 * u; ctx.stroke()
      ctx.strokeStyle = ARC.white; ctx.lineWidth = 5 * u; ctx.stroke()
      ctx.restore()
    }
  }

  // 300ms+: the circle shatters into arc fragments that spin outward.
  const shatter = seg(t, 300, 900)
  if (shatter > 0) {
    const out = 1 - ease.inCubic(shatter)
    const n = 12
    for (let i = 0; i < n; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 20)
      const a0 = (i / n) * TAU
      const d = baseR * 0.12 + drift(190 * u, (t - 300) / 1000, 2.6) * (0.75 + rn() * 0.5)
      const spin = (t - 300) / 520 * (i % 2 ? 1 : -1)
      const cx = x + Math.cos(a0 + 0.13) * d
      const cy = y + Math.sin(a0 + 0.13) * d
      ctx.save()
      ctx.globalAlpha = out
      ctx.translate(cx, cy)
      ctx.rotate(spin)
      ctx.translate(-cx, -cy)
      ctx.beginPath(); ctx.arc(x + (cx - x), y + (cy - y), baseR * 0.94, a0 - 0.2 - 0.0, a0 + 0.45)
      ctx.lineCap = 'butt'
      ctx.strokeStyle = ARC.ink; ctx.lineWidth = 15 * u; ctx.stroke()
      ctx.strokeStyle = ARC.purple; ctx.lineWidth = 8 * u; ctx.stroke()
      ctx.strokeStyle = ARC.white; ctx.lineWidth = 2.5 * u; ctx.stroke()
      ctx.restore()
    }
    // glass-like shards
    for (let i = 0; i < 22; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 21)
      const sa = between(rn, 0, TAU)
      const d = 24 * u + drift(between(rn, 220, 520) * u, (t - 300) / 1000, 2.8)
      at(ctx, x + Math.cos(sa) * d, y + Math.sin(sa) * d, sa + (t - 300) / 140 * (i % 2 ? 1 : -1),
        () => shape(ctx, () => kitePath(ctx, between(rn, 10, 22) * u, between(rn, 5, 9) * u, 0.4), i % 3 ? ARC.lav : ARC.cyan, ARC.ink, 1.5 * u, out))
    }
    // sparkles at the break
    for (let i = 0; i < 8; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 22)
      const sa = between(rn, 0, TAU)
      const d = between(rn, 20, 130) * u
      const k = seg(t, 320 + i * 25, 700 + i * 25)
      if (k > 0 && k < 1) sparkle(ctx, x + Math.cos(sa) * d, y + Math.sin(sa) * d, (6 + 9 * Math.sin(k * Math.PI)) * u, i, ARC.white, null, 1)
    }
    const rk = seg(t, 300, 640)
    if (rk < 1) ring(ctx, x, y, 170 * u * ease.outExpo(rk), lerp(20, 2, rk) * u, ARC.white, 1 - rk, ARC.violet, 2 * u)
  }
  flash(ctx, p.w, p.h, ARC.lav, 0.38 * tri(t, 190, 380))
}

// ── Radiant ─────────────────────────────────────────────────────────────────

const HOLY = { ink: '#5a3a00', gold: '#ffc83a', amber: '#ffa51a', cream: '#fff3c2', white: '#ffffff' }

function radiant(ctx: Ctx, t: number, p: PointParams): void {
  const { x, y, u } = p
  const fade = 1 - seg(t, 1100, 1500)

  // A column of light drops from above, banded in three flat widths.
  const drop = ease.outExpo(seg(t, 0, 210))
  const bw = 96 * u * (1 - seg(t, 330, 1000) * 0.55) * (1 + 0.04 * Math.sin(t / 50))
  const headY = lerp(-40, y, drop)
  const bAlpha = (1 - seg(t, 360, 1050)) * clamp(seg(t, 0, 40))
  for (const [wm, a, col] of [[1, 0.28, HOLY.gold], [0.64, 0.5, HOLY.cream], [0.28, 1, HOLY.white]] as [number, number, string][]) {
    shape(ctx, () => ctx.rect(x - (bw * wm) / 2, -40, bw * wm, headY + 40), col, null, 0, a * bAlpha)
  }

  // Sunburst: long and short wedges alternating, slowly turning.
  const sk = ease.outExpo(seg(t, 190, 700))
  const sa = (1 - seg(t, 600, 1250)) * clamp(seg(t, 190, 230))
  if (sk > 0 && sa > 0) {
    const rot = t / 2400
    radialWedges(ctx, x, y, 28 * u, 235 * u * sk, 14, rng(p.seed + 1), HOLY.gold, 17 * u, sa * 0.95, rot, 0.05, true)
    radialWedges(ctx, x, y, 28 * u, 150 * u * sk, 14, rng(p.seed + 2), HOLY.cream, 12 * u, sa, rot + TAU / 28, 0.05, true)
  }

  // Halo pops in.
  const hp = ease.outBack(seg(t, 190, 450), 1.8)
  if (hp > 0.02) {
    ring(ctx, x, y, 74 * u * hp, 12 * u, HOLY.gold, fade, HOLY.ink, 2.5 * u)
    ring(ctx, x, y, 74 * u * hp, 4 * u, HOLY.white, fade)
  }

  // Four-point lens star flashes at the centre.
  const star = seg(t, 190, 640)
  if (star > 0 && star < 1) {
    const s = 190 * u * ease.outCubic(Math.min(1, star * 1.8)) * (1 - ease.inCubic(star))
    shape(ctx, () => starPath(ctx, x, y, s, s * 0.09, 4, 0), HOLY.white, null, 0, 1)
    shape(ctx, () => starPath(ctx, x, y, s * 0.7, s * 0.09, 4, Math.PI / 4), HOLY.cream, null, 0, 0.9)
    shape(ctx, () => circlePath(ctx, x, y, 34 * u * (1 - star)), HOLY.white, HOLY.gold, 4 * u)
  }

  // Pulse rings.
  for (let i = 0; i < 2; i++) {
    const k = seg(t, 200 + i * 150, 900 + i * 150)
    if (k <= 0 || k >= 1) continue
    ring(ctx, x, y, 170 * u * ease.outCubic(k), lerp(14, 2, k) * u, i ? HOLY.cream : HOLY.gold, 1 - k, HOLY.ink, 1.5 * u)
  }

  // Sparkles and feathers of light drift upward.
  for (let i = 0; i < 18; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 23)
    const a = between(rn, 0, TAU)
    const d = between(rn, 24, 140) * u
    const s0 = between(rn, 220, 800)
    const k = seg(t, s0, s0 + between(rn, 600, 950))
    if (k <= 0 || k >= 1) continue
    const px = x + Math.cos(a) * d
    const py = y + Math.sin(a) * d * 0.8 - ease.outQuad(k) * 90 * u
    if (i % 3 === 0) {
      at(ctx, px, py, 0, () => shape(ctx, () => flamePath(ctx, 0, 8 * u, 18 * u, 5 * u, Math.sin(t / 150 + i) * 3 * u), HOLY.cream, HOLY.gold, 1.5 * u, 1 - k))
    } else {
      sparkle(ctx, px, py, (5 + 8 * Math.sin(k * Math.PI)) * u, t / 240 + i, HOLY.white, null, 1)
    }
  }

  // Landing flash.
  const lf = seg(t, 190, 330)
  if (lf > 0 && lf < 1) shape(ctx, () => circlePath(ctx, x, y, (40 + 100 * lf) * u), HOLY.white, null, 0, 1 - lf)
  flash(ctx, p.w, p.h, HOLY.cream, 0.34 * tri(t, 170, 420))
}

// ── Necrotic ────────────────────────────────────────────────────────────────

const NECRO = { ink: '#05020a', void: '#0e0716', purple: '#6a1fb0', violet: '#a64bff', sick: '#7dff72', bone: '#e9e4d0' }

function necrotic(ctx: Ctx, t: number, p: PointParams): void {
  const { x, y, u } = p
  const fade = 1 - seg(t, 1350, 1750)

  // Phase 1 (0–520): everything is dragged inward along spiral arms.
  const pull = seg(t, 0, 520)
  if (pull < 1) {
    const arms = 4
    const R0 = 170 * u * (1 - ease.inCubic(pull) * 0.85)
    for (let a = 0; a < arms; a++) {
      const base = (a / arms) * TAU + t / 230
      for (const [lw, col] of [[11 * u, NECRO.ink], [5.5 * u, NECRO.purple]] as [number, string][]) {
        ctx.beginPath()
        for (let s = 0; s <= 24; s++) {
          const f = s / 24
          const ang = base + f * 2.6
          const rr = R0 * (1 - f * 0.92)
          const px = x + Math.cos(ang) * rr
          const py = y + Math.sin(ang) * rr
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = col; ctx.lineWidth = lw * (1 - pull * 0.5); ctx.lineCap = 'round'; ctx.globalAlpha = clamp(seg(t, 0, 80)) * (1 - seg(t, 440, 520)); ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
    // dark motes pulled in
    for (let i = 0; i < 26; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 24)
      const a = between(rn, 0, TAU)
      const r0 = between(rn, 80, 190) * u
      const k = clamp(pull * 1.15 - i * 0.012)
      const rr = r0 * (1 - ease.inCubic(k))
      const ang = a + k * 1.6
      shape(ctx, () => circlePath(ctx, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, between(rn, 3, 7) * u * (1 - k * 0.4)), NECRO.void, NECRO.violet, 1.5 * u, 1 - k * 0.2)
    }
    ring(ctx, x, y, 165 * u * (1 - ease.inCubic(pull) * 0.9), 5 * u, NECRO.violet, 0.8 * (1 - pull), NECRO.ink, 1.5 * u)
  }

  // The void: a black disc with a violet rim that throbs when it collapses.
  const voidIn = ease.outBack(seg(t, 380, 640), 1.8)
  const voidOut = 1 - ease.inCubic(seg(t, 1300, 1750))
  if (voidIn > 0.02) {
    const pulse = 1 + 0.08 * Math.sin(t / 55)
    shape(ctx, () => blobPath(ctx, x, y, 52 * u * voidIn * pulse * voidOut, t / 200, 6, 0.1), NECRO.void, NECRO.violet, 6 * u)
    shape(ctx, () => blobPath(ctx, x, y, 17 * u * voidIn * voidOut, -t / 190, 5, 0.12), NECRO.ink, null, 0)
  }

  // Phase 2 (520–1100): the blast. Cracks, a sick-green shock ring, bone shards.
  const bk = seg(t, 520, 1100)
  if (bk > 0) {
    const ck = ease.outExpo(seg(t, 520, 800))
    for (let i = 0; i < 11; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 25)
      const a = (i / 11) * TAU + between(rn, -0.2, 0.2)
      const len = between(rn, 80, 160) * u * ck
      if (len < 2) continue
      ctx.beginPath(); ctx.moveTo(x, y)
      for (let s = 1; s <= 5; s++) {
        const f = (s / 5) * len
        const off = (rn() - 0.5) * 20 * u
        ctx.lineTo(x + Math.cos(a) * f + Math.cos(a + 1.57) * off, y + Math.sin(a) * f + Math.sin(a + 1.57) * off)
      }
      ctx.lineJoin = 'miter'; ctx.globalAlpha = fade
      ctx.strokeStyle = NECRO.ink; ctx.lineWidth = 11 * u; ctx.stroke()
      ctx.strokeStyle = NECRO.violet; ctx.lineWidth = 4.5 * u; ctx.stroke()
      ctx.globalAlpha = 1
    }
    if (bk < 0.65) {
      const k = bk / 0.65
      ring(ctx, x, y, 200 * u * ease.outExpo(k), lerp(26, 2, k) * u, '#58b84f', 0.85 * (1 - ease.inCubic(k)), NECRO.ink, 2.5 * u)
      ring(ctx, x, y, 150 * u * ease.outExpo(k), lerp(18, 1.5, k) * u, NECRO.violet, 1 - k, NECRO.ink, 1.5 * u)
    }
    // ghostly wisps: tapered curved tails streaming outward
    for (let i = 0; i < 9; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 26)
      const a = (i / 9) * TAU + between(rn, -0.3, 0.3)
      const k = seg(t, 540 + i * 18, 1350)
      if (k <= 0 || k >= 1) continue
      const d0 = 30 * u + ease.outCubic(k) * between(rn, 110, 190) * u
      const d1 = d0 + 56 * u * (1 - k * 0.4)
      const bend = (i % 2 ? 1 : -1) * 26 * u
      shape(ctx, () => slashPath(ctx, x + Math.cos(a) * d0, y + Math.sin(a) * d0, x + Math.cos(a + 0.35) * d1, y + Math.sin(a + 0.35) * d1, bend, 10 * u),
        i % 3 === 0 ? NECRO.sick : NECRO.violet, NECRO.ink, 2 * u, (1 - ease.inCubic(k)) * 0.95)
    }
    // bone shards
    for (let i = 0; i < 14; i++) {
      const rn = rng(p.seed * 131 + i * 7919 + 27)
      const a = between(rn, 0, TAU)
      const k = seg(t, 540, 540 + between(rn, 600, 900))
      if (k <= 0 || k >= 1) continue
      const d = 20 * u + drift(between(rn, 220, 480) * u, (t - 540) / 1000, 2.8)
      at(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, a + (t - 540) / 150 * (i % 2 ? 1 : -1),
        () => shape(ctx, () => kitePath(ctx, between(rn, 9, 17) * u, between(rn, 4, 7) * u, 0.45), NECRO.bone, NECRO.ink, 1.5 * u, 1 - ease.inCubic(k)))
    }
  }

  // Lingering stain.
  shape(ctx, () => blobPath(ctx, x, y, 96 * u * ease.outCubic(seg(t, 560, 900)), 0.7, 8, 0.14),
    'rgba(14,7,22,0.55)', rgba(NECRO.violet, 0.5), 2.5 * u, fade * 0.9)
  flash(ctx, p.w, p.h, NECRO.sick, 0.22 * tri(t, 500, 640))
  vignette(ctx, p.w, p.h, NECRO.void, 0.5 * tri(t, 0, 560), 0.45)
}

// ── Critical hit ────────────────────────────────────────────────────────────

const CRIT = { ink: '#1a0a0a', red: '#e0261f', gold: '#ffcf3a', white: '#ffffff' }

function crit(ctx: Ctx, t: number, p: PointParams): void {
  const { x, y, u } = p
  const tilt = between(rng(p.seed + 8), -0.16, 0.16) * 190 * u
  const ax = x + tilt, ay = y - 230 * u
  const bx = x - tilt, by = y + 230 * u

  // Hit-stop: white frame, then a dark frame crossed by converging lines.
  if (t < 50) {
    flash(ctx, p.w, p.h, '#ffffff', 1)
    return
  }
  if (t < 105) {
    flash(ctx, p.w, p.h, '#000000', 0.7)
    radialWedges(ctx, x, y, 14 * u, 420 * u, 30, rng(p.seed + 3), '#ffffff', 10 * u, 0.9, 0, 0.5, false)
  }

  // Starburst hit marker behind the slash.
  const sk = seg(t, 90, 520)
  if (sk > 0 && sk < 1) {
    const sc = ease.outBack(seg(sk, 0, 0.3), 2)
    const a = 1 - ease.inCubic(seg(sk, 0.4, 1))
    shape(ctx, () => spikePath(ctx, x, y, rng(p.seed + 5), 11, 138 * u * sc, 52 * u * sc, t / 700, 0.25), CRIT.red, CRIT.ink, 5 * u, a)
    shape(ctx, () => spikePath(ctx, x, y, rng(p.seed + 6), 9, 96 * u * sc, 40 * u * sc, -t / 600, 0.2), CRIT.gold, null, 0, a)
    shape(ctx, () => starPath(ctx, x, y, 60 * u * sc, 26 * u * sc, 8, t / 500), CRIT.white, null, 0, a)
  }

  // The slash sweeps top → bottom; its tail then catches up and erases it.
  const head = ease.outExpo(seg(t, 90, 210))
  const tail = ease.inQuad(seg(t, 210, 560))
  const sx = lerp(ax, bx, tail)
  const sy = lerp(ay, by, tail)
  const ex = lerp(ax, bx, head)
  const ey = lerp(ay, by, head)
  if (head > 0.01 && tail < 0.99) {
    const thick = 62 * u * (1 - tail * 0.45)
    shape(ctx, () => slashPath(ctx, sx, sy, ex, ey, 18 * u, thick * 1.35), CRIT.ink, null, 0)
    shape(ctx, () => slashPath(ctx, sx, sy, ex, ey, 18 * u, thick), CRIT.red, null, 0)
    shape(ctx, () => slashPath(ctx, sx, sy, ex, ey, 18 * u, thick * 0.66), CRIT.gold, null, 0)
    shape(ctx, () => slashPath(ctx, sx, sy, ex, ey, 18 * u, thick * 0.3), CRIT.white, null, 0)
  }

  // Radial speed lines and a shock ring on contact.
  const lk = seg(t, 105, 330)
  if (lk > 0 && lk < 1) radialWedges(ctx, x, y, 40 * u, 280 * u * ease.outCubic(lk), 26, rng(p.seed + 9), CRIT.white, 8 * u, 1 - lk, 0, 0.5, true)
  const rk = seg(t, 100, 520)
  if (rk > 0 && rk < 1) ring(ctx, x, y, 200 * u * ease.outExpo(rk), lerp(20, 2, rk) * u, CRIT.gold, 1 - rk, CRIT.ink, 2 * u)

  // Sparks fly off perpendicular to the cut.
  for (let i = 0; i < 18; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 28)
    const a = (i % 2 ? 0 : Math.PI) + between(rn, -0.9, 0.9)
    const k = seg(t, 110, 110 + between(rn, 380, 700))
    if (k <= 0 || k >= 1) continue
    const d = drift(between(rn, 260, 620) * u, (t - 110) / 1000, 3)
    const s = between(rn, 6, 12) * u
    at(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d + 90 * u * ((t - 110) / 1000) ** 2, a, () =>
      shape(ctx, () => kitePath(ctx, s * 2, s, 0.4), i % 3 ? CRIT.gold : CRIT.white, CRIT.ink, 1.5 * u, 1 - ease.inCubic(k)))
  }
  flash(ctx, p.w, p.h, '#ffffff', 0.25 * (1 - seg(t, 105, 260)))
  vignette(ctx, p.w, p.h, '#000', 0.4 * (1 - seg(t, 105, 520)), 0.5)
}

// ── Registry ────────────────────────────────────────────────────────────────

// Nothing draws once an effect's time is up — no invisible work, no stragglers.
function until<P>(duration: number, draw: (ctx: Ctx, t: number, p: P) => void): (ctx: Ctx, t: number, p: P) => void {
  return (ctx, t, p) => {
    if (t < 0 || t > duration) return
    draw(ctx, t, p)
  }
}

export const BURSTS = {
  fireball:     { duration: 1700, draw: until(1700, fireball) },
  frost:        { duration: 1850, draw: until(1850, frost) },
  poison:       { duration: 2850, draw: until(2850, poison) },
  heal:         { duration: 1650, draw: until(1650, heal) },
  impact:       { duration: 1050, screen: true, shake: true, draw: until(1050, impact) },
  lightning:    { duration: 900,  screen: true, shake: true, draw: until(900, lightning) },
  rage:         { duration: 1400, shake: true, draw: until(1400, rage) },
  counterspell: { duration: 950,  draw: until(950, counterspell) },
  radiant:      { duration: 1550, draw: until(1550, radiant) },
  necrotic:     { duration: 1800, draw: until(1800, necrotic) },
  crit:         { duration: 800,  shake: true, draw: until(800, crit) }
} satisfies Record<string, BurstFx>

// Silence the "unused" lint for helpers kept in the kit for the effects below.
void additive; void annulusPath; void heartPath
