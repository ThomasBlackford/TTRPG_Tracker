import { FxCanvas } from './fx/FxCanvas'
import { AMBIENT } from './fx/ambient'

// Seeds are fixed: the weather is a loop, not a one-off, so it should look the
// same every time it's switched on.
const SEED = 4242

export function RainLoop() {
  return <FxCanvas draw={(ctx, t, w, h) => AMBIENT.rain.draw(ctx, t, { w, h, u: Math.max(0.8, Math.min(2.2, w / 1300)), seed: SEED })} />
}

export function StormLoop() {
  return <FxCanvas draw={(ctx, t, w, h) => AMBIENT.stormLightning.draw(ctx, t, { w, h, u: Math.max(0.8, Math.min(2.2, w / 1300)), seed: SEED })} />
}
