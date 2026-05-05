import { useState, useEffect } from 'react'
import { X, Search, Layers, MapPin as MapPinIcon, Tag } from 'lucide-react'
import type { MapPin, MapData, SearchResult } from '../../types'

const PIN_COLORS = ['#c9a84c', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#ec4899', '#94a3b8']

type LinkMode = 'label' | 'card' | 'map'

export function PinEditor({
  pin,
  maps,
  onSave,
  onDelete,
  onClose
}: {
  pin: MapPin
  maps: MapData[]
  onSave: (updated: Partial<MapPin>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [label, setLabel] = useState(pin.label)
  const [color, setColor] = useState(pin.color)
  const [linkMode, setLinkMode] = useState<LinkMode>(
    pin.child_map_id ? 'map' : pin.card_id ? 'card' : 'label'
  )
  const [cardId, setCardId] = useState<string | null>(pin.card_id)
  const [cardLabel, setCardLabel] = useState('')
  const [childMapId, setChildMapId] = useState<string | null>(pin.child_map_id)
  const [cardSearch, setCardSearch] = useState('')
  const [cardResults, setCardResults] = useState<SearchResult[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!cardSearch.trim()) { setCardResults([]); return }
    const t = setTimeout(async () => {
      const results = await window.api.search.query(cardSearch)
      setCardResults(results.slice(0, 8))
    }, 200)
    return () => clearTimeout(t)
  }, [cardSearch])

  function selectCard(r: SearchResult) {
    setCardId(r.id)
    setCardLabel(r.name)
    if (!label) setLabel(r.name)
    setCardSearch('')
    setCardResults([])
  }

  async function handleSave() {
    if (!label.trim() && linkMode === 'label') return
    setSaving(true)
    onSave({
      label: label.trim(),
      color,
      card_id: linkMode === 'card' ? cardId : null,
      child_map_id: linkMode === 'map' ? childMapId : null
    })
  }

  const isNew = !pin.created_at

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-display text-sm font-semibold text-white">
            {isNew ? 'New Pin' : 'Edit Pin'}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Label</label>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Pin name..."
              autoFocus
            />
          </div>

          {/* Link type */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Links to</label>
            <div className="flex gap-2">
              {([
                { mode: 'label' as LinkMode, icon: <Tag size={13} />, label: 'Label only' },
                { mode: 'card'  as LinkMode, icon: <MapPinIcon size={13} />, label: 'Card' },
                { mode: 'map'   as LinkMode, icon: <Layers size={13} />, label: 'Child map' }
              ]).map(({ mode, icon, label: ml }) => (
                <button
                  key={mode}
                  onClick={() => setLinkMode(mode)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs border transition-colors ${
                    linkMode === mode
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'border-border text-slate-500 hover:text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {icon} {ml}
                </button>
              ))}
            </div>
          </div>

          {/* Card search */}
          {linkMode === 'card' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Linked Card</label>
              {cardId ? (
                <div className="flex items-center gap-2 p-2 bg-surface-overlay border border-border rounded-lg">
                  <span className="text-sm text-slate-200 flex-1 truncate">{cardLabel || cardId}</span>
                  <button onClick={() => { setCardId(null); setCardLabel('') }} className="text-slate-500 hover:text-red-400 transition-colors">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-8"
                      value={cardSearch}
                      onChange={(e) => setCardSearch(e.target.value)}
                      placeholder="Search cards..."
                    />
                  </div>
                  {cardResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-surface-overlay border border-border rounded-lg overflow-hidden shadow-xl">
                      {cardResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => selectCard(r)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                        >
                          <span className={`badge-${r.type} text-xs px-1.5 py-0.5 rounded-full`}>{r.type}</span>
                          <span className="text-sm text-slate-200 truncate">{r.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Map drilldown */}
          {linkMode === 'map' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Child Map</label>
              <select
                className="input appearance-none"
                value={childMapId ?? ''}
                onChange={(e) => setChildMapId(e.target.value || null)}
              >
                <option value="" className="bg-surface-overlay">— Select a map —</option>
                {maps.filter((m) => m.id !== pin.map_id).map((m) => (
                  <option key={m.id} value={m.id} className="bg-surface-overlay">{m.name}</option>
                ))}
              </select>
              {maps.length <= 1 && (
                <p className="text-xs text-slate-600 mt-1.5">Create another map first to link to it.</p>
              )}
            </div>
          )}

          {/* Color */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PIN_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          {!isNew ? (
            <button onClick={onDelete} className="btn-danger text-xs py-1.5">Delete Pin</button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-xs py-1.5">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || (!label.trim()) || (linkMode === 'card' && !cardId) || (linkMode === 'map' && !childMapId)}
              className="btn-primary text-xs py-1.5 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isNew ? 'Place Pin' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
