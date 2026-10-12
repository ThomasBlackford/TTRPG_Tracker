import { TAU, between, ease, flash, ring, rng, seg } from './kit'
import type { AmbientParams, Ctx } from './kit'
import { BURSTS } from './bursts'

// Looping weather layers. Like zones, every motion is periodic so they run
// forever with no state and no reset "pop".

export interface AmbientFx {
  draw: (ctx: Ctx, t: number, p: AmbientParams) => void
}

const RAIN = { streak: '#cfe3ff', far: '#8fa8d6', splash: '#e6f1ff', tint: '#0c1630' }

function rain(ctx: Ctx, t: number, p: AmbientParams): void {
  const { w, h, u } = p

  // A cool, heavy sky tint — flat, not a gradient.
  flash(ctx, w, h, RAIN.tint, 0.2)

  // Two depths of streaks: faint thin ones far away, bolder fast ones near.
  const layers = [
    { count: 120, len: 22, width: 1.6, speed: 1.0, alpha: 0.38, color: RAIN.far },
    { count: 90, len: 38, width: 2.8, speed: 1.45, alpha: 0.7, color: RAIN.streak }
  ]
  const slant = 0.2
  layers.forEach((L, li) => {
    ctx.fillStyle = L.color
    ctx.globalAlpha = L.alpha
    for (let i = 0; i < L.count; i++) {
      const rn = rng(p.seed * 131 + li * 100003 + i * 7919)
      const x0 = rn() * (w + 120) - 60
      const fall = (900 + rn() * 500) / L.speed
      const k = ((t + rn() * 6000) % fall) / fall
      const y = -60 + k * (h + 120)
      const x = x0 + k * (h + 120) * slant
      const len = L.len * u * (0.7 + rn() * 0.6)
      const wd = L.width * u
      // a tapered wedge slanted with the wind: thick at the head, pointed tail
      const dx = Math.sin(Math.atan(slant)) * len
      const dy = Math.cos(Math.atan(slant)) * len
      ctx.beginPath()
      ctx.moveTo(x - wd / 2, y)
      ctx.lineTo(x + wd / 2, y)
      ctx.lineTo(x - dx, y - dy)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1
  })

  // Splash marks on the ground: tiny rings with a pair of droplets.
  for (let i = 0; i < 34; i++) {
    const rn = rng(p.seed * 131 + i * 7919 + 77)
    const x = rn() * w
    const y = rn() * h
    const period = 700 + rn() * 900
    const k = ((t + rn() * 3000) % period) / period
    if (k > 0.4) continue
    const sk = k / 0.4
    ring(ctx, x, y, (2 + 7 * ease.outCubic(sk)) * u, Math.max(0.7, (1.8 - sk * 1.1) * u), RAIN.splash, (1 - sk) * 0.55)
    if (sk < 0.7) {
      ctx.fillStyle = RAIN.splash
      ctx.globalAlpha = (1 - sk) * 0.7
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(x + side * (3 + 6 * sk) * u, y - Math.sin(sk * Math.PI) * 7 * u, 1.3 * u, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
  }
}

// When the storm's strikes begin, in ms from the start — deterministic, so it
// can be replayed at any timestamp without keeping state.
export function stormStrikes(seed: number, until: number): number[] {
  const R = rng(seed + 5)
  const out: number[] = []
  let at = between(R, 700, 2200)
  let guard = 0
  while (at < until && guard++ < 2000) {
    out.push(at)
    at += between(R, 4200, 11000)
  }
  return out
}

function storm(ctx: Ctx, t: number, p: AmbientParams): void {
  const { w, h, u } = p
  const life = BURSTS.lightning.duration
  const strikes = stormStrikes(p.seed, t + 1)
  const last = strikes.length ? strikes[strikes.length - 1] : -1
  if (last >= 0 && t - last < life) {
    ctx.save()
    ctx.globalAlpha = 0.85 // ambient weather, not a spell: keep the strobe a bit gentler
    BURSTS.lightning.draw(ctx, t - last, { x: 0, y: 0, u, w, h, seed: Math.floor(last) })
    ctx.restore()
  }
  // The sky stays a touch darker for a moment after a strike.
  const since = t - last
  if (last >= 0 && since < 2400) flash(ctx, w, h, '#050a1e', 0.2 * (1 - seg(since, 0, 2400)))
}

export const AMBIENT = {
  rain: { draw: rain },
  stormLightning: { draw: storm }
} satisfies Record<string, AmbientFx>
