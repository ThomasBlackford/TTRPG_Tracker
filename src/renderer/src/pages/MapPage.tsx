import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Pin, ChevronRight, ImagePlus, Pencil, Check, X as XIcon,
  MonitorPlay, MonitorOff, Cloud, Ruler, Crosshair, Grid,
  Settings, Image, Tv2, Sparkles
} from 'lucide-react'
import type { MapData, MapPin, Card, FogState, MapTool, RulerState, SpotlightState, SceneData, VfxType, AmbientVfxState } from '../types'
import { VFX_POINT_TYPES, DEFAULT_AMBIENT_VFX } from '../types'
import { MapListPanel } from '../components/maps/MapListPanel'
import { MapCanvas } from '../components/maps/MapCanvas'
import { PinEditor } from '../components/maps/PinEditor'
import { CardDetail } from '../components/cards/CardDetail'
import { FogControls } from '../components/maps/FogControls'
import { RulerControls } from '../components/maps/RulerControls'
import { VfxControls } from '../components/maps/VfxControls'
import { ScaleConfigModal } from '../components/maps/ScaleConfigModal'
import { useMapPresentStore } from '../store/mapPresentStore'

const DEFAULT_RULER: RulerState = { start: null, end: null, frozen: false, shareToPlayers: false }
const DEFAULT_FOG_COLS = 64
const DEFAULT_FOG_ROWS = 64

export function MapPage() {
  // Presenting + which map is current live outside this component's state —
  // they must survive switching to another tab and back without desyncing
  // from the actual (still-open) TV window. See mapPresentStore.
  const { presenting, setPresenting, mapStack, setMapStack } = useMapPresentStore()

  const [maps, setMaps]     = useState<MapData[]>([])
  const [pins, setPins]     = useState<MapPin[]>([])
  const [editingPin, setEditingPin] = useState<MapPin | null>(null)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [cardDetail, setCardDetail] = useState<Card | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [newMapName, setNewMapName]   = useState('')
  const [creatingMap, setCreatingMap] = useState(false)

  // Tools
  const [activeTool, setActiveTool] = useState<MapTool>(null)

  // Fog
  const [fog, setFog]               = useState<FogState | null>(null)
  const [brushRadius, setBrushRadius] = useState(2)
  const [brushMode, setBrushMode]   = useState<'reveal' | 'hide'>('reveal')

  // Ruler
  const [rulerState, setRulerState] = useState<RulerState>(DEFAULT_RULER)

  // Spotlight
  const [spotlightPos, setSpotlightPos] = useState<SpotlightState | null>(null)

  // Grid
  const [gridVisible, setGridVisible] = useState(false)

  // VFX
  const [pendingVfxType, setPendingVfxType] = useState<VfxType | null>(null)
  useEffect(() => { if (activeTool !== 'vfx') setPendingVfxType(null) }, [activeTool])
  const [ambientVfx, setAmbientVfx] = useState<AmbientVfxState>(DEFAULT_AMBIENT_VFX)

  // Scale modal
  const [scaleModalOpen, setScaleModalOpen] = useState(false)
  const [natW, setNatW] = useState(0)

  // Scene
  const [activeTab, setActiveTab] = useState<'maps' | 'scene'>('maps')
  const [scene, setScene] = useState<SceneData>({})
  const [handoutActive, setHandoutActive] = useState(false)

  const currentMapId = mapStack[mapStack.length - 1] ?? null
  const currentMap   = maps.find((m) => m.id === currentMapId) ?? null

  // ── Load data ────────────────────────────────────────────────────────────

  useEffect(() => { loadMaps() }, [])

  // Track handout state from the actual push channel — not just this page's
  // own "Push to TV" button — since a handout can also be triggered from a
  // card in the Library. This is what drives the "Clear Handout" control.
  useEffect(() => {
    const cleanup = window.api.maps.onHandoutUpdate((data) => setHandoutActive(!!data))
    return cleanup
  }, [])

  useEffect(() => {
    if (currentMapId) {
      loadPins(currentMapId)
      loadFog(currentMapId)
    } else {
      setPins([])
      setFog(null)
    }
    setRulerState(DEFAULT_RULER)
    setSpotlightPos(null)
    setSelectedPinId(null)
    setCardDetail(null)
    if (presenting) window.api.maps.pushSpotlight(null)
  }, [currentMapId])

  async function loadMaps() {
    const data = await window.api.maps.list() as MapData[]
    setMaps(data)
    if (data.length > 0 && !currentMapId) setMapStack([data[0].id])
  }

  async function loadPins(mapId: string) {
    const data = await window.api.maps.getPins(mapId)
    setPins(data as MapPin[])
  }

  async function loadFog(mapId: string) {
    const data = await window.api.maps.getFog(mapId) as FogState | null
    setFog(data)
  }

  // ── Fog ─────────────────────────────────────────────────────────────────

  function initFog(): FogState {
    return {
      gridCols: DEFAULT_FOG_COLS,
      gridRows: DEFAULT_FOG_ROWS,
      cells: new Array(DEFAULT_FOG_COLS * DEFAULT_FOG_ROWS).fill(0),
    }
  }

  function handleActivateFogTool() {
    if (activeTool === 'fog') { setActiveTool(null); return }
    setActiveTool('fog')
    if (!fog && currentMapId) {
      // First time enabling fog for this map — start fully fogged.
      // If we're already presenting, persist + push immediately so the
      // player screen goes dark right away instead of staying fully
      // visible until the first brush stroke ends.
      const initial = initFog()
      if (presenting) handleFogSave(initial)
      else setFog(initial)
    }
  }

  const lastLiveFogPushRef = useRef(0)

  function handleFogChange(newFog: FogState) {
    setFog(newFog)
    // Live-broadcast to the player screen while actively dragging the
    // brush, throttled so we're not flooding IPC on every pointermove.
    if (presenting && currentMapId) {
      const now = Date.now()
      if (now - lastLiveFogPushRef.current >= 80) {
        lastLiveFogPushRef.current = now
        window.api.maps.pushFogLive({ mapId: currentMapId, fogState: newFog })
      }
    }
  }

  const fogSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleFogSave(newFog: FogState) {
    setFog(newFog)
    if (!currentMapId) return
    if (fogSaveTimerRef.current) clearTimeout(fogSaveTimerRef.current)
    fogSaveTimerRef.current = setTimeout(async () => {
      await window.api.maps.saveFog({ mapId: currentMapId, fogState: newFog })
    }, 300)
  }

  function handleRevealAll() {
    if (!fog) return
    const newFog = { ...fog, cells: new Array(fog.gridCols * fog.gridRows).fill(1) }
    handleFogSave(newFog)
  }

  function handleHideAll() {
    if (!fog) {
      const initial = initFog()
      handleFogSave(initial)
      return
    }
    const newFog = { ...fog, cells: new Array(fog.gridCols * fog.gridRows).fill(0) }
    handleFogSave(newFog)
  }

  // ── Ruler ────────────────────────────────────────────────────────────────

  const handleRulerChange = useCallback((partial: Partial<RulerState>) => {
    setRulerState(prev => {
      const next = { ...prev, ...partial }
      // Push to player if sharing
      if (next.shareToPlayers && presenting) {
        window.api.maps.pushRuler(
          next.start && next.end
            ? { start: next.start, end: next.end }
            : null
        )
      } else if (!next.shareToPlayers && presenting) {
        window.api.maps.pushRuler(null)
      }
      return next
    })
  }, [presenting])

  // Push ruler to player when share state changes
  useEffect(() => {
    if (!presenting) return
    if (rulerState.shareToPlayers && rulerState.start && rulerState.end) {
      window.api.maps.pushRuler({ start: rulerState.start, end: rulerState.end })
    } else {
      window.api.maps.pushRuler(null)
    }
  }, [rulerState.shareToPlayers, presenting])

  // ── Spotlight ────────────────────────────────────────────────────────────

  function handleSpotlightSet(pos: SpotlightState | null) {
    setSpotlightPos(pos)
    if (presenting) window.api.maps.pushSpotlight(pos)
  }

  // ── Grid ─────────────────────────────────────────────────────────────────

  function handleGridToggle() {
    const next = !gridVisible
    setGridVisible(next)
    if (presenting) window.api.maps.pushGrid({ visible: next })
  }

  // ── VFX ──────────────────────────────────────────────────────────────────

  function handleVfxPick(type: VfxType) {
    if (VFX_POINT_TYPES.includes(type)) {
      // Arm placement mode — the next map click fires it at that point.
      setPendingVfxType(type)
    } else {
      // Screen-wide effect — fires immediately, no target needed.
      window.api.maps.pushEffect({ id: crypto.randomUUID(), type })
    }
  }

  function handlePlaceEffect(x: number, y: number) {
    if (!pendingVfxType) return
    window.api.maps.pushEffect({ id: crypto.randomUUID(), type: pendingVfxType, x, y })
    setPendingVfxType(null)
    setActiveTool(null)
  }

  function handleToggleAmbient(key: keyof AmbientVfxState) {
    const next = { ...ambientVfx, [key]: !ambientVfx[key] }
    setAmbientVfx(next)
    if (presenting) window.api.maps.pushAmbientVfx(next)
  }

  // ── Presentation ─────────────────────────────────────────────────────────

  async function handlePresent() {
    if (!currentMapId) return
    if (presenting) {
      await window.api.maps.closePresentation()
      setPresenting(false)
    } else {
      await window.api.maps.openPresentation(currentMapId)
      setPresenting(true)
      // Push current fog state if active
      if (fog) await window.api.maps.saveFog({ mapId: currentMapId, fogState: fog })
      // Push grid
      window.api.maps.pushGrid({ visible: gridVisible })
      // Re-sync any ambient loops (rain/storm) already toggled on
      if (ambientVfx.rain || ambientVfx.stormLightning) window.api.maps.pushAmbientVfx(ambientVfx)
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  function navigateTo(mapId: string) {
    setMapStack([mapId])
    setActiveTool(null)
    setSelectedPinId(null)
    setCardDetail(null)
    if (presenting) window.api.maps.openPresentation(mapId)
  }

  function drillInto(mapId: string) {
    setMapStack(prev => [...prev, mapId])
    setActiveTool(null)
    setSelectedPinId(null)
    setCardDetail(null)
    if (presenting) window.api.maps.openPresentation(mapId)
  }

  function navigateToCrumb(index: number) {
    const id = mapStack[index]
    setMapStack(prev => prev.slice(0, index + 1))
    setSelectedPinId(null)
    setCardDetail(null)
    if (presenting && id) window.api.maps.openPresentation(id)
  }

  // ── Map CRUD ─────────────────────────────────────────────────────────────

  async function handleNewMap() {
    if (!newMapName.trim()) return
    const created = await window.api.maps.save({ name: newMapName.trim() }) as MapData
    setMaps(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    setMapStack([created.id])
    setNewMapName('')
    setCreatingMap(false)
  }

  async function handleDeleteMap(id: string) {
    if (!confirm('Delete this map and all its pins?')) return
    await window.api.maps.delete(id)
    setMaps(prev => prev.filter(m => m.id !== id))
    if (currentMapId === id) {
      const remaining = maps.filter(m => m.id !== id)
      setMapStack(remaining.length ? [remaining[0].id] : [])
    }
  }

  async function handleUploadImage() {
    if (!currentMap) return
    const path = await window.api.dialog.openMapImage() as string | null
    if (!path) return
    const updated = await window.api.maps.save({ ...currentMap, image_path: path }) as MapData
    setMaps(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  async function handleRenameMap() {
    if (!currentMap || !renameValue.trim()) { setRenamingId(null); return }
    const updated = await window.api.maps.save({ ...currentMap, name: renameValue.trim() }) as MapData
    setMaps(prev => prev.map(m => m.id === updated.id ? updated : m))
    setRenamingId(null)
  }

  async function handleSaveScale(updates: Partial<MapData>) {
    if (!currentMap) return
    const updated = await window.api.maps.save({ ...currentMap, ...updates }) as MapData
    setMaps(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  // ── Pins ─────────────────────────────────────────────────────────────────

  function handleAddPin(x: number, y: number) {
    if (!currentMapId) return
    const tempPin: MapPin = {
      id: '', map_id: currentMapId, x, y, label: '',
      card_id: null, child_map_id: null, color: '#c9a84c', created_at: ''
    }
    setEditingPin(tempPin)
  }

  async function handleSavePin(partial: Partial<MapPin>) {
    if (!editingPin || !currentMapId) return
    const saved = await window.api.maps.savePin({
      ...(editingPin.id ? { id: editingPin.id } : {}),
      map_id: currentMapId,
      x: editingPin.x, y: editingPin.y,
      ...partial
    }) as MapPin
    setPins(prev =>
      editingPin.id
        ? prev.map(p => p.id === saved.id ? saved : p)
        : [...prev, saved]
    )
    setEditingPin(null)
    setSelectedPinId(saved.id)
  }

  async function handleDeletePin() {
    if (!editingPin?.id) return
    await window.api.maps.deletePin(editingPin.id)
    setPins(prev => prev.filter(p => p.id !== editingPin.id))
    setEditingPin(null)
    setSelectedPinId(null)
  }

  async function handleDragPin(id: string, x: number, y: number) {
    const pin = pins.find(p => p.id === id)
    if (!pin) return
    const updated = await window.api.maps.savePin({ ...pin, x, y }) as MapPin
    setPins(prev => prev.map(p => p.id === id ? updated : p))
  }

  async function handleClickPin(pin: MapPin) {
    if (pin.child_map_id) {
      drillInto(pin.child_map_id)
    } else if (pin.card_id) {
      const card = await window.api.cards.get(pin.card_id) as Card
      if (card) setCardDetail(card)
    } else {
      setSelectedPinId(pin.id)
      setEditingPin(pin)
    }
  }

  async function handlePushScene() {
    await window.api.maps.setScene(scene)
  }

  async function handleClearScene() {
    await window.api.maps.clearScene()
  }

  async function handleClearHandout() {
    await window.api.maps.clearHandout()
    setHandoutActive(false)
  }

  const breadcrumbMaps = mapStack
    .map(id => maps.find(m => m.id === id))
    .filter(Boolean) as MapData[]

  // Tool button helper. Most tools just toggle activeTool; fog additionally
  // needs to seed + push an initial fully-fogged state (see
  // handleActivateFogTool), so it passes its own onClick override.
  function toolBtn(tool: MapTool, icon: React.ReactNode, label: string, activeClass: string, onClick?: () => void) {
    const isActive = activeTool === tool
    return (
      <button
        onClick={onClick ?? (() => setActiveTool(isActive ? null : tool))}
        title={label}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
          isActive ? activeClass : 'border-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
        }`}
      >
        {icon} {label}
      </button>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left panel with tabs */}
      <div className="w-52 flex-shrink-0 flex flex-col border-r border-border bg-surface-raised overflow-hidden">
        {/* Tab headers */}
        <div className="flex border-b border-border flex-shrink-0">
          <button
            onClick={() => setActiveTab('maps')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === 'maps'
                ? 'text-amber-300 border-b-2 border-amber-400 -mb-px'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Image size={12} /> Maps
          </button>
          <button
            onClick={() => setActiveTab('scene')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === 'scene'
                ? 'text-amber-300 border-b-2 border-amber-400 -mb-px'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Tv2 size={12} /> Scene
          </button>
        </div>

        {activeTab === 'maps' ? (
          <MapListPanel
            maps={maps}
            currentMapId={currentMapId}
            onSelect={navigateTo}
            onDelete={handleDeleteMap}
            creatingMap={creatingMap}
            newMapName={newMapName}
            onNewMapNameChange={setNewMapName}
            onCreateMap={handleNewMap}
            onCancelCreate={() => { setCreatingMap(false); setNewMapName('') }}
            onStartCreate={() => setCreatingMap(true)}
            className="flex-1 flex flex-col overflow-hidden"
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <p className="text-xs text-slate-500">
              Push an ambient background to the TV when no map is active.
            </p>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Background image</label>
              <div className="flex gap-1.5">
                <input
                  className="input flex-1 text-xs py-1.5 truncate"
                  readOnly
                  placeholder="No image"
                  value={scene.imagePath ? scene.imagePath.split(/[\\/]/).pop() ?? '' : ''}
                />
                <button
                  onClick={async () => {
                    const path = await window.api.dialog.openMapImage()
                    if (path) setScene((s) => ({ ...s, imagePath: path }))
                  }}
                  className="px-2 py-1.5 rounded text-xs border border-border text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors flex-shrink-0"
                  title="Pick image"
                >
                  <ImagePlus size={12} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Title</label>
              <input
                className="input w-full text-sm"
                placeholder="e.g. The Sunken Library"
                value={scene.title ?? ''}
                onChange={(e) => setScene((s) => ({ ...s, title: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Subtitle</label>
              <input
                className="input w-full text-sm"
                placeholder="e.g. late evening"
                value={scene.subtitle ?? ''}
                onChange={(e) => setScene((s) => ({ ...s, subtitle: e.target.value }))}
              />
            </div>

            <button
              onClick={handlePushScene}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs
                         bg-emerald-500/20 border border-emerald-500/40 text-emerald-300
                         hover:bg-emerald-500/30 transition-colors"
            >
              <Tv2 size={12} /> Push to TV
            </button>

            <button
              onClick={handleClearScene}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs
                         border border-border text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors"
            >
              Clear Scene
            </button>

            {handoutActive && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-slate-500 mb-2">Handout active on TV</p>
                <button
                  onClick={handleClearHandout}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs
                             border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  Clear Handout
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-raised flex-shrink-0 gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {breadcrumbMaps.map((m, i) => (
              <span key={m.id} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />}
                {i === breadcrumbMaps.length - 1 ? (
                  renamingId === m.id ? (
                    <span className="flex items-center gap-1">
                      <input
                        className="input py-0.5 text-sm w-40"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameMap(); if (e.key === 'Escape') setRenamingId(null) }}
                        autoFocus
                      />
                      <button onClick={handleRenameMap} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                      <button onClick={() => setRenamingId(null)} className="text-slate-500 hover:text-slate-300"><XIcon size={14} /></button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 group">
                      <span className="text-sm font-semibold text-white truncate">{m.name}</span>
                      <button
                        onClick={() => { setRenamingId(m.id); setRenameValue(m.name) }}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-400 transition-all"
                      >
                        <Pencil size={12} />
                      </button>
                    </span>
                  )
                ) : (
                  <button
                    onClick={() => navigateToCrumb(i)}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors truncate"
                  >
                    {m.name}
                  </button>
                )}
              </span>
            ))}
            {!currentMap && <span className="text-sm text-slate-600">No map selected</span>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
            {currentMap?.image_path && (
              <button onClick={handleUploadImage} className="btn-ghost text-xs py-1.5 flex items-center gap-1.5">
                <ImagePlus size={13} /> Replace
              </button>
            )}
            {currentMap && (
              <button
                onClick={() => setScaleModalOpen(true)}
                title="Map scale settings"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-border text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
              >
                <Settings size={13} />
              </button>
            )}
            {currentMap && toolBtn('fog', <Cloud size={13} />, 'Fog', 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300', handleActivateFogTool)}
            {currentMap && toolBtn('ruler', <Ruler size={13} />, 'Ruler', 'bg-blue-500/20 border-blue-500/40 text-blue-300')}
            {currentMap && (
              <button
                onClick={handleGridToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  gridVisible
                    ? 'bg-green-500/20 border-green-500/40 text-green-300'
                    : 'border-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                <Grid size={13} /> Grid
              </button>
            )}
            {currentMap && toolBtn('spotlight', <Crosshair size={13} />, 'Spotlight', 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300')}
            {currentMap && toolBtn('vfx', <Sparkles size={13} />, 'Effects', 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300')}
            {currentMap && toolBtn('pin', <Pin size={13} />, 'Add Pin', 'bg-amber-500/20 border-amber-500/40 text-amber-300')}
            {currentMap && (
              <button
                onClick={handlePresent}
                title={presenting ? undefined : 'Opens fullscreen on a second display if one is connected. Press F on the TV window to toggle fullscreen, Esc to exit it.'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  presenting
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'border-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                {presenting ? <MonitorOff size={13} /> : <MonitorPlay size={13} />}
                {presenting ? 'Stop' : 'Present'}
              </button>
            )}
          </div>
        </div>

        {/* Fog sub-toolbar */}
        {activeTool === 'fog' && (
          <FogControls
            brushRadius={brushRadius}
            brushMode={brushMode}
            onBrushRadius={setBrushRadius}
            onBrushMode={setBrushMode}
            onRevealAll={handleRevealAll}
            onHideAll={handleHideAll}
          />
        )}

        {/* Ruler sub-toolbar */}
        {activeTool === 'ruler' && (
          <RulerControls
            shareToPlayers={rulerState.shareToPlayers}
            onShareToggle={() => handleRulerChange({ shareToPlayers: !rulerState.shareToPlayers })}
          />
        )}

        {/* VFX sub-toolbar */}
        {activeTool === 'vfx' && (
          <VfxControls
            pendingType={pendingVfxType}
            onPick={handleVfxPick}
            ambientVfx={ambientVfx}
            onToggleAmbient={handleToggleAmbient}
          />
        )}

        {/* Map area */}
        <div className="flex-1 flex overflow-hidden bg-surface-base">
          {currentMap ? (
            <MapCanvas
              map={currentMap}
              pins={pins}
              activeTool={activeTool}
              fog={fog}
              brushRadius={brushRadius}
              brushMode={brushMode}
              onFogChange={handleFogChange}
              onFogSave={handleFogSave}
              rulerState={rulerState}
              onRulerChange={handleRulerChange}
              spotlightPos={spotlightPos}
              onSpotlightSet={handleSpotlightSet}
              gridVisible={gridVisible}
              onPlaceEffect={handlePlaceEffect}
              selectedPinId={selectedPinId}
              onAddPin={handleAddPin}
              onClickPin={handleClickPin}
              onDragPin={handleDragPin}
              onSelectPin={p => setSelectedPinId(p?.id ?? null)}
              onUploadImage={handleUploadImage}
              onNaturalSize={(w) => setNatW(w)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-600 text-sm">Select or create a map to get started.</p>
            </div>
          )}

          {cardDetail && (
            <CardDetail
              card={cardDetail}
              onRefresh={async () => {
                const updated = await window.api.cards.get(cardDetail.id) as Card
                if (updated) setCardDetail(updated)
              }}
            />
          )}
        </div>
      </div>

      {editingPin && (
        <PinEditor
          pin={editingPin}
          maps={maps}
          onSave={handleSavePin}
          onDelete={handleDeletePin}
          onClose={() => { setEditingPin(null); setSelectedPinId(null) }}
        />
      )}

      {scaleModalOpen && currentMap && (
        <ScaleConfigModal
          map={currentMap}
          natW={natW}
          onSave={handleSaveScale}
          onClose={() => setScaleModalOpen(false)}
        />
      )}
    </div>
  )
}
