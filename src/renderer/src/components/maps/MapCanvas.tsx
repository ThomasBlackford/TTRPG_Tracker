import { useRef, useState, useEffect, useCallback } from 'react'
import { ImagePlus } from 'lucide-react'
import type { MapData, MapPin, FogState, MapTool, RulerState, SpotlightState } from '../../types'
import { MapPinMarker } from './MapPinMarker'
import { FogCanvas } from './FogCanvas'
import { RulerOverlay } from './RulerOverlay'
import { GridOverlay } from './GridOverlay'
import { SpotlightOverlay } from './SpotlightOverlay'

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }

interface Props {
  map: MapData
  pins: MapPin[]
  // Tools
  activeTool: MapTool
  // Fog
  fog: FogState | null
  brushRadius: number
  brushMode: 'reveal' | 'hide'
  onFogChange: (fog: FogState) => void
  onFogSave: (fog: FogState) => void
  // Ruler
  rulerState: RulerState
  onRulerChange: (r: Partial<RulerState>) => void
  // Spotlight
  spotlightPos: SpotlightState | null
  onSpotlightSet: (pos: SpotlightState | null) => void
  // Grid
  gridVisible: boolean
  // Existing
  selectedPinId: string | null
  onAddPin: (x: number, y: number) => void
  onClickPin: (pin: MapPin) => void
  onDragPin: (id: string, x: number, y: number) => void
  onSelectPin: (pin: MapPin | null) => void
  onUploadImage: () => void
}

function paintBrushCells(cells: number[], col: number, row: number, radius: number, mode: 'reveal' | 'hide', gridCols: number, gridRows: number) {
  const val = mode === 'reveal' ? 1 : 0
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (Math.sqrt(dc * dc + dr * dr) > radius + 0.5) continue
      const c = col + dc, r = row + dr
      if (c < 0 || c >= gridCols || r < 0 || r >= gridRows) continue
      cells[r * gridCols + c] = val
    }
  }
}

export function MapCanvas({
  map, pins, activeTool,
  fog, brushRadius, brushMode, onFogChange, onFogSave,
  rulerState, onRulerChange,
  spotlightPos, onSpotlightSet,
  gridVisible,
  selectedPinId, onAddPin, onClickPin, onDragPin, onSelectPin, onUploadImage,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef     = useRef<HTMLImageElement>(null)
  const [imgRect, setImgRect] = useState<ImgRect>({ width: 0, height: 0, offsetX: 0, offsetY: 0 })
  const imgRectRef = useRef<ImgRect>({ width: 0, height: 0, offsetX: 0, offsetY: 0 })

  const [pan,   setPan]   = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const panRef   = useRef({ x: 0, y: 0 })
  const scaleRef = useRef(1)

  // Pin dragging
  const [dragging,   setDragging]   = useState<{ id: string; startX: number; startY: number; moved: boolean } | null>(null)
  const [tempPinPos, setTempPinPos] = useState<{ id: string; x: number; y: number } | null>(null)

  // Canvas panning
  const [panning, setPanning] = useState<{ startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null>(null)

  // Fog brush preview
  const [brushPreview, setBrushPreview] = useState<{ col: number; row: number; radius: number } | null>(null)
  const paintingCellsRef = useRef<number[] | null>(null)

  // Ruler live-end (cursor while placing second point)
  const [rulerLiveEnd, setRulerLiveEnd] = useState<{ x: number; y: number } | null>(null)

  // Natural image dimensions (for ruler distance calc)
  const [natDims, setNatDims] = useState({ w: 0, h: 0 })

  useEffect(() => { panRef.current = pan },     [pan])
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { imgRectRef.current = imgRect }, [imgRect])

  const recalc = useCallback(() => {
    const container = containerRef.current
    const img = imageRef.current
    if (!container || !img?.naturalWidth) return
    const cw = container.clientWidth
    const ch = container.clientHeight
    const aspect = img.naturalWidth / img.naturalHeight
    let w: number, h: number, ox: number, oy: number
    if (cw / ch > aspect) {
      h = ch; w = ch * aspect; ox = (cw - w) / 2; oy = 0
    } else {
      w = cw; h = cw / aspect; ox = 0; oy = (ch - h) / 2
    }
    setImgRect({ width: w, height: h, offsetX: ox, offsetY: oy })
    setNatDims({ w: img.naturalWidth, h: img.naturalHeight })
  }, [map.image_path])

  useEffect(() => {
    recalc()
    const ro = new ResizeObserver(recalc)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [recalc])

  useEffect(() => {
    setPan({ x: 0, y: 0 })
    setScale(1)
    setRulerLiveEnd(null)
    setBrushPreview(null)
  }, [map.id])

  // Non-passive wheel for zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s  = scaleRef.current
      const p  = panRef.current
      const ir = imgRectRef.current
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const ns = Math.max(0.15, Math.min(12, s * factor))
      const rect = el.getBoundingClientRect()
      const relX = e.clientX - rect.left - ir.offsetX
      const relY = e.clientY - rect.top  - ir.offsetY
      const ratio = ns / s
      setPan({ x: relX * (1 - ratio) + p.x * ratio, y: relY * (1 - ratio) + p.y * ratio })
      setScale(ns)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function toImageCoords(clientX: number, clientY: number) {
    if (!containerRef.current) return { x: 0.5, y: 0.5 }
    const rect = containerRef.current.getBoundingClientRect()
    const x = (clientX - rect.left - imgRect.offsetX - pan.x) / (imgRect.width  * scale)
    const y = (clientY - rect.top  - imgRect.offsetY - pan.y) / (imgRect.height * scale)
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
  }

  function screenToCell(clientX: number, clientY: number): { col: number; row: number } | null {
    if (!fog) return null
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    const rawX = (clientX - rect.left - imgRect.offsetX - pan.x) / (imgRect.width  * scale)
    const rawY = (clientY - rect.top  - imgRect.offsetY - pan.y) / (imgRect.height * scale)
    if (rawX < 0 || rawX > 1 || rawY < 0 || rawY > 1) return null
    return {
      col: Math.floor(rawX * fog.gridCols),
      row: Math.floor(rawY * fog.gridRows),
    }
  }

  function pinScreenPos(pin: MapPin) {
    const p = tempPinPos?.id === pin.id ? tempPinPos : pin
    return {
      left: imgRect.offsetX + pan.x + p.x * imgRect.width  * scale,
      top:  imgRect.offsetY + pan.y + p.y * imgRect.height * scale,
    }
  }

  // ── Container pointer (pan / fog / ruler / spotlight) ────────────────────

  function handleContainerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-pin]')) return
    e.currentTarget.setPointerCapture(e.pointerId)

    if (activeTool === 'fog') {
      if (!fog) return
      paintingCellsRef.current = [...fog.cells]
      const cell = screenToCell(e.clientX, e.clientY)
      if (cell) {
        paintBrushCells(paintingCellsRef.current, cell.col, cell.row, brushRadius, brushMode, fog.gridCols, fog.gridRows)
        onFogChange({ ...fog, cells: [...paintingCellsRef.current] })
      }
      return
    }

    if (activeTool === 'ruler') {
      const coords = toImageCoords(e.clientX, e.clientY)
      if (rulerState.frozen) {
        // Third click: reset
        onRulerChange({ start: null, end: null, frozen: false })
        setRulerLiveEnd(null)
      } else if (rulerState.start && !rulerState.frozen) {
        // Second click: freeze
        onRulerChange({ end: coords, frozen: true })
        setRulerLiveEnd(null)
      } else {
        // First click
        onRulerChange({ start: coords, end: null, frozen: false })
        setRulerLiveEnd(null)
      }
      return
    }

    if (activeTool === 'spotlight') {
      const coords = toImageCoords(e.clientX, e.clientY)
      onSpotlightSet(spotlightPos ? null : coords)
      return
    }

    // Default: pan
    setPanning({ startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y, moved: false })
  }

  function handleContainerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (activeTool === 'fog') {
      const cell = screenToCell(e.clientX, e.clientY)
      setBrushPreview(cell ? { ...cell, radius: brushRadius } : null)
      if (paintingCellsRef.current !== null && fog && cell) {
        paintBrushCells(paintingCellsRef.current, cell.col, cell.row, brushRadius, brushMode, fog.gridCols, fog.gridRows)
        onFogChange({ ...fog, cells: [...paintingCellsRef.current] })
      }
      return
    }

    if (activeTool === 'ruler' && rulerState.start && !rulerState.frozen) {
      const coords = toImageCoords(e.clientX, e.clientY)
      setRulerLiveEnd(coords)
      return
    }

    if (!panning) return
    const dx = e.clientX - panning.startX
    const dy = e.clientY - panning.startY
    if (!panning.moved && Math.hypot(dx, dy) < 4) return
    if (!panning.moved) setPanning(prev => prev && { ...prev, moved: true })
    setPan({ x: panning.startPanX + dx, y: panning.startPanY + dy })
  }

  function handleContainerPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (activeTool === 'fog') {
      if (paintingCellsRef.current !== null && fog) {
        const finalFog = { ...fog, cells: [...paintingCellsRef.current] }
        onFogSave(finalFog)
      }
      paintingCellsRef.current = null
      return
    }

    if (!panning) return
    const wasMoved = panning.moved
    setPanning(null)
    if (wasMoved) return

    // Treat as click (no pan movement)
    if (activeTool === 'pin') {
      const { x, y } = toImageCoords(e.clientX, e.clientY)
      if (x > 0 && x < 1 && y > 0 && y < 1) onAddPin(x, y)
    } else if (!activeTool) {
      onSelectPin(null)
    }
  }

  function handleDoubleClick() {
    setPan({ x: 0, y: 0 })
    setScale(1)
  }

  function handleContainerPointerLeave() {
    if (activeTool === 'fog') setBrushPreview(null)
  }

  // ── Pin pointer events ───────────────────────────────────────────────────

  function handlePinPointerDown(e: React.PointerEvent, pin: MapPin) {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDragging({ id: pin.id, startX: e.clientX, startY: e.clientY, moved: false })
  }

  function handlePinPointerMove(e: React.PointerEvent, pin: MapPin) {
    if (!dragging || dragging.id !== pin.id) return
    const dx = e.clientX - dragging.startX
    const dy = e.clientY - dragging.startY
    if (!dragging.moved && Math.hypot(dx, dy) < 6) return
    if (!dragging.moved) setDragging(d => d && { ...d, moved: true })
    const { x, y } = toImageCoords(e.clientX, e.clientY)
    setTempPinPos({ id: pin.id, x, y })
  }

  function handlePinPointerUp(_e: React.PointerEvent, pin: MapPin) {
    if (!dragging || dragging.id !== pin.id) return
    if (dragging.moved && tempPinPos?.id === pin.id) {
      onDragPin(pin.id, tempPinPos.x, tempPinPos.y)
    } else {
      onClickPin(pin)
    }
    setDragging(null)
    setTempPinPos(null)
  }

  // ── Cursor ───────────────────────────────────────────────────────────────

  const cursor = (() => {
    if (activeTool === 'fog' || activeTool === 'ruler' || activeTool === 'spotlight') return 'crosshair'
    if (activeTool === 'pin') return 'crosshair'
    if (panning?.moved) return 'grabbing'
    return 'grab'
  })()

  // ── No-image state ───────────────────────────────────────────────────────

  if (!map.image_path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <ImagePlus size={48} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">{map.name}</p>
          <p className="text-slate-600 text-xs mt-1">No image uploaded yet</p>
        </div>
        <button onClick={onUploadImage} className="btn-primary flex items-center gap-2">
          <ImagePlus size={14} />Upload Map Image
        </button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden select-none"
      style={{ cursor }}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerLeave={handleContainerPointerLeave}
      onDoubleClick={handleDoubleClick}
    >
      {/* Map image */}
      <img
        ref={imageRef}
        src={`file:///${map.image_path.replace(/\\/g, '/')}`}
        alt={map.name}
        className="absolute pointer-events-none"
        style={{
          left: imgRect.offsetX + pan.x,
          top:  imgRect.offsetY + pan.y,
          width:  imgRect.width  * scale,
          height: imgRect.height * scale,
          maxWidth: 'none',
        }}
        onLoad={recalc}
        draggable={false}
      />

      {/* Grid overlay */}
      {gridVisible && imgRect.width > 0 && (
        <GridOverlay mapData={map} imgRect={imgRect} pan={pan} scale={scale} natW={natDims.w} natH={natDims.h} />
      )}

      {/* Fog overlay (DM — flat, semi-transparent) */}
      {fog && (
        <FogCanvas
          fog={fog}
          imgRect={imgRect}
          pan={pan}
          scale={scale}
          animated={false}
          brushPreview={activeTool === 'fog' ? brushPreview : null}
          brushMode={brushMode}
        />
      )}

      {/* Ruler */}
      {imgRect.width > 0 && (rulerState.start || rulerLiveEnd) && (
        <RulerOverlay
          start={rulerState.start}
          end={rulerState.end}
          liveEnd={rulerLiveEnd}
          imgRect={imgRect}
          pan={pan}
          scale={scale}
          mapData={map}
          natW={natDims.w}
          natH={natDims.h}
          shareToPlayers={rulerState.shareToPlayers}
          onShareToggle={() => onRulerChange({ shareToPlayers: !rulerState.shareToPlayers })}
        />
      )}

      {/* Spotlight */}
      <SpotlightOverlay pos={spotlightPos} imgRect={imgRect} pan={pan} scale={scale} />

      {/* Pins */}
      {imgRect.width > 0 && pins.map((pin) => {
        const { left, top } = pinScreenPos(pin)
        return (
          <div key={pin.id} data-pin="1">
            <MapPinMarker
              pin={pin}
              left={left}
              top={top}
              isSelected={selectedPinId === pin.id}
              isDragging={dragging?.id === pin.id && !!dragging.moved}
              onPointerDown={(e) => handlePinPointerDown(e, pin)}
              onPointerMove={(e) => handlePinPointerMove(e, pin)}
              onPointerUp={(e) => handlePinPointerUp(e, pin)}
            />
          </div>
        )
      })}

      {/* Zoom indicator */}
      {scale !== 1 && (
        <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/40 rounded text-white/40 text-xs pointer-events-none select-none">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Tool hints */}
      {activeTool === 'pin' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-xs pointer-events-none">
          Click on the map to place a pin
        </div>
      )}
      {activeTool === 'ruler' && !rulerState.start && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-full text-blue-300 text-xs pointer-events-none">
          Click to set ruler start point
        </div>
      )}
      {activeTool === 'ruler' && rulerState.start && !rulerState.frozen && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-full text-blue-300 text-xs pointer-events-none">
          Click to set end point — click again to reset
        </div>
      )}
      {activeTool === 'spotlight' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 text-xs pointer-events-none">
          {spotlightPos ? 'Click to remove spotlight' : 'Click to place spotlight for players'}
        </div>
      )}
    </div>
  )
}
