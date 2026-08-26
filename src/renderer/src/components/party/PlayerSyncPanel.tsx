import { useState, useEffect } from 'react'
import { Radio } from 'lucide-react'
import type { ConnectedPlayer, PartySyncState } from '../../types'
import { ConditionBadge } from '../encounter/ConditionBadge'

function ConnectedPlayerRow({ player }: { player: ConnectedPlayer }) {
  const { snapshot } = player
  const activeSlots = snapshot.spellSlots.filter((s) => s.max > 0)
  const hpPct = snapshot.hp_max ? Math.min(100, Math.max(0, ((snapshot.hp_current ?? 0) / snapshot.hp_max) * 100)) : 0

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-overlay/50 text-xs flex-wrap">
      <div className="w-32 flex-shrink-0 min-w-0">
        <p className="text-slate-200 font-medium truncate">{snapshot.name || 'Unnamed'}</p>
        <p className="text-[10px] text-slate-600 truncate">
          {[snapshot.race, snapshot.class, snapshot.level ? `Lv ${snapshot.level}` : null].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>

      {snapshot.hp_max != null && (
        <div className="flex-shrink-0 w-20">
          <div className="relative h-1.5 rounded-full overflow-hidden bg-surface-base">
            <div className="absolute left-0 top-0 h-full rounded-full bg-emerald-500" style={{ width: `${hpPct}%` }} />
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{snapshot.hp_current ?? '—'}/{snapshot.hp_max} HP</p>
        </div>
      )}

      {snapshot.ac != null && (
        <span className="flex-shrink-0 text-slate-400">AC {snapshot.ac}</span>
      )}

      {activeSlots.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-1.5 text-slate-500">
          {activeSlots.map((s) => (
            <span key={s.level} title={`Level ${s.level} slots`}>{s.current}/{s.max}<span className="text-slate-700">L{s.level}</span></span>
          ))}
        </div>
      )}

      {snapshot.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 flex-1 min-w-[80px]">
          {snapshot.conditions.map((c) => (
            <ConditionBadge key={c} condition={c} />
          ))}
        </div>
      )}
    </div>
  )
}

// The server start/stop control and address now live in the chat widget
// (bottom-right corner) so they're reachable from anywhere in the app, not
// just this page. This panel is purely a live status readout.
export function PlayerSyncPanel() {
  const [state, setState] = useState<PartySyncState | null>(null)

  useEffect(() => {
    window.api.partySync.status().then(setState)
    return window.api.partySync.onUpdate(setState)
  }, [])

  if (!state) return null

  return (
    <div className="bg-surface-raised border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Radio size={16} className={state.running ? 'text-emerald-400' : 'text-slate-600'} />
        <h3 className="font-display text-sm font-semibold text-slate-200 uppercase tracking-wider">Player Sync</h3>
        <span className={`text-xs ${state.running ? 'text-emerald-400' : 'text-slate-600'}`}>
          {state.running ? `Running · ${state.address}` : 'Not running'}
        </span>
      </div>

      {!state.running ? (
        <p className="text-xs text-slate-600">
          Start sync from the chat button in the bottom-right corner so players' LoreKeeper Companion apps can
          connect over your WiFi and show up here live.
        </p>
      ) : (
        <div className="space-y-2">
          {state.players.length === 0 ? (
            <p className="text-xs text-slate-600">No players connected yet.</p>
          ) : (
            state.players.map((p) => <ConnectedPlayerRow key={p.clientId} player={p} />)
          )}
        </div>
      )}
    </div>
  )
}
