import { useState } from 'react'
import { Plus, Trash2, Map, ImagePlus, X, Check } from 'lucide-react'
import type { MapData } from '../../types'

export function MapListPanel({
  maps,
  currentMapId,
  onSelect,
  onDelete,
  creatingMap,
  newMapName,
  onNewMapNameChange,
  onCreateMap,
  onCancelCreate,
  onStartCreate,
  className,
}: {
  maps: MapData[]
  currentMapId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  creatingMap: boolean
  newMapName: string
  onNewMapNameChange: (v: string) => void
  onCreateMap: () => void
  onCancelCreate: () => void
  onStartCreate: () => void
  className?: string
}) {
  const [hoverId, setHoverId] = useState<string | null>(null)

  return (
    <div className={className ?? 'w-52 flex-shrink-0 border-r border-border bg-surface-raised flex flex-col h-full'}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Maps</span>
        <button
          onClick={onStartCreate}
          className="text-slate-500 hover:text-amber-400 transition-colors"
          title="New map"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {creatingMap && (
          <div className="px-3 py-2 border-b border-border mb-1">
            <input
              className="input text-sm py-1.5 mb-2"
              value={newMapName}
              onChange={(e) => onNewMapNameChange(e.target.value)}
              placeholder="Map name..."
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') onCreateMap(); if (e.key === 'Escape') onCancelCreate() }}
            />
            <div className="flex gap-1.5">
              <button onClick={onCreateMap} disabled={!newMapName.trim()}
                className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-amber-500/20
                           border border-amber-500/40 text-amber-300 text-xs hover:bg-amber-500/30
                           transition-colors disabled:opacity-40">
                <Check size={12} /> Create
              </button>
              <button onClick={onCancelCreate}
                className="px-2 py-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5
                           border border-border text-xs transition-colors">
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {maps.length === 0 && !creatingMap ? (
          <div className="px-4 py-6 text-center">
            <Map size={28} className="text-slate-700 mx-auto mb-2" />
            <p className="text-slate-600 text-xs">No maps yet</p>
            <button onClick={onStartCreate} className="mt-2 text-xs text-amber-500 hover:text-amber-400 transition-colors">
              Create your first map →
            </button>
          </div>
        ) : (
          maps.map((m) => (
            <div
              key={m.id}
              className="group relative"
              onMouseEnter={() => setHoverId(m.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <button
                onClick={() => onSelect(m.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                  currentMapId === m.id
                    ? 'bg-amber-500/10 text-amber-300 border-r-2 border-amber-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {m.image_path ? (
                  <div className="w-7 h-7 rounded flex-shrink-0 overflow-hidden bg-surface-overlay">
                    <img src={`file:///${m.image_path.replace(/\\/g, '/')}`} alt={m.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded flex-shrink-0 bg-surface-overlay flex items-center justify-center">
                    <ImagePlus size={13} className="text-slate-600" />
                  </div>
                )}
                <span className="truncate flex-1">{m.name}</span>
              </button>

              {hoverId === m.id && currentMapId !== m.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(m.id) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-600
                             hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
