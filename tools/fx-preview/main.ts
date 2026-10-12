// Effect preview sheet (dev tool):  npm run fx:preview
//
// Renders any effect at several timestamps so it can be judged as still frames,
// over a stone-ish map background with a grid so scale and contrast are honest.
//
//   ?kind=bursts|rays|zones|ambient   which family (default bursts)
//   ?id=fireball,frost                only these effects
//   ?t=0.1,0.3,0.6                    timestamps as fractions of the effect's duration
//                                     (zones: of 3.2s; storm: around its first strike)
//   ?w=330&h=290&u=0.7&cols=3         cell size, size unit and columns
import { BURSTS } from '../../src/renderer/src/components/maps/fx/bursts'
import { RAYS } from '../../src/renderer/src/components/maps/fx/rays'
import { ZONES } from '../../src/renderer/src/components/maps/fx/zones'
import { AMBIENT, stormStrikes } from '../../src/renderer/src/components/maps/fx/ambient'

const q = new URLSearchParams(location.search)
const kind = q.get('kind') ?? 'bursts'
const only = q.get('id')?.split(',') ?? null
const cols = Number(q.get('cols') ?? 5)
const W = Number(q.get('w') ?? 200)
const H = Number(q.get('h') ?? 170)
const U = Number(q.get('u') ?? 0.42)
const frames = (q.get('t') ?? '0.04,0.12,0.22,0.35,0.5,0.62,0.75,0.88,0.96,1.0').split(',').map(Number)
const out = document.getElementById('out')!
const dpr = 2

function cell(label: string, draw: (ctx: CanvasRenderingContext2D) => void): HTMLElement {
  const div = document.createElement('div')
  div.className = 'cell'
  const c = document.createElement('canvas')
  c.width = W * dpr; c.height = H * dpr
  c.style.width = `${W}px`; c.style.height = `${H}px`
  const ctx = c.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // a stone-ish map background with a grid so scale and contrast are judged honestly
  ctx.fillStyle = '#4a443c'; ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1
  for (let x = 0; x < W; x += 21) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 21) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  draw(ctx)
  div.appendChild(c)
  const s = document.createElement('span'); s.textContent = label; div.appendChild(s)
  return div
}

function section(title: string, cells: HTMLElement[]) {
  const h = document.createElement('h3'); h.textContent = title; out.appendChild(h)
  const row = document.createElement('div'); row.className = 'row'
  row.style.width = `${(W + 2) * cols}px`
  cells.forEach((c) => row.appendChild(c))
  out.appendChild(row)
}

;(window as unknown as { __ready: boolean }).__ready = false
async function main() {
  if (kind === 'bursts') {
    for (const [id, fx] of Object.entries(BURSTS)) {
      if (only && !only.includes(id)) continue
      section(`${id} (${fx.duration}ms)`, frames.map((f) => {
        const t = f * fx.duration
        return cell(`${Math.round(t)}ms`, (ctx) => fx.draw(ctx, t, { x: W / 2, y: H / 2, u: U, w: W, h: H, seed: 1234 }))
      }))
    }
  }
  if (kind === 'rays') {
    for (const [id, fx] of Object.entries(RAYS)) {
      if (only && !only.includes(id)) continue
      section(`${id} (${fx.duration}ms)`, frames.map((f) => {
        const t = f * fx.duration
        return cell(`${Math.round(t)}ms`, (ctx) => fx.draw(ctx, t, { x1: W * 0.14, y1: H * 0.64, x2: W * 0.84, y2: H * 0.36, u: U, w: W, h: H, seed: 99 }))
      }))
    }
  }
  if (kind === 'zones') {
    const span = Number(q.get('span') ?? 3200)
    for (const [id, fx] of Object.entries(ZONES)) {
      if (only && !only.includes(id)) continue
      section(`${id} (loops)`, frames.map((f) => {
        const t = f * span
        return cell(`${Math.round(t)}ms`, (ctx) => fx.draw(ctx, t, { cx: W / 2, cy: H / 2, r: Math.min(W, H) * 0.4, u: U, seed: 55 }))
      }))
    }
  }
  if (kind === 'ambient') {
    for (const [id, fx] of Object.entries(AMBIENT)) {
      if (only && !only.includes(id)) continue
      const first = stormStrikes(4242, 20000)[0]
      const offs = [0.01, 0.07, 0.12, 0.2, 0.4, 0.8]
      const times = id === 'stormLightning' ? offs.map((o) => first + o * 900) : frames.map((f) => f * 3000)
      section(id, times.map((t) => cell(`${Math.round(t)}ms`, (ctx) => fx.draw(ctx, t, { w: W, h: H, u: U, seed: 4242 }))))
    }
  }
  ;(window as unknown as { __ready: boolean }).__ready = true
}
main()
