import { useState, useEffect, useMemo, useRef } from 'react'
import { confirmAsync } from '../lib/confirm'
import { ChevronLeft, Swords, SkipForward, Dices, Award } from 'lucide-react'
import type { EncounterState, Combatant, PartyMember, ConnectedPlayer } from '../types'
import { CombatantRow } from '../components/encounter/CombatantRow'
import { AddMonsterForm } from '../components/encounter/AddMonsterForm'
import type { MonsterInput } from '../components/encounter/AddMonsterForm'
import { AddPartyMemberList } from '../components/encounter/AddPartyMemberList'
import { rateEncounter } from '../lib/dnd5e'
import type { Difficulty } from '../lib/dnd5e'

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Trivial: 'text-slate-400 border-slate-600',
  Easy: 'text-emerald-300 border-emerald-500/50',
  Medium: 'text-amber-300 border-amber-500/50',
  Hard: 'text-orange-300 border-orange-500/50',
  Deadly: 'text-red-300 border-red-500/60'
}

export function EncounterPage() {
  const [state, setState] = useState<EncounterState | null>(null)
  const [loading, setLoading] = useState(true)
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([])
  const [players, setPlayers] = useState<ConnectedPlayer[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const [manualLevel, setManualLevel] = useState(() => {
    try { return parseInt(localStorage.getItem('lk-party-level') ?? '1', 10) || 1 } catch { return 1 }
  })
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.encounter.getState().then((s) => {
      setState(s)
      setLoading(false)
    })
    window.api.party.getMembers().then(setPartyMembers)
    window.api.partySync.status().then((s) => setPlayers(s.players))
  }, [])

  // Picks up updates that originate elsewhere — e.g. a party member's HP
  // changing because their own Companion app synced a new value.
  useEffect(() => {
    return window.api.encounter.onUpdate((s) => setState(s))
  }, [])

  useEffect(() => window.api.partySync.onUpdate((s) => setPlayers(s.players)), [])

  function flash(text: string) {
    setBanner(text)
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), 6000)
  }

  async function handleStart() {
    setState(await window.api.encounter.start())
  }

  async function handleEnd() {
    if (!(await confirmAsync({ title: 'End this encounter?', message: 'All combatants will be cleared.', confirmLabel: 'End encounter', danger: true }))) return
    setState(await window.api.encounter.end())
  }

  async function handleNext() {
    const s = await window.api.encounter.nextTurn()
    setState(s)
    if (s.expired && s.expired.length > 0) {
      flash(s.expired.map((e) => `${e.label} ended on ${e.name}`).join(' · '))
    }
  }

  async function handlePrev() {
    setState(await window.api.encounter.prevTurn())
  }

  async function handleUpdate(id: string, changes: Partial<Combatant>) {
    const s = await window.api.encounter.updateCombatant(id, changes)
    setState(s)
    return s
  }

  async function handleApplyHp(id: string, amount: number, mode: 'normal' | 'half' | 'double') {
    const s = await window.api.encounter.applyHp(id, amount, mode)
    setState(s)
    if (s.note) flash(s.note)
  }

  async function handleRemove(id: string) {
    setState(await window.api.encounter.removeCombatant(id))
  }

  async function handleAddMonster(data: MonsterInput) {
    const s = await window.api.encounter.addMonster(data)
    setState(s)
    return s
  }

  async function handleAddPartyMember(memberId: string) {
    setState(await window.api.encounter.addPartyMember(memberId))
  }

  async function handleRollMonsters() {
    setState(await window.api.encounter.rollMonsterInitiative({ force: true, grouped: true }))
  }

  const combatants = state?.combatants ?? []

  const liveById = useMemo(() => {
    const m = new Map<string, ConnectedPlayer>()
    for (const p of players) m.set(p.clientId, p)
    return m
  }, [players])

  const rating = useMemo(() => {
    const monsters = combatants.filter((c) => c.type === 'monster')
    const levels = combatants
      .filter((c) => c.type === 'party')
      .map((c) => (c.clientId ? liveById.get(c.clientId)?.snapshot.level : undefined))
      .filter((l): l is number => !!l)
    const partyCount = combatants.filter((c) => c.type === 'party').length
    // Players without a synced level fall back to the manual level.
    const full = levels.length >= partyCount && partyCount > 0 ? levels : [...levels, ...Array(Math.max(0, Math.max(partyCount, 1) - levels.length)).fill(manualLevel)]
    return {
      result: rateEncounter(full, monsters.map((m) => m.xp)),
      usingManual: levels.length < Math.max(partyCount, 1)
    }
  }, [combatants, liveById, manualLevel])

  async function handleAwardXp() {
    const defeated = combatants.filter((c) => c.type === 'monster' && c.hp_current != null && c.hp_current <= 0)
    const pool = (defeated.length > 0 ? defeated : combatants.filter((c) => c.type === 'monster')).reduce((n, c) => n + c.xp, 0)
    const recipients = combatants.filter((c) => c.type === 'party' && c.clientId && liveById.get(c.clientId)?.online)
    if (pool <= 0 || recipients.length === 0) {
      return flash(pool <= 0 ? 'No XP on the monsters in this fight.' : 'No connected players to award.')
    }
    const each = Math.floor(pool / recipients.length)
    const label = defeated.length > 0 ? `${defeated.length} defeated` : 'all monsters'
    if (!(await confirmAsync({
      title: `Award ${each} XP to each of ${recipients.length} players?`,
      message: `${pool} XP from ${label}, split evenly.`,
      confirmLabel: 'Award XP'
    }))) return
    const res = await window.api.partySync.broadcast({ cmd: 'xp', amount: each }, recipients.map((r) => r.clientId!))
    flash(`${each} XP sent to ${res.sent} player${res.sent === 1 ? '' : 's'}.`)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-600 text-sm">Loading…</p>
      </div>
    )
  }

  if (!state?.isActive) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <Swords size={48} className="text-slate-700 mx-auto mb-4" />
          <h2 className="font-display text-xl text-slate-300 mb-2 uppercase tracking-widest">No Active Encounter</h2>
          <p className="text-slate-500 text-sm max-w-xs">
            Start an encounter to bring in the party and track initiative, HP, conditions and timed effects.
          </p>
        </div>
        <button onClick={handleStart} className="btn-primary flex items-center gap-2 px-6 py-3">
          <Swords size={18} /> Start Encounter
        </button>
      </div>
    )
  }

  const { round, currentIndex } = state
  const currentCombatant = combatants[currentIndex]
  const inEncounterIds = new Set(combatants.map((c) => c.party_member_id).filter(Boolean))
  const availablePartyMembers = partyMembers.filter((m) => !inEncounterIds.has(m.id))
  const monsterCount = combatants.filter((c) => c.type === 'monster').length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border bg-surface-raised flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-display text-white font-semibold text-xl tracking-wide uppercase">Round {round}</span>
          {currentCombatant && (
            <span className="text-sm text-slate-400 truncate">
              <span className="text-amber-300">{currentCombatant.name}</span>'s turn
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {rating.result && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 border text-[11px] uppercase tracking-wider ${DIFFICULTY_STYLE[rating.result.rating]}`}
              title={`Easy ${rating.result.thresholds.easy} · Medium ${rating.result.thresholds.medium} · Hard ${rating.result.thresholds.hard} · Deadly ${rating.result.thresholds.deadly} XP\nMonster XP ${rating.result.totalXp} × ${rating.result.multiplier} = ${rating.result.adjustedXp}`}
            >
              <span className="font-semibold">{rating.result.rating}</span>
              <span className="text-slate-500 normal-case tracking-normal">{rating.result.adjustedXp} / {rating.result.thresholds.deadly} XP</span>
              {rating.usingManual && (
                <span className="flex items-center gap-1 normal-case tracking-normal text-slate-500" title="No synced level for some players — using this level for them">
                  lvl
                  <input
                    className="w-8 bg-transparent border-b border-border text-center text-slate-300 focus:outline-none"
                    value={manualLevel}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                      setManualLevel(n)
                      try { localStorage.setItem('lk-party-level', String(n)) } catch { /* ignore */ }
                    }}
                  />
                </span>
              )}
            </div>
          )}
          {monsterCount > 0 && (
            <>
              <button
                onClick={handleRollMonsters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border text-slate-300 hover:text-white hover:border-amber-500/50 transition-colors"
                title="Roll (or re-roll) initiative for every monster, one roll per group"
              >
                <Dices size={13} /> Roll monsters
              </button>
              <button
                onClick={handleAwardXp}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border text-slate-300 hover:text-white hover:border-amber-500/50 transition-colors"
                title="Split the defeated monsters' XP between connected players"
              >
                <Award size={13} /> Award XP
              </button>
            </>
          )}
          <button
            onClick={handlePrev}
            disabled={combatants.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <button
            onClick={handleNext}
            disabled={combatants.length === 0}
            className="btn-primary flex items-center gap-1.5 !px-4 !py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next turn <SkipForward size={13} />
          </button>
          <button
            onClick={handleEnd}
            className="px-3 py-1.5 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            End
          </button>
        </div>
      </div>

      {banner && (
        <div className="px-5 py-2 text-xs text-amber-200 bg-amber-500/10 border-b border-amber-500/30 animate-fade-in flex-shrink-0">
          {banner}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {combatants.length === 0 ? (
            <p className="text-slate-600 text-sm text-center mt-8">No combatants yet. Add monsters on the right.</p>
          ) : (
            combatants.map((c, i) => {
              const p = c.clientId ? liveById.get(c.clientId) : undefined
              return (
                <CombatantRow
                  key={c.id}
                  combatant={c}
                  rank={i + 1}
                  isCurrent={i === currentIndex}
                  live={p ? { ...p.snapshot, online: p.online } : undefined}
                  onUpdate={handleUpdate}
                  onApplyHp={handleApplyHp}
                  onRemove={handleRemove}
                />
              )
            })
          )}
        </div>

        <div className="w-72 flex-shrink-0 border-l border-border bg-surface-raised p-4 overflow-y-auto">
          <AddPartyMemberList available={availablePartyMembers} onAdd={handleAddPartyMember} />
          <AddMonsterForm onAdd={handleAddMonster} />

          <div className="mt-6 pt-4 border-t border-border space-y-1">
            <p className="text-xs text-slate-600"><span className="inline-block w-2 h-2 rounded-full bg-sky-400 mr-1.5" />Party members</p>
            <p className="text-xs text-slate-600"><span className="inline-block w-2 h-2 rounded-full bg-rose-400 mr-1.5" />Monsters</p>
            <p className="text-xs text-slate-600 pt-2">The TV shows HP for party members only.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
