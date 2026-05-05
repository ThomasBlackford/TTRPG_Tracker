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

export function FogCanvas({ fog, imgRect, pan, scale, animated, brushPreview, brushMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const lastCellsRef = useRef<number[] | null>(null)

  // Refs for render function to avoid stale closures
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
        d[i * 4]     = 10
        d[i * 4 + 1] = 12
        d[i * 4 + 2] = 25
        d[i * 4 + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
    lastCellsRef.current = cells
  }, [])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const f = fogRef.current
    if (!f || f.cells.length === 0) return

    // Redraw offscreen only when cells reference changes
    if (f.cells !== lastCellsRef.current) drawOffscreen(f)
    if (!offscreenRef.current) return

    const ir = imgRectRef.current
    const p = panRef.current
    const s = scaleRef.current
    const imgLeft = ir.offsetX + p.x
    const imgTop  = ir.offsetY + p.y
    const imgW    = ir.width  * s
    const imgH    = ir.height * s
    if (imgW <= 0 || imgH <= 0) return

    ctx.imageSmoothingEnabled = true
    ctx.globalAlpha = animated ? 0.93 : 0.68
    ctx.drawImage(offscreenRef.current, imgLeft, imgTop, imgW, imgH)
    ctx.globalAlpha = 1

    // Brush preview ring (DM only)
    const bp = brushPreviewRef.current
    const bm = brushModeRef.current
    if (bp && f) {
      const cellW = imgW / f.gridCols
      const cellH = imgH / f.gridRows
      const cx = imgLeft + (bp.col + 0.5) * cellW
      const cy = imgTop  + (bp.row + 0.5) * cellH
      const rx = (bp.radius + 0.5) * cellW
      const ry = (bp.radius + 0.5) * cellH
      ctx.strokeStyle = bm === 'reveal' ? 'rgba(250,204,21,0.85)' : 'rgba(99,179,237,0.85)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [animated, drawOffscreen])

  // Re-render when any input changes
  useEffect(() => { render() }, [fog, imgRect, pan, scale, brushPreview, brushMode, render])

  // Keep canvas pixel size in sync with its CSS size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      render()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [render])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${animated ? 'fog-layer-animated' : ''}`}
      style={{ width: '100%', height: '100%', maxWidth: 'none' }}
    />
  )
}
