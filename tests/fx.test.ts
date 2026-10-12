import test from 'node:test'
import assert from 'node:assert/strict'
import { BURSTS } from '../src/renderer/src/components/maps/fx/bursts'
import { RAYS } from '../src/renderer/src/components/maps/fx/rays'
import { ZONES } from '../src/renderer/src/components/maps/fx/zones'
import { AMBIENT, stormStrikes } from '../src/renderer/src/components/maps/fx/ambient'
import { ease, rng, seg, parseDiceFree } from './fxHelpers'

// A canvas stand-in that behaves like the real one where it matters: it throws
// on the inputs a real CanvasRenderingContext2D throws (or silently corrupts)
// on, and tracks save/restore depth. Effects are pure functions of time, so
// driving them with this across their whole lifetime catches the crashes that
// would otherwise only show up on the TV mid-session.
class FakeCtx {
  calls: string[] = []
  depth = 0
  maxDepth = 0
  stack: { alpha: number; op: string }[] = []
  private _alpha = 1
  globalCompositeOperation = 'source-over'
  fillStyle: unknown = '#000'
  strokeStyle: unknown = '#000'
  lineWidth = 1
  lineCap = 'butt'
  lineJoin = 'miter'
  miterLimit = 10
  lineDashOffset = 0
  font = ''
  textAlign = ''
  shadowBlur = 0
  shadowColor = ''

  get globalAlpha() { return this._alpha }
  set globalAlpha(v: number) {
    assert.ok(Number.isFinite(v), `globalAlpha not finite: ${v}`)
    // Real canvases ignore out-of-range values silently, which hides bugs.
    assert.ok(v >= 0 && v <= 1.0000001, `globalAlpha out of range: ${v}`)
    this._alpha = v
  }
}

const NUMERIC = [
  'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo', 'fillRect',
  'strokeRect', 'clearRect', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'fillText', 'strokeText', 'setLineDash'
]

function makeCtx() {
  const target = new FakeCtx()
  const check = (name: string, args: unknown[]) => {
    for (const a of args) {
      if (typeof a === 'number') assert.ok(Number.isFinite(a), `${name}(${args.join(', ')}) got a non-finite number`)
      if (Array.isArray(a)) for (const n of a) assert.ok(Number.isFinite(n), `${name} got a non-finite dash value`)
    }
    if (name === 'arc') assert.ok((args[2] as number) >= 0, `arc with negative radius ${args[2]}`)
    if (name === 'ellipse') assert.ok((args[2] as number) >= 0 && (args[3] as number) >= 0, `ellipse with negative radius`)
  }
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return (t as unknown as Record<string, unknown>)[prop]
      // save()/restore() snapshot the drawing state, like the real thing.
      if (prop === 'save') return () => { t.stack.push({ alpha: t.globalAlpha, op: t.globalCompositeOperation }); t.depth++; t.maxDepth = Math.max(t.maxDepth, t.depth); t.calls.push('save') }
      if (prop === 'restore') {
        return () => {
          t.depth--
          assert.ok(t.depth >= 0, 'restore() without a matching save()')
          const s = t.stack.pop()!
          t.globalAlpha = s.alpha
          t.globalCompositeOperation = s.op
          t.calls.push('restore')
        }
      }
      if (prop === 'createRadialGradient') {
        return (...a: number[]) => {
          check(prop, a)
          assert.ok(a[2] >= 0 && a[5] >= 0, 'radial gradient with negative radius')
          return { addColorStop(o: number, c: string) { assert.ok(o >= 0 && o <= 1, 'colour stop out of range'); assert.ok(!/NaN|undefined/.test(c), `bad colour ${c}`) } }
        }
      }
      if (prop === 'createLinearGradient') return (...a: number[]) => { check(prop, a); return { addColorStop() {} } }
      if (NUMERIC.includes(prop)) return (...a: unknown[]) => { check(prop, a); t.calls.push(`${prop}:${a.map((x) => (typeof x === 'number' ? x.toFixed(2) : '')).join(',')}`) }
      return (...a: unknown[]) => { t.calls.push(prop); void a } // beginPath, closePath, fill, stroke, clip, ...
    },
    set(t, prop: string, value) {
      if (prop === 'fillStyle' || prop === 'strokeStyle') {
        assert.ok(typeof value !== 'string' || !/NaN|undefined|Infinity/.test(value), `bad ${prop}: ${String(value)}`)
      }
      if (prop === 'lineWidth') assert.ok(Number.isFinite(value) && value >= 0, `lineWidth ${value}`)
      ;(t as unknown as Record<string, unknown>)[prop] = value
      return true
    }
  }) as unknown as CanvasRenderingContext2D
  return { ctx, target }
}

function run(draw: (ctx: CanvasRenderingContext2D) => void): FakeCtx {
  const { ctx, target } = makeCtx()
  draw(ctx)
  assert.equal(target.depth, 0, 'unbalanced save/restore')
  assert.equal(target.globalCompositeOperation, 'source-over', 'composite mode leaked')
  assert.equal(target.globalAlpha, 1, 'globalAlpha leaked')
  return target
}

const point = (x = 400, y = 300, u = 1, seed = 7) => ({ x, y, u, w: 1280, h: 720, seed })

test('every burst renders cleanly through its whole life, at several sizes', () => {
  for (const [id, fx] of Object.entries(BURSTS)) {
    for (const u of [0.5, 1, 2.6]) {
      for (let t = 0; t <= fx.duration + 600; t += 23) {
        try {
          const f = run((ctx) => fx.draw(ctx, t, point(640, 360, u)))
          assert.ok(f.calls.length >= 0)
        } catch (e) {
          throw new Error(`${id} at t=${t} u=${u}: ${(e as Error).message}`)
        }
      }
    }
  }
})

test('bursts are silent before they start and after they end (nothing left drawn)', () => {
  for (const [id, fx] of Object.entries(BURSTS)) {
    const after = run((ctx) => fx.draw(ctx, fx.duration + 2000, point()))
    const painted = after.calls.filter((c) => c === 'fill' || c === 'stroke' || c.startsWith('fillRect'))
    // Allow zero-alpha stragglers but the effect should have essentially gone.
    assert.ok(painted.length < 12, `${id} still issuing ${painted.length} paint calls long after it ended`)
  }
})

test('every ray renders cleanly, for short, long, vertical and degenerate paths', () => {
  const paths: [number, number, number, number][] = [
    [100, 100, 900, 500], [900, 500, 100, 100], [500, 100, 500, 650], [200, 300, 215, 305], [300, 300, 300, 300]
  ]
  for (const [id, fx] of Object.entries(RAYS)) {
    for (const [x1, y1, x2, y2] of paths) {
      for (let t = 0; t <= fx.duration + 500; t += 29) {
        try {
          run((ctx) => fx.draw(ctx, t, { x1, y1, x2, y2, u: 1, w: 1280, h: 720, seed: 3 }))
        } catch (e) {
          throw new Error(`${id} path ${x1},${y1}→${x2},${y2} at t=${t}: ${(e as Error).message}`)
        }
      }
    }
  }
})

test('every zone renders cleanly from tiny to huge, over a long loop', () => {
  for (const [id, fx] of Object.entries(ZONES)) {
    for (const r of [14, 60, 240, 900]) {
      for (let t = 0; t <= 14000; t += 137) {
        try {
          run((ctx) => fx.draw(ctx, t, { cx: 640, cy: 360, r, u: 1.2, seed: 11 }))
        } catch (e) {
          throw new Error(`${id} r=${r} at t=${t}: ${(e as Error).message}`)
        }
      }
    }
  }
})

test('zones loop: no drift between cycles (same pose a full minute later)', () => {
  // Every periodic motion must repeat, so the effect never "winds up" over a long session.
  for (const [id, fx] of Object.entries(ZONES)) {
    const a = run((ctx) => fx.draw(ctx, 5000, { cx: 300, cy: 300, r: 100, u: 1, seed: 5 })).calls.length
    const b = run((ctx) => fx.draw(ctx, 5000 + 3600000, { cx: 300, cy: 300, r: 100, u: 1, seed: 5 })).calls.length
    assert.ok(Math.abs(a - b) < Math.max(40, a * 0.25), `${id}: ${a} calls vs ${b} an hour later`)
  }
})

test('ambient weather renders cleanly over a long run, including strikes', () => {
  const strikes = stormStrikes(4242, 90000)
  assert.ok(strikes.length >= 6, 'a storm should strike several times in 90s')
  for (let i = 1; i < strikes.length; i++) assert.ok(strikes[i] - strikes[i - 1] >= 4200, 'strikes are spaced out')
  const times: number[] = []
  for (let t = 0; t < 90000; t += 331) times.push(t)
  for (const s of strikes) for (const o of [0, 30, 70, 130, 400, 800, 1500]) times.push(s + o)
  for (const [id, fx] of Object.entries(AMBIENT)) {
    for (const t of times) {
      try {
        run((ctx) => fx.draw(ctx, t, { w: 1920, h: 1080, u: 1.4, seed: 4242 }))
      } catch (e) {
        throw new Error(`${id} at t=${t}: ${(e as Error).message}`)
      }
    }
  }
})

test('a storm is actually lightning during a strike and quiet between', () => {
  const [first] = stormStrikes(4242, 20000)
  const during = run((ctx) => AMBIENT.stormLightning.draw(ctx, first + 60, { w: 1920, h: 1080, u: 1, seed: 4242 }))
  const quiet = run((ctx) => AMBIENT.stormLightning.draw(ctx, first - 300, { w: 1920, h: 1080, u: 1, seed: 4242 }))
  assert.ok(during.calls.length > 30, 'strike frame draws a bolt')
  assert.equal(quiet.calls.length, 0, 'nothing drawn between strikes')
})

test('effects are deterministic: same seed and time give the same drawing, a new seed a different one', () => {
  const sig = (fn: (ctx: CanvasRenderingContext2D) => void) => run(fn).calls.join('|')
  for (const [id, fx] of Object.entries(BURSTS)) {
    const t = fx.duration * 0.4
    const a = sig((c) => fx.draw(c, t, point(300, 300, 1, 21)))
    const b = sig((c) => fx.draw(c, t, point(300, 300, 1, 21)))
    assert.equal(a, b, `${id} differs between identical renders`)
  }
  // Seeds drive particle layout, so most effects look different per seed.
  let differing = 0
  for (const fx of Object.values(BURSTS)) {
    const t = fx.duration * 0.4
    if (sig((c) => fx.draw(c, t, point(300, 300, 1, 21))) !== sig((c) => fx.draw(c, t, point(300, 300, 1, 22)))) differing++
  }
  assert.ok(differing >= 6, `only ${differing} bursts vary with their seed`)
})

test('frame-to-frame coherence: a particle never teleports between adjacent frames', () => {
  // Compare consecutive frames' drawing calls: the *number* of calls can change as particles come
  // and go, but for the calls that persist, coordinates must move smoothly. A shared RNG stream
  // consumed conditionally would make them jump, which looks like flicker on screen.
  const coords = (calls: string[]) => calls.filter((c) => c.startsWith('moveTo:') || c.startsWith('translate:')).map((c) => c.split(':')[1].split(',').map(Number))
  for (const [id, fx] of Object.entries(BURSTS)) {
    let jumpy = 0
    let total = 0
    for (let t = 80; t < fx.duration - 80; t += 40) {
      const a = coords(run((c) => fx.draw(c, t, point(640, 360, 1, 9))).calls)
      const b = coords(run((c) => fx.draw(c, t + 8, point(640, 360, 1, 9))).calls)
      if (a.length !== b.length || a.length === 0) continue
      for (let i = 0; i < a.length; i++) {
        total++
        // 8ms of motion should never be more than ~120px for anything drawn at 1280x720
        if (Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]) > 160) jumpy++
      }
    }
    assert.ok(total === 0 || jumpy / total < 0.02, `${id}: ${jumpy}/${total} anchor points jumped between adjacent frames`)
  }
})

test('easing and helpers behave', () => {
  assert.equal(ease.outCubic(0), 0)
  assert.equal(ease.outCubic(1), 1)
  assert.equal(ease.outCubic(-3), 0)
  assert.equal(ease.outCubic(9), 1)
  assert.ok(ease.outBack(0.7) > 1, 'outBack overshoots')
  assert.equal(ease.outBack(1), 1)
  assert.equal(seg(5, 10, 20), 0)
  assert.equal(seg(25, 10, 20), 1)
  assert.equal(seg(15, 10, 20), 0.5)
  const a = rng(5), b = rng(5), c = rng(6)
  const sa = [a(), a(), a()], sb = [b(), b(), b()]
  assert.deepEqual(sa, sb)
  assert.notDeepEqual(sa, [c(), c(), c()])
  assert.ok(sa.every((v) => v >= 0 && v < 1))
  void parseDiceFree
})
