// A small toolkit for stylized, flat-shaded VFX: hard-edged shapes with ink
// outlines, snappy easing, shockwave rings, shards, sparkles, starbursts,
// slashes and rune circles. Everything here is a pure function of its inputs
// (and a seeded RNG) so an effect can be rendered at any timestamp — which is
// what lets the preview sheet and the tests scrub through effects frame by frame.

export type Ctx = CanvasRenderingContext2D
export const TAU = Math.PI * 2

// ── Maths ───────────────────────────────────────────────────────────────────

export const clamp = (v: number, a = 0, b = 1): number => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
// 0→1 progress of t through [a, b], clamped outside.
export const seg = (t: number, a: number, b: number): number => clamp((t - a) / (b - a))
// 0→1→0 triangle across [a, b].
export const tri = (t: number, a: number, b: number): number => {
  const p = seg(t, a, b)
  return p < 0.5 ? p * 2 : (1 - p) * 2
}

export const ease = {
  outQuad: (t: number) => 1 - (1 - clamp(t)) ** 2,
  outCubic: (t: number) => 1 - (1 - clamp(t)) ** 3,
  outQuart: (t: number) => 1 - (1 - clamp(t)) ** 4,
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * clamp(t))),
  inCubic: (t: number) => clamp(t) ** 3,
  inQuad: (t: number) => clamp(t) ** 2,
  inOutCubic: (t: number) => {
    const x = clamp(t)
    return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2
  },
  // Overshoots then settles — the classic "pop" for icons and stamps.
  outBack: (t: number, s = 1.70158) => {
    const x = clamp(t) - 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2
  },
  outElastic: (t: number) => {
    const x = clamp(t)
    if (x === 0 || x === 1) return x
    return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
  }
}

// Seeded RNG (mulberry32) so an effect looks identical wherever it's rendered.
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const between = (r: () => number, a: number, b: number): number => a + r() * (b - a)

// ── Colour ──────────────────────────────────────────────────────────────────

const rgbCache = new Map<string, [number, number, number]>()
export function toRgb(hex: string): [number, number, number] {
  let c = rgbCache.get(hex)
  if (!c) {
    const h = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
    c = [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
    rgbCache.set(hex, c)
  }
  return c
}

export function rgba(hex: string, a = 1): string {
  const [r, g, b] = toRgb(hex)
  return `rgba(${r},${g},${b},${clamp(a).toFixed(3)})`
}

export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a)
  const y = toRgb(b)
  const k = clamp(t)
  return `rgb(${Math.round(lerp(x[0], y[0], k))},${Math.round(lerp(x[1], y[1], k))},${Math.round(lerp(x[2], y[2], k))})`
}

// ── Path helpers (build a path; caller fills/strokes) ──────────────────────

// Radii are clamped so a shrinking shape can never throw an IndexSizeError.
export function circlePath(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.moveTo(x + Math.max(0, r), y)
  ctx.arc(x, y, Math.max(0, r), 0, TAU)
}

// Wobbly circle — the "cartoon fire / goo" silhouette.
export function blobPath(ctx: Ctx, x: number, y: number, r: number, phase: number, lobes = 5, amp = 0.12, steps = 56): void {
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU
    const rr = Math.max(0, r * (1 + amp * Math.sin(lobes * a + phase) + amp * 0.55 * Math.sin((lobes * 2 + 1) * a - phase * 1.7)))
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

export function starPath(ctx: Ctx, x: number, y: number, outer: number, inner: number, points: number, rot = 0): void {
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = rot + (i / (points * 2)) * TAU
    const px = x + Math.cos(a) * Math.max(0, r)
    const py = y + Math.sin(a) * Math.max(0, r)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

// Irregular star: every spike a different length — shards, rage spikes, frost.
export function spikePath(ctx: Ctx, x: number, y: number, r: () => number, count: number, outer: number, inner: number, rot = 0, jitter = 0.4): void {
  for (let i = 0; i < count * 2; i++) {
    const isTip = i % 2 === 0
    const rr = (isTip ? outer * (1 - jitter * r()) : inner * (1 + jitter * 0.5 * r()))
    const a = rot + (i / (count * 2)) * TAU
    const px = x + Math.cos(a) * Math.max(0, rr)
    const py = y + Math.sin(a) * Math.max(0, rr)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

// Teardrop flame pointing up from (x, y), tip swayed sideways by `sway`.
export function flamePath(ctx: Ctx, x: number, y: number, h: number, w: number, sway: number): void {
  ctx.moveTo(x, y)
  ctx.bezierCurveTo(x + w, y, x + w * 0.95, y - h * 0.5, x + sway, y - h)
  ctx.bezierCurveTo(x - w * 0.95, y - h * 0.5, x - w, y, x, y)
  ctx.closePath()
}

// Elongated kite pointing along +x from the origin: crystals, blades, debris.
export function kitePath(ctx: Ctx, len: number, width: number, shoulder = 0.3): void {
  ctx.moveTo(0, 0)
  ctx.lineTo(len * shoulder, -width / 2)
  ctx.lineTo(len, 0)
  ctx.lineTo(len * shoulder, width / 2)
  ctx.closePath()
}

// Upper half of a kite — drawn lighter to fake a lit facet.
export function kiteFacetPath(ctx: Ctx, len: number, width: number, shoulder = 0.3): void {
  ctx.moveTo(0, 0)
  ctx.lineTo(len * shoulder, -width / 2)
  ctx.lineTo(len, 0)
  ctx.closePath()
}

// A tapered, curved slash from a to b: thickest at the middle, pointed at
// both ends. `bend` pushes the curve sideways (signed, in px).
export function slashPath(ctx: Ctx, ax: number, ay: number, bx: number, by: number, bend: number, thick: number): void {
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  ctx.moveTo(ax, ay)
  ctx.quadraticCurveTo(mx + nx * (bend + thick), my + ny * (bend + thick), bx, by)
  ctx.quadraticCurveTo(mx + nx * (bend - thick * 0.15), my + ny * (bend - thick * 0.15), ax, ay)
  ctx.closePath()
}

export function heartPath(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.moveTo(x, y + s * 0.9)
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4)
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.5, y - s * 0.1, x, y + s * 0.9)
  ctx.closePath()
}

// Closed annulus for fill with "evenodd".
export function annulusPath(ctx: Ctx, x: number, y: number, r: number, thick: number): void {
  const o = Math.max(0, r + thick / 2)
  const i = Math.max(0, r - thick / 2)
  ctx.moveTo(x + o, y)
  ctx.arc(x, y, o, 0, TAU)
  ctx.moveTo(x + i, y)
  ctx.arc(x, y, i, 0, TAU, true)
}

// ── Painters ────────────────────────────────────────────────────────────────

// Fill the current path, then ink it. Join/cap are round so it reads as a
// drawn outline, not a CAD one.
export function paint(ctx: Ctx, fill: string | null, stroke: string | null, lw = 2): void {
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke && lw > 0) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

export function shape(ctx: Ctx, build: () => void, fill: string | null, stroke: string | null, lw = 2, alpha = 1): void {
  if (alpha <= 0.003) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  ctx.beginPath()
  build()
  paint(ctx, fill, stroke, lw)
  ctx.globalAlpha = prev
}

export function at(ctx: Ctx, x: number, y: number, rot: number, draw: () => void, scale = 1): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  if (scale !== 1) ctx.scale(scale, scale)
  draw()
  ctx.restore()
}

// A flat ring (shockwave). Optionally inked on both edges.
export function ring(ctx: Ctx, x: number, y: number, r: number, thick: number, fill: string, alpha = 1, ink: string | null = null, inkW = 2): void {
  if (alpha <= 0.003 || thick <= 0.1) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  ctx.beginPath()
  annulusPath(ctx, x, y, r, thick)
  ctx.fillStyle = fill
  ctx.fill('evenodd')
  if (ink) {
    ctx.strokeStyle = ink
    ctx.lineWidth = inkW
    ctx.stroke()
  }
  ctx.globalAlpha = prev
}

// A group of circles drawn as one silhouette with a single outer outline —
// the cel-shaded cloud / smoke / goo look. Outline is drawn first at full
// thickness, then the fill covers its inner half.
export function puffCluster(
  ctx: Ctx,
  circles: { x: number; y: number; r: number }[],
  fill: string,
  ink: string,
  inkW: number,
  alpha = 1
): void {
  if (alpha <= 0.003) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  ctx.beginPath()
  for (const c of circles) circlePath(ctx, c.x, c.y, c.r)
  ctx.strokeStyle = ink
  ctx.lineWidth = inkW * 2
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.globalAlpha = prev
}

export function sparkle(ctx: Ctx, x: number, y: number, r: number, rot: number, fill: string, ink: string | null = null, alpha = 1): void {
  shape(ctx, () => starPath(ctx, x, y, r, r * 0.2, 4, rot), fill, ink, ink ? Math.max(1, r * 0.12) : 0, alpha)
}

// Tapered wedges radiating from a centre — speed lines / sunbursts / "focus".
export function radialWedges(
  ctx: Ctx, x: number, y: number, r0: number, r1: number, count: number,
  rand: () => number, fill: string, baseW: number, alpha = 1, rot = 0, lenJitter = 0.5, tipOut = true
): void {
  if (alpha <= 0.003) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  ctx.fillStyle = fill
  for (let i = 0; i < count; i++) {
    const a = rot + (i / count) * TAU + (rand() - 0.5) * (TAU / count) * 0.6
    const len = r0 + (r1 - r0) * (1 - lenJitter * rand())
    const cs = Math.cos(a)
    const sn = Math.sin(a)
    const w = baseW * (0.5 + rand())
    ctx.beginPath()
    if (tipOut) {
      // wide near the centre, pointed at the far end
      ctx.moveTo(x + cs * r0 - sn * w, y + sn * r0 + cs * w)
      ctx.lineTo(x + cs * len, y + sn * len)
      ctx.lineTo(x + cs * r0 + sn * w, y + sn * r0 - cs * w)
    } else {
      // pointed near the centre, wide at the far end (classic speed lines)
      ctx.moveTo(x + cs * r0, y + sn * r0)
      ctx.lineTo(x + cs * len - sn * w, y + sn * len + cs * w)
      ctx.lineTo(x + cs * len + sn * w, y + sn * len - cs * w)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = prev
}

// Jagged lightning polyline from (x0,y0) to (x1,y1): sharp zig-zags that
// get tighter toward the ends.
export function boltPoints(rand: () => number, x0: number, y0: number, x1: number, y1: number, segs: number, jitter: number): [number, number][] {
  const pts: [number, number][] = [[x0, y0]]
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const env = Math.sin(t * Math.PI) // calm at the ends
    const off = (rand() - 0.5) * 2 * jitter * (0.35 + env)
    pts.push([x0 + dx * t + nx * off, y0 + dy * t + ny * off])
  }
  pts.push([x1, y1])
  return pts
}

// Layered bolt: ink outline, colour body, hot core. Sharp mitred joins.
export function drawBolt(
  ctx: Ctx, pts: [number, number][], width: number, colors: { ink: string; body: string; core: string }, alpha = 1
): void {
  if (pts.length < 2 || alpha <= 0.003) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  ctx.lineJoin = 'miter'
  ctx.miterLimit = 3
  ctx.lineCap = 'round'
  const pass = (w: number, c: string) => {
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.strokeStyle = c
    ctx.lineWidth = w
    ctx.stroke()
  }
  pass(width * 2.4, colors.ink)
  pass(width * 1.4, colors.body)
  pass(width * 0.55, colors.core)
  ctx.globalAlpha = prev
}

// A rune circle: double ring, tick marks, and procedurally generated glyphs
// (chevrons, bars, dots, triangles) — reads as "magic" without using fonts.
export function runeRing(
  ctx: Ctx, x: number, y: number, r: number, rot: number, color: string, alpha: number,
  opts: { glyphs?: number; width?: number; seed?: number; fill?: string | null; ink?: string | null } = {}
): void {
  if (alpha <= 0.003 || r < 2) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  const lw = opts.width ?? Math.max(1.5, r * 0.025)
  const glyphs = opts.glyphs ?? 12
  const rand = rng(opts.seed ?? 7)

  if (opts.fill) {
    ctx.beginPath(); circlePath(ctx, x, y, r)
    ctx.fillStyle = opts.fill
    ctx.fill()
  }
  const strokeCircle = (rr: number, w: number, col: string) => {
    ctx.beginPath(); circlePath(ctx, x, y, rr)
    ctx.strokeStyle = col
    ctx.lineWidth = w
    ctx.stroke()
  }
  if (opts.ink) {
    strokeCircle(r, lw * 3, opts.ink)
    strokeCircle(r * 0.78, lw * 3, opts.ink)
  }
  strokeCircle(r, lw, color)
  strokeCircle(r * 0.78, lw, color)

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 0; i < glyphs; i++) {
    const a = rot + (i / glyphs) * TAU
    const cs = Math.cos(a)
    const sn = Math.sin(a)
    const gr = r * 0.89
    const kind = Math.floor(rand() * 4)
    const s = r * 0.055
    ctx.save()
    ctx.translate(x + cs * gr, y + sn * gr)
    ctx.rotate(a + Math.PI / 2)
    ctx.beginPath()
    if (kind === 0) { // chevron
      ctx.moveTo(-s, s * 0.6); ctx.lineTo(0, -s * 0.8); ctx.lineTo(s, s * 0.6)
      ctx.stroke()
    } else if (kind === 1) { // bar + dot
      ctx.moveTo(0, -s); ctx.lineTo(0, s * 0.4); ctx.stroke()
      ctx.beginPath(); circlePath(ctx, 0, s * 0.95, lw * 0.9); ctx.fill()
    } else if (kind === 2) { // triangle
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.9, s * 0.7); ctx.lineTo(-s * 0.9, s * 0.7); ctx.closePath()
      ctx.stroke()
    } else { // cross
      ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.8, 0); ctx.moveTo(0, -s * 0.8); ctx.lineTo(0, s * 0.8)
      ctx.stroke()
    }
    ctx.restore()
  }
  // Fine tick ring just inside the glyph band.
  const ticks = glyphs * 4
  ctx.beginPath()
  for (let i = 0; i < ticks; i++) {
    const a = -rot * 0.5 + (i / ticks) * TAU
    ctx.moveTo(x + Math.cos(a) * r * 0.71, y + Math.sin(a) * r * 0.71)
    ctx.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75)
  }
  ctx.lineWidth = Math.max(1, lw * 0.6)
  ctx.stroke()
  ctx.globalAlpha = prev
}

// Full-canvas colour flash (the "impact frame"): hard-edged, no gradients.
export function flash(ctx: Ctx, w: number, h: number, color: string, alpha: number): void {
  if (alpha <= 0.003) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  ctx.fillStyle = color
  ctx.fillRect(-10, -10, w + 20, h + 20)
  ctx.globalAlpha = prev
}

// Hard-edged radial vignette made of two discs' worth of darkness: cheap and
// reads as a drawn frame instead of a soft photographic one.
export function vignette(ctx: Ctx, w: number, h: number, color: string, alpha: number, inner = 0.55): void {
  if (alpha <= 0.003) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * clamp(alpha)
  const cx = w / 2
  const cy = h / 2
  const rMax = Math.hypot(cx, cy)
  const g = ctx.createRadialGradient(cx, cy, rMax * inner, cx, cy, rMax)
  g.addColorStop(0, rgba(color, 0))
  g.addColorStop(1, rgba(color, 1))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = prev
}

// 'lighter' (additive) block, restored afterwards.
export function additive(ctx: Ctx, draw: () => void): void {
  const prev = ctx.globalCompositeOperation
  ctx.globalCompositeOperation = 'lighter'
  draw()
  ctx.globalCompositeOperation = prev
}

// ── Effect contracts ───────────────────────────────────────────────────────

export interface PointParams {
  x: number
  y: number
  u: number // size unit: ~1 on a normal map, scales with zoom
  w: number // canvas size in css px (screen effects use these)
  h: number
  seed: number
}

export interface RayParams {
  x1: number
  y1: number
  x2: number
  y2: number
  u: number
  w: number
  h: number
  seed: number
}

export interface ZoneParams {
  cx: number
  cy: number
  r: number
  u: number
  seed: number
}

export interface AmbientParams {
  w: number
  h: number
  u: number
  seed: number
}
