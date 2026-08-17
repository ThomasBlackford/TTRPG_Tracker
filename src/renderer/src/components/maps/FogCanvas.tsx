import { useRef, useEffect, useCallback } from 'react'
import type { FogState } from '../../types'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }

interface Props {
  fog: FogState | null
  imgRect: ImgRect
  pan: { x: number; y: number }
  scale: number
  animated?: boolean
  brushPreview?: { col: number; row: number; radius: number } | null
  brushMode?: 'reveal' | 'hide'
}

interface GradientStops { center: string; edge: string }

// Front layer: close, slightly lighter at the core so unrevealed regions
// read with a little depth instead of a flat cutout.
const FRONT_GRADIENT: GradientStops = { center: '#141833', edge: '#08090f' }
// Back parallax layer: cooler and lighter, kept faint — reads as a hazy
// second plane of mist sitting behind the front layer.
const BACK_GRADIENT: GradientStops = { center: '#232a52', edge: '#0a0c1f' }

export function FogCanvas({ fog, imgRect, pan, scale, animated, brushPreview, brushMode }: Props) {
  const frontRef = useRef<HTMLCanvasElement>(null)
  const backRef  = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const lastCellsRef = useRef<number[] | null>(null)

  // Refs for render() to avoid stale closures
  const fogRef = useRef(fog)
  const imgRectRef = useRef(imgRect)
  const panRef = useRef(pan)
  const scaleRef = useRef(scale)
  const brushPreviewRef = useRef(brushPreview)
  const brushModeRef = useRef(brushMode)

  fogRef.current = fog
  imgRectRef.current = imgRect
  panRef.current = pan
  scaleRef.current = scale
  brushPreviewRef.current = brushPreview
  brushModeRef.current = brushMode

  // Builds a small opaque-white-on-transparent silhouette of the hidden
  // cells. Color is applied later per-layer via gradient tint, so this
  // mask only needs to carry shape/alpha.
  const drawOffscreen = useCallback((f: FogState) => {
    const { gridCols, gridRows, cells } = f
    let offscreen = offscreenRef.current
    if (!offscreen || offscreen.width !== gridCols || offscreen.height !== gridRows) {
      offscreen = document.createElement('canvas')
      offscreen.width = gridCols
      offscreen.height = gridRows
      offscreenRef.current = offscreen
    }
    const ctx = offscreen.getContext('2d')!
    const imageData = ctx.createImageData(gridCols, gridRows)
    const d = imageData.data
    for (let i = 0; i < gridCols * gridRows; i++) {
      if (cells[i] === 0) {
        d[i * 4]     = 255
        d[i * 4 + 1] = 255
        d[i * 4 + 2] = 255
        d[i * 4 + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
    lastCellsRef.current = cells
  }, [])

  const drawLayer = useCallback((
    canvas: HTMLCanvasElement,
    opts: { blurPx: number; gradient: GradientStops; drawBrush: boolean }
  ) => {
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const f = fogRef.current
    if (!f || f.cells.length === 0 || !offscreenRef.current) return

    const ir = imgRectRef.current
    const p = panRef.current
    const s = scaleRef.current
    const imgLeft = ir.offsetX + p.x
    const imgTop  = ir.offsetY + p.y
    const imgW    = ir.width  * s
    const imgH    = ir.height * s
    if (imgW <= 0 || imgH <= 0) return

    // 1. Draw the fog silhouette, blurred to turn hard grid-cell edges
    //    into a soft mist boundary.
    ctx.imageSmoothingEnabled = true
    ctx.filter = opts.blurPx > 0 ? `blur(${opts.blurPx}px)` : 'none'
    ctx.drawImage(offscreenRef.current, imgLeft, imgTop, imgW, imgH)
    ctx.filter = 'none'

    // 2. Tint the silhouette with a radial gradient (instead of a flat
    //    fill) for a bit of depth. source-atop recolors only the pixels
    //    the silhouette already covers, preserving its blurred alpha.
    const cx = imgLeft + imgW / 2
    const cy = imgTop + imgH / 2
    const radius = Math.max(Math.max(imgW, imgH) * 0.75, 1)
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    gradient.addColorStop(0, opts.gradient.center)
    gradient.addColorStop(1, opts.gradient.edge)
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'source-over'

    // 3. Brush preview ring — DM tool only, drawn crisp (no blur).
    if (opts.drawBrush) {
      const bp = brushPreviewRef.current
      const bm = brushModeRef.current
      if (bp) {
        const cellW = imgW / f.gridCols
        const cellH = imgH / f.gridRows
        const bx = imgLeft + (bp.col + 0.5) * cellW
        const by = imgTop  + (bp.row + 0.5) * cellH
        const rx = (bp.radius + 0.5) * cellW
        const ry = (bp.radius + 0.5) * cellH
        ctx.strokeStyle = bm === 'reveal' ? 'rgba(250,204,21,0.85)' : 'rgba(99,179,237,0.85)'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 4])
        ctx.beginPath()
        ctx.ellipse(bx, by, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }, [])

  const render = useCallback(() => {
    const f = fogRef.current
    if (f && f.cells.length > 0 && f.cells !== lastCellsRef.current) drawOffscreen(f)

    if (frontRef.current) {
      drawLayer(frontRef.current, {
        blurPx: animated ? 9 : 4,
        gradient: FRONT_GRADIENT,
        drawBrush: true,
      })
    }
    // Back parallax layer only renders for the player-facing view — the
    // DM's own canvas stays single-layer so painting stays precise.
    if (animated && backRef.current) {
      drawLayer(backRef.current, {
        blurPx: 14,
        gradient: BACK_GRADIENT,
        drawBrush: false,
      })
    }
  }, [animated, drawLayer, drawOffscreen])

  useEffect(() => { render() }, [fog, imgRect, pan, scale, brushPreview, brushMode, animated, render])

  // Keep both canvases' pixel size in sync with their CSS size
  useEffect(() => {
    const front = frontRef.current
    if (!front) return
    const ro = new ResizeObserver(() => {
      const w = front.offsetWidth
      const h = front.offsetHeight
      front.width = w
      front.height = h
      if (backRef.current) {
        backRef.current.width = w
        backRef.current.height = h
      }
      render()
    })
    ro.observe(front)
    return () => ro.disconnect()
  }, [render])

  return (
    <>
      {animated && (
        <canvas
          ref={backRef}
          className="absolute inset-0 pointer-events-none fog-layer-back"
          style={{ width: '100%', height: '100%', maxWidth: 'none', opacity: 0.4 }}
        />
      )}
      <canvas
        ref={frontRef}
        className={`absolute inset-0 pointer-events-none ${animated ? 'fog-layer-animated' : ''}`}
        style={{ width: '100%', height: '100%', maxWidth: 'none', opacity: animated ? 1 : 0.68 }}
      />
    </>
  )
}
