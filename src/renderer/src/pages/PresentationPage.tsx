import { useRef, useState, useEffect, useCallback } from 'react'
import type { MapData, FogState, SpotlightState, EncounterState, SceneData, Combatant, VfxEvent, AmbientVfxState, RayEvent, ZoneMarker } from '../types'
import { DEFAULT_AMBIENT_VFX } from '../types'
import { FogCanvas } from '../components/maps/FogCanvas'
import { FogSvgFilter } from '../components/maps/FogSvgFilter'
import { GridOverlay } from '../components/maps/GridOverlay'
import { RulerOverlay } from '../components/maps/RulerOverlay'
import { SpotlightOverlay } from '../components/maps/SpotlightOverlay'
import { VfxOverlay, VFX_DURATIONS } from '../components/maps/VfxOverlay'
import { RayOverlay, RAY_DURATIONS } from '../components/maps/RayOverlay'
import { ZoneOverlay } from '../components/maps/ZoneOverlay'
import { RainLoop, StormLoop } from '../components/maps/AmbientVfxOverlay'
import { ConditionBadge } from '../components/encounter/ConditionBadge'
import { Skull } from 'lucide-react'

interface Props {
  initialMapId: string
}

interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }
interface Pt { x: number; y: number }
interface SharedRuler { start: Pt; end: Pt }

export function PresentationPage({ initialMapId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [map, setMap] = useState<MapData | null>(null)
  const [imgRect, setImgRect] = useState<ImgRect>({ width: 0, height: 0, offsetX: 0, offsetY: 0 })
  const imgRectRef = useRef<ImgRect>({ width: 0, height: 0, offsetX: 0, offsetY: 0 })

  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const panRef = useRef({ x: 0, y: 0 })
  const scaleRef = useRef(1)
  const panningRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)

  const [fog, setFog] = useState<FogState | null>(null)
  const [ruler, setRuler] = useState<SharedRuler | null>(null)
  const [spotlightPos, setSpotlightPos] = useState<SpotlightState | null>(null)
  const [gridVisible, setGridVisible] = useState(false)
  const [natDims, setNatDims] = useState({ w: 0, h: 0 })

  const [encounter, setEncounter] = useState<EncounterState | null>(null)
  const [handout, setHandout] = useState<{ imagePath: string } | null>(null)
  const [scene, setScene] = useState<SceneData | null>(null)
  const [effects, setEffects] = useState<VfxEvent[]>([])
  const [rays, setRays] = useState<RayEvent[]>([])
  const [zones, setZones] = useState<ZoneMarker[]>([])
  const [ambientVfx, setAmbientVfx] = useState<AmbientVfxState>(DEFAULT_AMBIENT_VFX)

  useEffect(() => { panRef.current = pan }, [pan])
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
  }, [map?.image_path])

  useEffect(() => {
    recalc()
    const ro = new ResizeObserver(recalc)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [recalc])

  function handleImageLoad() {
    const img = imageRef.current
    if (img) setNatDims({ w: img.naturalWidth, h: img.naturalHeight })
    recalc()
  }

  async function loadMap(id: string) {
    if (!id) return
    const data = await window.api.maps.get(id)
    if (data) {
      setMap(data)
      setPan({ x: 0, y: 0 })
      setScale(1)
      setFog(null)
      setRuler(null)
      setSpotlightPos(null)
      setGridVisible(false)
    }
  }

  // F toggles fullscreen on this window (e.g. the TV/projector display),
  // Escape drops out of it — a manual override for the auto-fullscreen
  // that happens when a second display is detected on Present.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'f' || e.key === 'F') {
        window.api.maps.toggleFullscreen()
      } else if (e.key === 'Escape') {
        window.api.maps.setFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    loadMap(initialMapId)
    const c1 = window.api.maps.onPresentUpdate((id: string) => loadMap(id))
    const c2 = window.api.maps.onFogUpdate((d: { mapId: string; fogState: unknown }) =>
      setFog(d.fogState as FogState))
    const c3 = window.api.maps.onRulerUpdate((r: unknown) => setRuler(r as SharedRuler | null))
    const c4 = window.api.maps.onSpotlightUpdate((s: unknown) => setSpotlightPos(s as SpotlightState | null))
    const c5 = window.api.maps.onGridUpdate((v: unknown) => setGridVisible(v as boolean))
    const c6 = window.api.encounter.onUpdate((s: unknown) => setEncounter(s as EncounterState | null))
    const c7 = window.api.maps.onHandoutUpdate((d) => setHandout(d))
    const c8 = window.api.maps.onSceneUpdate((d: unknown) => setScene(d as SceneData | null))
    const c9 = window.api.maps.onEffectUpdate((d) => {
      const evt = d as VfxEvent
      setEffects((prev) => [...prev, evt])
      setTimeout(() => {
        setEffects((prev) => prev.filter((e) => e.id !== evt.id))
      }, VFX_DURATIONS[evt.type])
    })
    const c10 = window.api.maps.onAmbientVfxUpdate((d) => setAmbientVfx(d as AmbientVfxState))
    const c11 = window.api.maps.onRayUpdate((d) => {
      const ray = d as RayEvent
      setRays((prev) => [...prev, ray])
      setTimeout(() => {
        setRays((prev) => prev.filter((r) => r.id !== ray.id))
      }, RAY_DURATIONS[ray.type])
    })
    // Zones always arrive as the full current list (see maps:pushZones),
    // so this just replaces state rather than merging/diffing.
    const c12 = window.api.maps.onZonesUpdate((d) => setZones(d as ZoneMarker[]))
    return () => { c1(); c2(); c3(); c4(); c5(); c6(); c7(); c8(); c9(); c10(); c11(); c12() }
  }, [])

  // Non-passive wheel for zoom centered on cursor
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = scaleRef.current
      const p = panRef.current
      const ir = imgRectRef.current
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const ns = Math.max(0.15, Math.min(12, s * factor))
      const rect = el.getBoundingClientRect()
      const relX = e.clientX - rect.left - ir.offsetX
      const relY = e.clientY - rect.top - ir.offsetY
      const ratio = ns / s
      setPan({ x: relX * (1 - ratio) + p.x * ratio, y: relY * (1 - ratio) + p.y * ratio })
      setScale(ns)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    panningRef.current = { startX: e.clientX, startY: e.clientY, startPanX: panRef.current.x, startPanY: panRef.current.y }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!panningRef.current) return
    setPan({
      x: panningRef.current.startPanX + e.clientX - panningRef.current.startX,
      y: panningRef.current.startPanY + e.clientY - panningRef.current.startY
    })
  }

  function handlePointerUp() { panningRef.current = null }

  function handleDoubleClick() {
    setPan({ x: 0, y: 0 })
    setScale(1)
  }

  return (
    <div
      ref={containerRef}
      className="flex h-screen bg-black overflow-hidden select-none relative"
      style={{ cursor: 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <FogSvgFilter />

      {map?.image_path ? (
        <img
          ref={imageRef}
          src={`file:///${map.image_path.replace(/\\/g, '/')}`}
          alt={map.name}
          className="absolute pointer-events-none"
          style={{
            left:   imgRect.offsetX + pan.x,
            top:    imgRect.offsetY + pan.y,
            width:  imgRect.width  * scale,
            height: imgRect.height * scale,
            maxWidth: 'none',
          }}
          onLoad={handleImageLoad}
          draggable={false}
        />
      ) : scene ? (
        /* Ambient scene fallback when no map image */
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {scene.imagePath && (
            <img
              src={`file:///${scene.imagePath.replace(/\\/g, '/')}`}
              alt={scene.title ?? 'Scene'}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          )}
          {(scene.title || scene.subtitle) && (
            <div className="relative z-10 text-center px-8 py-6 rounded-xl bg-black/50 backdrop-blur-sm">
              {scene.title && (
                <h1 className="font-display text-4xl font-semibold text-white tracking-wide drop-shadow-lg">
                  {scene.title}
                </h1>
              )}
              {scene.subtitle && (
                <p className="mt-2 text-amber-300/80 text-lg tracking-wide">{scene.subtitle}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-700 text-sm">{map ? 'No image for this map.' : 'Loading…'}</p>
        </div>
      )}

      {map && gridVisible && (
        <GridOverlay
          mapData={map}
          imgRect={imgRect}
          pan={pan}
          scale={scale}
          natW={natDims.w}
          natH={natDims.h}
        />
      )}

      {fog && (
        <FogCanvas
          fog={fog}
          imgRect={imgRect}
          pan={pan}
          scale={scale}
          animated={true}
        />
      )}

      {ruler && map && (
        <RulerOverlay
          start={ruler.start}
          end={ruler.end}
          liveEnd={null}
          imgRect={imgRect}
          pan={pan}
          scale={scale}
          mapData={map}
          natW={natDims.w}
          natH={natDims.h}
          shareToPlayers={false}
          onShareToggle={() => {}}
          readOnly={true}
        />
      )}

      {spotlightPos && (
        <SpotlightOverlay
          pos={spotlightPos}
          imgRect={imgRect}
          pan={pan}
          scale={scale}
        />
      )}

      {ambientVfx.rain && <RainLoop />}
      {ambientVfx.stormLightning && <StormLoop />}

      {zones.map((zone) => (
        <ZoneOverlay key={zone.id} zone={zone} imgRect={imgRect} pan={pan} scale={scale} />
      ))}

      {effects.map((effect) => (
        <VfxOverlay key={effect.id} effect={effect} imgRect={imgRect} pan={pan} scale={scale} />
      ))}

      {rays.map((ray) => (
        <RayOverlay key={ray.id} ray={ray} imgRect={imgRect} pan={pan} scale={scale} />
      ))}

      {map && (
        <span className="absolute bottom-4 right-4 text-white/20 text-xs pointer-events-none">
          {map.name}
        </span>
      )}

      {scale !== 1 && (
        <div className="absolute bottom-4 left-4 px-2 py-1 bg-white/5 rounded text-white/30 text-xs pointer-events-none">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Encounter HUD */}
      {encounter?.isActive && encounter.combatants.length > 0 && (
        <div className="absolute top-0 right-0 h-full w-56 bg-black/75 backdrop-blur-sm flex flex-col pointer-events-none select-none border-l border-white/5">
          <div className="px-3 pt-4 pb-2 border-b border-white/10">
            <p className="font-display text-amber-400 text-lg font-semibold tracking-wide text-center">
              Round {encounter.round}
            </p>
          </div>
          <div className="flex-1 overflow-hidden py-2 space-y-1 px-2">
            {encounter.combatants.map((c: Combatant, i: number) => {
              const isCurrent = i === encounter.currentIndex
              const isDown = c.hp_current != null && c.hp_current <= 0
              return (
                <div
                  key={c.id}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                    isCurrent ? 'bg-amber-500/20' : 'bg-transparent'
                  } ${isDown ? 'opacity-50 grayscale' : ''}`}
                >
                  <div
                    className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                      isCurrent ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`flex items-center gap-1 min-w-0 text-xs font-medium ${
                      isCurrent ? 'text-amber-200' : c.type === 'party' ? 'text-sky-300/80' : 'text-rose-300/80'
                    }`}>
                      <span className="truncate">{c.name}</span>
                      {isDown && <Skull size={10} className="text-white/40 flex-shrink-0" />}
                    </p>
                    {c.type === 'party' && c.hp_current != null && (
                      <p className="text-[10px] text-emerald-300/70 mt-0.5">
                        {c.hp_current}
                        {c.hp_max != null && <span className="text-white/30">/{c.hp_max}</span>} HP
                      </p>
                    )}
                    {c.conditions.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {c.conditions.map((cond) => (
                          <ConditionBadge key={cond} condition={cond} />
                        ))}
                      </div>
                    )}
                  </div>
                  {c.initiative != null && (
                    <span className="text-[10px] text-white/30 flex-shrink-0 mt-0.5">
                      {c.initiative}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Handout overlay (highest priority) */}
      {handout && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black z-50"
          style={{ transition: 'opacity 150ms ease' }}
        >
          <img
            src={`file:///${handout.imagePath.replace(/\\/g, '/')}`}
            alt="Handout"
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        </div>
      )}
    </div>
  )
}
