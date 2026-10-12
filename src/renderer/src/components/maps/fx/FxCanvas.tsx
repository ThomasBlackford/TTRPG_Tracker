import { useEffect, useRef } from 'react'
import type { Ctx } from './kit'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  // Draws one frame. Coordinates are always window-space css pixels, whatever
  // the canvas' own size — so the same effect code works full-screen or boxed.
  draw: (ctx: Ctx, elapsedMs: number, w: number, h: number) => void
  // Limit the canvas to a region. Lingering zones use this: sixteen
  // full-window canvases would be a lot to repaint every frame.
  box?: Box
  className?: string
}

const MAX_DPR = 2

// One rAF-driven canvas. The frame is a pure function of elapsed time, so it's
// frame-rate independent and immune to dropped frames, and it renders at the
// display's pixel density so edges stay crisp on a 4K TV.
export function FxCanvas({ draw, box, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  // The effect clock outlives re-renders and box changes, so panning or zooming
  // never replays an effect's intro.
  const startRef = useRef(performance.now())
  drawRef.current = draw
  const boxRef = useRef(box)
  boxRef.current = box
  // Re-run the effect only when the box meaningfully changes.
  const boxKey = box ? `${Math.round(box.x)}|${Math.round(box.y)}|${Math.round(box.w)}|${Math.round(box.h)}` : 'full'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const start = startRef.current
    const baseDpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
    let dpr = baseDpr

    function size() {
      const b = boxRef.current
      const cw = b ? Math.max(1, Math.ceil(b.w)) : window.innerWidth
      const ch = b ? Math.max(1, Math.ceil(b.h)) : window.innerHeight
      // A very large zone shouldn't allocate a gigantic bitmap: cap the pixel count.
      dpr = Math.min(baseDpr, Math.sqrt(16_000_000 / (cw * ch)))
      canvas!.width = Math.ceil(cw * dpr)
      canvas!.height = Math.ceil(ch * dpr)
      canvas!.style.width = `${cw}px`
      canvas!.style.height = `${ch}px`
      canvas!.style.left = `${b ? Math.round(b.x) : 0}px`
      canvas!.style.top = `${b ? Math.round(b.y) : 0}px`
    }
    size()
    window.addEventListener('resize', size)

    function frame(now: number) {
      const b = boxRef.current
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.clearRect(0, 0, canvas!.width / dpr, canvas!.height / dpr)
      if (b) ctx!.translate(-Math.round(b.x), -Math.round(b.y))
      ctx!.globalAlpha = 1
      ctx!.globalCompositeOperation = 'source-over'
      try {
        drawRef.current(ctx!, now - start, window.innerWidth, window.innerHeight)
      } catch (e) {
        // One bad frame must never take the whole presentation window down.
        console.error('[fx] draw failed:', e)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
    }
  }, [boxKey])

  // Positioning is inline (not a utility class): the canvas' placement is part of its correctness.
  return <canvas ref={canvasRef} className={className} style={{ position: 'absolute', pointerEvents: 'none', left: 0, top: 0 }} />
}
