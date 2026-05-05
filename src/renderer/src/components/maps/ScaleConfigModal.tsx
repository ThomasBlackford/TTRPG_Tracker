import { useState } from 'react'
import { X as XIcon } from 'lucide-react'
import type { MapData } from '../../types'

interface Props {
  map: MapData
  natW: number
  onSave: (updates: Partial<MapData>) => void
  onClose: () => void
}

export function ScaleConfigModal({ map, natW, onSave, onClose }: Props) {
  const [squaresAcross, setSquaresAcross] = useState(
    natW > 0 && map.scale_pixels_per_unit > 0
      ? String(Math.round(natW / map.scale_pixels_per_unit))
      : ''
  )
  const [feetPerSquare, setFeetPerSquare] = useState(String(map.scale_feet_per_unit ?? 5))
  const [offX, setOffX] = useState(String(Math.round(map.grid_offset_x ?? 0)))
  const [offY, setOffY] = useState(String(Math.round(map.grid_offset_y ?? 0)))

  const squaresNum   = parseFloat(squaresAcross)
  const feetNum      = parseFloat(feetPerSquare)
  const pixPerUnit   = natW > 0 && squaresNum > 0 ? natW / squaresNum : map.scale_pixels_per_unit

  function handleSave() {
    onSave({
      scale_pixels_per_unit: pixPerUnit,
      scale_feet_per_unit:   isNaN(feetNum)  ? 5 : feetNum,
      grid_offset_x:         parseFloat(offX) || 0,
      grid_offset_y:         parseFloat(offY) || 0,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal p-5 max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-cinzel text-base text-amber-300">Map Scale Settings</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <XIcon size={16} />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-slate-400 mb-1">Grid squares across full image width</label>
            <input
              className="input"
              type="number"
              min={1}
              placeholder="e.g. 24"
              value={squaresAcross}
              onChange={(e) => setSquaresAcross(e.target.value)}
            />
            {natW > 0 && squaresNum > 0 && (
              <p className="text-slate-600 text-xs mt-1">
                → {pixPerUnit.toFixed(1)} px per square (natural image)
              </p>
            )}
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Feet per grid square</label>
            <input
              className="input"
              type="number"
              min={1}
              placeholder="5"
              value={feetPerSquare}
              onChange={(e) => setFeetPerSquare(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Grid offset (natural image pixels)</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-slate-500 text-xs">X</label>
                <input className="input mt-0.5" type="number" value={offX} onChange={(e) => setOffX(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-slate-500 text-xs">Y</label>
                <input className="input mt-0.5" type="number" value={offY} onChange={(e) => setOffY(e.target.value)} />
              </div>
            </div>
            <p className="text-slate-600 text-xs mt-1">Nudge the grid to align with map artwork</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost text-sm py-1.5">Cancel</button>
          <button onClick={handleSave} className="btn-primary text-sm py-1.5">Save Settings</button>
        </div>
      </div>
    </div>
  )
}
