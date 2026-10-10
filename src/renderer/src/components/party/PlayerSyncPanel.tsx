import { useState, useEffect } from 'react'
import { Radio, Star, Power, Copy, RefreshCw, Lock, Unlock, Zap, Sparkles } from 'lucide-react'
import type { ConnectedPlayer, PartySyncState } from '../../types'
import { ConditionBadge } from '../encounter/ConditionBadge'
import { TableActionModal } from './TableActionModal'
import type { ActionTab } from './TableActionModal'
import { RollLog } from './RollLog'

function lastSeenLabel(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

function ConnectedPlayerRow({ player, onAct }: { player: ConnectedPlayer; onAct: () => void }) {
  const { snapshot, online } = player
  const activeSlots = snapshot.spellSlots.filter((s) => s.max > 0)
  const hpPct = snapshot.hp_max ? Math.min(100, Math.max(0, ((snapshot.hp_current ?? 0) / snapshot.hp_max) * 100)) : 0
  const down = snapshot.hp_current != null && snapshot.hp_current <= 0
  const hpBar = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-400' : 'bg-red-500'

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 border text-xs flex-wrap transition-opacity ${online ? 'bg-surface-overlay/60 border-border' : 'bg-surface-overlay/20 border-border/50 opacity-55'}`}>
      <span
        title={online ? 'Connected' : `Offline — last seen ${lastSeenLabel(player.lastSeen)}`}
        className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-emerald-400' : 'bg-slate-600'}`}
      />
      <div className="w-36 flex-shrink-0 min-w-0">
        <p className="text-slate-100 font-medium truncate flex items-center gap-1">
          {snapshot.name || 'Unnamed'}
          {snapshot.inspiration && <Star size={10} className="text-amber-400 flex-shrink-0" fill="currentColor" />}
        </p>
        <p className="text-[10px] text-slate-500 truncate">
          {online
            ? [snapshot.race, snapshot.class, snapshot.level ? `Lv ${snapshot.level}` : null].filter(Boolean).join(' · ') || '—'
            : `Offline · ${lastSeenLabel(player.lastSeen)}`}
        </p>
      </div>

      {snapshot.hp_max != null && (
        <div className="flex-shrink-0 w-24">
          <div className="relative h-1.5 overflow-hidden bg-surface-base">
            <div className={`absolute left-0 top-0 h-full transition-[width] ${hpBar}`} style={{ width: `${hpPct}%` }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {snapshot.hp_current ?? '—'}/{snapshot.hp_max} HP
            {snapshot.hp_temp > 0 && <span className="text-sky-400"> +{snapshot.hp_temp}</span>}
          </p>
        </div>
      )}

      {down && (
        <span className="flex-shrink-0 text-[10px] uppercase tracking-wider text-red-400" title="Death saves">
          ✓{snapshot.death_save_successes ?? 0} ✗{snapshot.death_save_failures ?? 0}
        </span>
      )}

      {snapshot.ac != null && <span className="flex-shrink-0 text-slate-400">AC {snapshot.ac}</span>}
      {snapshot.initiative != null && <span className="flex-shrink-0 text-slate-400">Init {snapshot.initiative}</span>}

      {snapshot.concentration && (
        <span className="flex-shrink-0 flex items-center gap-1 text-purple-300" title="Concentrating">
          <Sparkles size={10} /> <span className="max-w-[7rem] truncate">{snapshot.concentration}</span>
        </span>
      )}
      {!!snapshot.exhaustion && snapshot.exhaustion > 0 && (
        <span className="flex-shrink-0 text-red-300" title="Exhaustion level">Exh {snapshot.exhaustion}</span>
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
          {snapshot.conditions.map((c) => <ConditionBadge key={c} condition={c} />)}
        </div>
      )}

      <button
        onClick={onAct}
        disabled={!online}
        className="ml-auto flex items-center gap-1 px-2.5 py-1 text-[11px] uppercase tracking-wider border border-border text-slate-400 hover:text-white hover:border-amber-500/60 transition-colors disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-border flex-shrink-0"
      >
        <Zap size={11} /> Act
      </button>
    </div>
  )
}

// Live table control: who's connected, their vitals, and everything the DM can
// push to them. The join code is here too — it's what keeps strangers on the
// same WiFi out of the game.
export function PlayerSyncPanel() {
  const [state, setState] = useState<PartySyncState | null>(null)
  const [starting, setStarting] = useState(false)
  const [modal, setModal] = useState<{ targets: string[]; tab: ActionTab } | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  useEffect(() => {
    window.api.partySync.status().then(setState)
    return window.api.partySync.onUpdate(setState)
  }, [])

  // Keep "offline 12s ago" labels moving without waiting for a server event.
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [])

  if (!state) return null

  async function toggleServer() {
    if (state?.running) {
      await window.api.partySync.stop()
      setState(await window.api.partySync.status())
      return
    }
    setStarting(true)
    const result = await window.api.partySync.start()
    setStarting(false)
    setState(result)
  }

  const onlineCount = state.players.filter((p) => p.online).length
  const onlineIds = state.players.filter((p) => p.online).map((p) => p.clientId)

  return (
    <div className="space-y-5">
      <div className="bg-surface-raised border border-border p-5">
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <Radio size={16} className={state.running ? 'text-emerald-400' : 'text-slate-600'} />
          <h3 className="font-display text-sm font-semibold text-slate-200 uppercase tracking-wider">Player Sync</h3>
          <span className={`text-xs ${state.running ? 'text-emerald-400' : 'text-slate-600'}`}>
            {state.running ? `Running · ${state.address ?? 'no network found'} · ${onlineCount} online` : 'Not running'}
          </span>
          <button
            onClick={toggleServer}
            disabled={starting}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider border transition-colors disabled:opacity-50 ${
              state.running ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'btn-primary'
            }`}
          >
            <Power size={12} /> {state.running ? 'Stop' : starting ? 'Starting…' : 'Start sync'}
          </button>
        </div>

        {state.error && <p className="text-xs text-red-400 mb-3">Couldn't start: {state.error}</p>}

        {state.running ? (
          <>
            <div className="flex items-stretch gap-3 flex-wrap mb-4">
              <div className="flex-1 min-w-[12rem] border border-border bg-surface-overlay/60 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-1">Join code</p>
                <div className="flex items-center gap-3">
                  <span className={`font-display text-3xl tracking-[0.3em] ${state.requireCode ? 'text-white' : 'text-slate-700 line-through'}`}>
                    {state.joinCode}
                  </span>
                  <button
                    title="Copy address and code"
                    onClick={() => {
                      navigator.clipboard.writeText(`${state.address ?? ''}${state.requireCode ? `  code: ${state.joinCode}` : ''}`)
                      setCodeCopied(true)
                      setTimeout(() => setCodeCopied(false), 1500)
                    }}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <Copy size={14} />
                  </button>
                  {codeCopied && <span className="text-[10px] text-emerald-400">copied</span>}
                </div>
              </div>
              <div className="flex flex-col justify-center gap-1.5 text-[11px]">
                <button
                  onClick={() => window.api.partySync.setRequireCode(!state.requireCode)}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  {state.requireCode ? <Lock size={12} className="text-emerald-400" /> : <Unlock size={12} className="text-amber-400" />}
                  {state.requireCode ? 'Code required to join' : 'Anyone on this WiFi can join'}
                </button>
                <button
                  onClick={() => window.api.partySync.regenerateCode()}
                  disabled={!state.requireCode}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors disabled:opacity-30"
                >
                  <RefreshCw size={12} /> New code (disconnects everyone)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {([
                ['roll', 'Request roll'],
                ['reward', 'Award XP / loot'],
                ['hp', 'Damage all'],
                ['handout', 'Send handout']
              ] as [ActionTab, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  disabled={onlineCount === 0}
                  onClick={() => setModal({ targets: onlineIds, tab })}
                  className="px-3 py-1.5 text-[11px] uppercase tracking-wider border border-border text-slate-300 hover:text-white hover:border-amber-500/60 transition-colors disabled:opacity-30"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {state.players.length === 0 ? (
                <p className="text-xs text-slate-600">No players yet — they connect from the chat button in their Companion app.</p>
              ) : (
                state.players.map((p) => (
                  <ConnectedPlayerRow key={p.clientId} player={p} onAct={() => setModal({ targets: [p.clientId], tab: 'hp' })} />
                ))
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-600">
            Start sync so players' LoreKeeper Companion apps can connect over your WiFi, show up here live, and receive
            damage, rolls and handouts from you.
          </p>
        )}
      </div>

      {state.running && <RollLog rolls={state.rolls ?? []} />}

      {modal && (
        <TableActionModal
          players={state.players}
          initialTargets={modal.targets}
          initialTab={modal.tab}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
