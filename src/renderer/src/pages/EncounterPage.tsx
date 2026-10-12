import { useState, useEffect, useMemo, useRef } from 'react'
import { confirmAsync } from '../lib/confirm'
import { ChevronLeft, Swords, SkipForward, Dices, Award, Undo2, Redo2, Hand, Save, Landmark, X } from 'lucide-react'
import type { EncounterState, Combatant, PartyMember, ConnectedPlayer, RollResult } from '../types'
import { CombatantRow } from '../components/encounter/CombatantRow'
import { AddMonsterForm } from '../components/encounter/AddMonsterForm'
import type { MonsterInput } from '../components/encounter/AddMonsterForm'
import { AddPartyMemberList } from '../components/encounter/AddPartyMemberList'
import { EncounterBuilder, DIFFICULTY_STYLE } from '../components/encounter/EncounterBuilder'
import { ConcentrationChecks } from '../components/encounter/ConcentrationChecks'
import type { PendingCheck } from '../components/encounter/ConcentrationChecks'
import { CombatLogPanel } from '../components/encounter/CombatLogPanel'
import { rateEncounter } from '../lib/dnd5e'

export function EncounterPage() {
  const [state, setState] = useState<EncounterState | null>(null)
  const [loading, setLoading] = useState(true)
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([])
  const [players, setPlayers] = useState<ConnectedPlayer[]>([])
  const [rolls, setRolls] = useState<RollResult[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const [checks, setChecks] = useState<PendingCheck[]>([])
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
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
    window.api.partySync.status().then((s) => { setPlayers(s.players); setRolls(s.rolls ?? []) })
  }, [])

  // Picks up updates that originate elsewhere — e.g. a party member's HP
  // changing because their own Companion app synced a new value.
  useEffect(() => {
    return window.api.encounter.onUpdate((s) => { if (s) setState(s) })
  }, [])

  useEffect(() => window.api.partySync.onUpdate((s) => { setPlayers(s.players); setRolls(s.rolls ?? []) }), [])

  function flash(text: string) {
    setBanner(text)
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), 7000)
  }

  async function handleStart() {
    setState(await window.api.encounter.start())
    setChecks([])
  }

  async function handleEnd() {
    if (!(await confirmAsync({ title: 'End this encounter?', message: 'All combatants will be cleared. The log of the fight is kept.', confirmLabel: 'End encounter', danger: true }))) return
    setState(await window.api.encounter.end())
    setChecks([])
  }

  async function handleNext() {
    const s = await window.api.encounter.nextTurn()
    setState(s)
    const lines: string[] = []
    if (s.expired?.length) lines.push(s.expired.map((e) => `${e.label} ended on ${e.name}`).join(' · '))
    if (s.recharged?.length) lines.push(s.recharged.map((r) => `${r.name}'s ${r.ability}: rolled ${r.roll} — ${r.ready ? 'recharged!' : 'still spent'}`).join(' · '))
    if (s.lair) lines.push(`${s.lair}: take the lair action now.`)
    if (lines.length) flash(lines.join('   |   '))
  }

  async function handlePrev() {
    setState(await window.api.encounter.prevTurn())
  }

  async function handleUpdate(id: string, changes: Partial<Combatant>, label?: string) {
    const s = await window.api.encounter.updateCombatant(id, changes, label)
    setState(s)
    return s
  }

  async function handleApplyHp(id: string, amount: number, mode: 'normal' | 'half' | 'double', sourceId?: string | null) {
    const s = await window.api.encounter.applyHp(id, amount, mode, sourceId)
    setState(s)
    if (s.note) flash(s.note)
    if (s.concentrationCheck) {
      const check: PendingCheck = { ...s.concentrationCheck, at: Date.now() }
      setChecks((list) => [...list.filter((c) => c.combatantId !== check.combatantId), check])
    }
  }

  async function handleResolveCheck(check: PendingCheck, passed: boolean) {
    setState(await window.api.encounter.resolveConcentration(check.combatantId, passed))
    setChecks((list) => list.filter((c) => c !== check))
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

  async function handleAskInitiative() {
    const { asked } = await window.api.encounter.requestInitiative({ all: true })
    flash(asked > 0 ? `Asked ${asked} player${asked === 1 ? '' : 's'} to roll initiative.` : 'No connected players to ask.')
  }

  async function handleUndo() {
    if (!state?.undo.canUndo) return
    const s = await window.api.encounter.undo()
    setState(s)
    if (s.note) flash(s.note)
  }

  async function handleRedo() {
    if (!state?.undo.canRedo) return
    const s = await window.api.encounter.redo()
    setState(s)
    if (s.note) flash(s.note)
  }

  async function handleSave() {
    const res = await window.api.encounter.saveCurrent(saveName.trim() || 'Encounter')
    setSaving(false)
    setSaveName('')
    flash(res.entries > 0 ? 'Saved to your prepared encounters.' : 'There were no monsters to save.')
  }

  async function handleToTimeline() {
    const { title, body } = await window.api.encounter.summary()
    await window.api.timeline.save({ title, description: body })
    flash('Fight summary added to the Timeline.')
  }

  // Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) — but not while typing in a field.
  const undoRef = useRef({ handleUndo, handleRedo })
  undoRef.current = { handleUndo, handleRedo }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoRef.current.handleUndo() }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); undoRef.current.handleRedo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const combatants = state?.combatants ?? []

  const liveById = useMemo(() => {
    const m = new Map<string, ConnectedPlayer>()
    for (const p of players) m.set(p.clientId, p)
    return m
  }, [players])

  const rating = useMemo(() => {
    const monsters = combatants.filter((c) => c.type === 'monster' && !c.is_lair)
    const party = combatants.filter((c) => c.type === 'party' && !c.companion_id)
    const levels = party
      .map((c) => (c.clientId ? liveById.get(c.clientId)?.snapshot.level : undefined))
      .filter((l): l is number => !!l)
    const partyCount = party.length
    // Players without a synced level fall back to the manual level.
    const full = levels.length >= partyCount && partyCount > 0 ? levels : [...levels, ...Array(Math.max(0, Math.max(partyCount, 1) - levels.length)).fill(manualLevel)]
    return {
      result: rateEncounter(full, monsters.map((m) => m.xp)),
      usingManual: levels.length < Math.max(partyCount, 1)
    }
  }, [combatants, liveById, manualLevel])

  async function handleAwardXp() {
    const monsters = combatants.filter((c) => c.type === 'monster' && !c.is_lair)
    const defeated = monsters.filter((c) => c.hp_current != null && c.hp_current <= 0)
    const pool = (defeated.length > 0 ? defeated : monsters).reduce((n, c) => n + c.xp, 0)
    const recipients = combatants.filter((c) => c.type === 'party' && !c.companion_id && c.clientId && liveById.get(c.clientId)?.online)
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-surface-raised flex-shrink-0">
          <div className="flex items-center gap-3">
            <Swords size={20} className="text-slate-500" />
            <p className="text-sm text-slate-400">No fight running. Start one now, or plan one below.</p>
          </div>
          <button onClick={handleStart} className="btn-primary flex items-center gap-2 px-5 py-2.5">
            <Swords size={16} /> Start empty encounter
          </button>
        </div>
        <EncounterBuilder
          partyMembers={partyMembers}
          players={players}
          onLaunched={(s) => { setState(s); setChecks([]) }}
        />
      </div>
    )
  }

  const { round, currentIndex } = state
  const currentCombatant = combatants[currentIndex]
  const inEncounterIds = new Set(combatants.map((c) => c.party_member_id).filter(Boolean))
  const availablePartyMembers = partyMembers.filter((m) => !inEncounterIds.has(m.id))
  const monsterCount = combatants.filter((c) => c.type === 'monster' && !c.is_lair).length
  const ownerName = (id: string | null) => (id ? liveById.get(id)?.snapshot.name : undefined)

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

          <div className="flex items-center">
            <button
              onClick={handleUndo}
              disabled={!state.undo.canUndo}
              title={state.undo.canUndo ? `Undo: ${state.undo.undoLabel}  (Ctrl+Z)` : 'Nothing to undo'}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border text-slate-300 hover:text-white hover:border-amber-500/50 transition-colors disabled:opacity-30 disabled:hover:text-slate-300 disabled:hover:border-border"
            >
              <Undo2 size={13} /> Undo
            </button>
            <button
              onClick={handleRedo}
              disabled={!state.undo.canRedo}
              title={state.undo.canRedo ? `Redo: ${state.undo.redoLabel}  (Ctrl+Y)` : 'Nothing to redo'}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-l-0 border-border text-slate-300 hover:text-white hover:border-amber-500/50 transition-colors disabled:opacity-30 disabled:hover:text-slate-300 disabled:hover:border-border"
            >
              <Redo2 size={13} />
            </button>
          </div>

          <button
            onClick={handleAskInitiative}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border text-slate-300 hover:text-white hover:border-amber-500/50 transition-colors"
            title="Ask every connected player to roll initiative on their own device"
          >
            <Hand size={13} /> Ask for initiative
          </button>
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
        <div className="flex-1 overflow-y-auto p-4">
          <ConcentrationChecks
            checks={checks}
            combatants={combatants}
            rolls={rolls}
            onResolve={handleResolveCheck}
            onDismiss={(c) => setChecks((list) => list.filter((x) => x !== c))}
          />
          <div className="space-y-2">
            {combatants.length === 0 ? (
              <p className="text-slate-600 text-sm text-center mt-8">No combatants yet. Add monsters on the right.</p>
            ) : (
              combatants.map((c, i) => {
                const p = c.clientId && !c.companion_id ? liveById.get(c.clientId) : undefined
                return (
                  <CombatantRow
                    key={c.id}
                    combatant={c}
                    rank={i + 1}
                    isCurrent={i === currentIndex}
                    live={p ? { ...p.snapshot, online: p.online } : undefined}
                    ownerName={c.companion_id ? ownerName(c.owner_client_id) : undefined}
                    attackerId={currentCombatant && !currentCombatant.is_lair ? currentCombatant.id : null}
                    onUpdate={handleUpdate}
                    onApplyHp={handleApplyHp}
                    onRemove={handleRemove}
                    onState={setState}
                  />
                )
              })
            )}
          </div>
        </div>

        <div className="w-72 flex-shrink-0 border-l border-border bg-surface-raised p-4 overflow-y-auto">
          <AddPartyMemberList available={availablePartyMembers} onAdd={handleAddPartyMember} />
          <AddMonsterForm onAdd={handleAddMonster} />

          <button
            onClick={async () => setState(await window.api.encounter.addLair())}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] uppercase tracking-wider border border-border text-slate-500 hover:text-white hover:border-purple-400/60 transition-colors"
            title="A turn on initiative 20 reminding you the lair acts"
          >
            <Landmark size={11} /> Add lair actions
          </button>

          <div className="mt-4 pt-4 border-t border-border space-y-2">
            {saving ? (
              <div className="flex items-center gap-1.5">
                <input
                  className="input text-xs py-1 flex-1 min-w-0"
                  placeholder="Name this encounter"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaving(false) }}
                  autoFocus
                />
                <button onClick={handleSave} className="text-xs text-amber-400 hover:text-amber-300 px-1">Save</button>
                <button onClick={() => setSaving(false)} className="text-slate-600 hover:text-slate-300"><X size={12} /></button>
              </div>
            ) : (
              monsterCount > 0 && (
                <button
                  onClick={() => setSaving(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] uppercase tracking-wider border border-border text-slate-500 hover:text-white hover:border-slate-500 transition-colors"
                >
                  <Save size={11} /> Save as prepared encounter
                </button>
              )
            )}
            <button
              onClick={handleToTimeline}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] uppercase tracking-wider border border-border text-slate-500 hover:text-white hover:border-slate-500 transition-colors"
              title="Write this fight's highlights onto the Timeline"
            >
              Add fight to Timeline
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-border space-y-1">
            <p className="text-xs text-slate-600"><span className="inline-block w-2 h-2 rounded-full bg-sky-400 mr-1.5" />Party members</p>
            <p className="text-xs text-slate-600"><span className="inline-block w-2 h-2 rounded-full bg-teal-400 mr-1.5" />Companions &amp; summons</p>
            <p className="text-xs text-slate-600"><span className="inline-block w-2 h-2 rounded-full bg-rose-400 mr-1.5" />Monsters</p>
            <p className="text-xs text-slate-600 pt-2">The TV shows HP for party members only.</p>
          </div>

          <CombatLogPanel />
        </div>
      </div>
    </div>
  )
}
