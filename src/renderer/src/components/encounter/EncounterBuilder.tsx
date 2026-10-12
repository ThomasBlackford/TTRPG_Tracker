import { useEffect, useMemo, useState } from 'react'
import { Swords, Plus, Minus, Trash2, Save, Play, Crown, Pencil, X } from 'lucide-react'
import type { ConnectedPlayer, EncounterEntry, EncounterState, PartyMember, SavedEncounter } from '../../types'
import { rateEncounter } from '../../lib/dnd5e'
import type { Difficulty } from '../../lib/dnd5e'
import { entryToEncounterEntry, useMonsterLibrary } from '../../lib/monsterLibrary'
import { MonsterPicker } from './MonsterPicker'
import { confirmAsync } from '../../lib/confirm'

export const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Trivial: 'text-slate-400 border-slate-600',
  Easy: 'text-emerald-300 border-emerald-500/50',
  Medium: 'text-amber-300 border-amber-500/50',
  Hard: 'text-orange-300 border-orange-500/50',
  Deadly: 'text-red-300 border-red-500/60'
}

interface Props {
  partyMembers: PartyMember[]
  players: ConnectedPlayer[]
  onLaunched: (s: EncounterState) => void
}

function summary(entries: EncounterEntry[]): string {
  return entries.map((e) => `${e.count} × ${e.name}`).join(', ') || 'Empty'
}

// The levels the party's difficulty is measured against: each roster member's
// synced level where there is one, otherwise a level the DM sets.
function usePartyLevels(partyMembers: PartyMember[], players: ConnectedPlayer[]) {
  const [manualLevel, setManualLevel] = useState(() => {
    try { return parseInt(localStorage.getItem('lk-party-level') ?? '1', 10) || 1 } catch { return 1 }
  })
  const [fallbackSize, setFallbackSize] = useState(4)
  const byClient = useMemo(() => new Map(players.map((p) => [p.clientId, p.snapshot.level])), [players])

  const levels = useMemo(() => {
    if (partyMembers.length === 0) return Array(fallbackSize).fill(manualLevel) as number[]
    return partyMembers.map((m) => (m.client_id ? byClient.get(m.client_id) : undefined) || manualLevel)
  }, [partyMembers, byClient, manualLevel, fallbackSize])

  function setLevel(n: number) {
    const clamped = Math.max(1, Math.min(20, n))
    setManualLevel(clamped)
    try { localStorage.setItem('lk-party-level', String(clamped)) } catch { /* ignore */ }
  }

  return { levels, manualLevel, setLevel, usingFallbackSize: partyMembers.length === 0, fallbackSize, setFallbackSize }
}

export function EncounterBuilder({ partyMembers, players, onLaunched }: Props) {
  const { library, setCustom } = useMonsterLibrary()
  const [saved, setSaved] = useState<SavedEncounter[]>([])
  const [name, setName] = useState('')
  const [entries, setEntries] = useState<EncounterEntry[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const party = usePartyLevels(partyMembers, players)

  useEffect(() => {
    window.api.savedEncounters.list().then(setSaved)
  }, [])

  const rating = useMemo(
    () => rateEncounter(party.levels, entries.flatMap((e) => Array(e.count).fill(e.xp ?? 0))),
    [party.levels, entries]
  )

  function flash(text: string) {
    setStatus(text)
    setTimeout(() => setStatus(''), 3500)
  }

  function addEntry(next: EncounterEntry) {
    setEntries((list) => {
      const same = list.find((e) => e.name === next.name)
      return same ? list.map((e) => (e === same ? { ...e, count: e.count + next.count } : e)) : [...list, next]
    })
  }

  function setCount(i: number, delta: number) {
    setEntries((list) => list.map((e, idx) => (idx === i ? { ...e, count: Math.max(1, e.count + delta) } : e)))
  }

  async function save() {
    if (entries.length === 0) return flash('Add at least one monster first.')
    const s = await window.api.savedEncounters.save({ id: editingId ?? undefined, name: name.trim() || 'Untitled encounter', entries })
    setSaved((list) => [s, ...list.filter((x) => x.id !== s.id)].sort((a, b) => a.name.localeCompare(b.name)))
    setEditingId(s.id)
    setName(s.name)
    flash(`Saved "${s.name}".`)
  }

  async function launch(list: EncounterEntry[]) {
    if (list.length === 0) return flash('Add at least one monster first.')
    onLaunched(await window.api.encounter.launchEntries(list))
  }

  function edit(s: SavedEncounter) {
    setEditingId(s.id)
    setName(s.name)
    setEntries(s.entries)
  }

  function reset() {
    setEditingId(null)
    setName('')
    setEntries([])
  }

  async function remove(s: SavedEncounter) {
    if (!(await confirmAsync({ title: `Delete "${s.name}"?`, confirmLabel: 'Delete', danger: true }))) return
    await window.api.savedEncounters.delete(s.id)
    setSaved((list) => list.filter((x) => x.id !== s.id))
    if (editingId === s.id) reset()
  }

  async function removeCustom(id: string) {
    await window.api.monsters.delete(id)
    setCustom((list) => list.filter((m) => m.id !== id))
  }

  const t = rating?.thresholds

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6">
        {/* Builder */}
        <div className="space-y-4 order-2 lg:order-1">
          <div>
            <h2 className="font-display text-xl text-white uppercase tracking-widest">Encounter Builder</h2>
            <p className="text-slate-500 text-sm mt-0.5">Plan a fight, see how hard it is for the party, save it, and launch it in one click.</p>
          </div>

          <div className="bg-surface-raised border border-border p-5 space-y-4">
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Encounter name (e.g. Goblin ambush)" value={name} onChange={(e) => setName(e.target.value)} />
              {(editingId || entries.length > 0) && (
                <button onClick={reset} className="btn-ghost !px-3" title="Start a new one"><X size={14} /></button>
              )}
            </div>

            <MonsterPicker library={library} onDeleteCustom={removeCustom} onPick={(m) => addEntry(entryToEncounterEntry(m, 1))} placeholder="Search bestiary to add a monster…" />

            {entries.length === 0 ? (
              <p className="text-xs text-slate-600 py-3">No monsters yet. Search above to add some.</p>
            ) : (
              <div className="space-y-1.5">
                {entries.map((e, i) => (
                  <div key={e.name} className="flex items-center gap-3 px-3 py-2 border border-border bg-surface-overlay/50 text-sm">
                    <span className="flex-1 min-w-0 truncate text-slate-100">
                      {e.name}
                      {(e.legendary_actions ?? 0) > 0 && <Crown size={11} className="inline ml-1.5 text-amber-300" />}
                      <span className="ml-2 text-[11px] text-slate-500">{e.cr ? `CR ${e.cr} · ` : ''}{e.xp ?? 0} XP · AC {e.ac ?? '—'} · {e.hp_max ?? '—'} HP</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCount(i, -1)} className="w-6 h-6 flex items-center justify-center border border-border text-slate-400 hover:text-white"><Minus size={11} /></button>
                      <span className="w-7 text-center text-slate-100">{e.count}</span>
                      <button onClick={() => setCount(i, 1)} className="w-6 h-6 flex items-center justify-center border border-border text-slate-400 hover:text-white"><Plus size={11} /></button>
                    </div>
                    <button onClick={() => setEntries((l) => l.filter((_, idx) => idx !== i))} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Difficulty */}
            <div className="border border-border bg-surface-base/60 p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                {rating ? (
                  <span className={`px-3 py-1 border text-xs uppercase tracking-wider font-semibold ${DIFFICULTY_STYLE[rating.rating]}`}>{rating.rating}</span>
                ) : (
                  <span className="text-xs text-slate-600">Add monsters to see the difficulty</span>
                )}
                {rating && (
                  <span className="text-xs text-slate-400">
                    {rating.totalXp} XP × {rating.multiplier} = <span className="text-white">{rating.adjustedXp}</span> adjusted
                  </span>
                )}
                <span className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
                  {party.usingFallbackSize && (
                    <label className="flex items-center gap-1">
                      party of
                      <input className="w-8 text-center bg-surface-overlay border border-border py-0.5 text-slate-200" value={party.fallbackSize}
                        onChange={(e) => party.setFallbackSize(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))} />
                    </label>
                  )}
                  <label className="flex items-center gap-1" title="Used for anyone without a synced level">
                    level
                    <input className="w-8 text-center bg-surface-overlay border border-border py-0.5 text-slate-200" value={party.manualLevel}
                      onChange={(e) => party.setLevel(parseInt(e.target.value) || 1)} />
                  </label>
                </span>
              </div>

              {rating && t && (
                <div>
                  <div className="relative h-2 bg-surface-overlay overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full transition-[width]"
                      style={{ width: `${Math.min(100, (rating.adjustedXp / (t.deadly * 1.25)) * 100)}%`, background: 'var(--gradient-brand)' }}
                    />
                    {([t.easy, t.medium, t.hard, t.deadly] as number[]).map((x) => (
                      <span key={x} className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${(x / (t.deadly * 1.25)) * 100}%` }} />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                    <span>Easy {t.easy}</span><span>Medium {t.medium}</span><span>Hard {t.hard}</span><span>Deadly {t.deadly}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    {rating.adjustedXp < t.hard
                      ? `${t.hard - rating.adjustedXp} adjusted XP of room before this becomes Hard.`
                      : rating.adjustedXp < t.deadly
                        ? `${t.deadly - rating.adjustedXp} adjusted XP before it becomes Deadly.`
                        : 'Past the Deadly line — expect casualties.'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => launch(entries)} disabled={entries.length === 0} className="btn-primary flex items-center gap-1.5 disabled:opacity-40">
                <Play size={14} /> Launch now
              </button>
              <button onClick={save} disabled={entries.length === 0} className="btn-ghost flex items-center gap-1.5 border !border-border disabled:opacity-40">
                <Save size={14} /> {editingId ? 'Save changes' : 'Save for later'}
              </button>
              {status && <span className="text-xs text-emerald-400">{status}</span>}
            </div>
            <p className="text-[11px] text-slate-600">
              Launching starts the fight with your party, puts the monsters in, rolls their initiative and asks connected players to roll theirs.
            </p>
          </div>
        </div>

        {/* Saved */}
        <div className="space-y-3 order-1 lg:order-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Prepared encounters</p>
          {saved.length === 0 ? (
            <p className="text-xs text-slate-600">Nothing saved yet. Build one on the left, or save a running fight from the Encounter screen.</p>
          ) : (
            saved.map((s) => {
              const r = rateEncounter(party.levels, s.entries.flatMap((e) => Array(e.count).fill(e.xp ?? 0)))
              return (
                <div key={s.id} className={`border p-3 bg-surface-raised ${editingId === s.id ? 'border-amber-500/50' : 'border-border'}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-100 truncate">{s.name}</p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{summary(s.entries)}</p>
                    </div>
                    {r && <span className={`px-1.5 py-0.5 border text-[10px] uppercase tracking-wider flex-shrink-0 ${DIFFICULTY_STYLE[r.rating]}`}>{r.rating}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <button
                      onClick={async () => onLaunched(await window.api.encounter.launchSaved(s.id))}
                      className="btn-primary !py-1 !px-3 text-xs flex items-center gap-1"
                    >
                      <Swords size={12} /> Launch
                    </button>
                    <button onClick={() => edit(s)} className="p-1.5 text-slate-500 hover:text-white border border-border transition-colors" title="Edit"><Pencil size={12} /></button>
                    <button onClick={() => remove(s)} className="p-1.5 text-slate-500 hover:text-red-400 border border-border transition-colors" title="Delete"><Trash2 size={12} /></button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
