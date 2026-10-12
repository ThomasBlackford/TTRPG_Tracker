import { useEffect, useMemo, useRef, useState } from 'react'
import { Coins as CoinsIcon, Gem, Palette, Wand2, Dices, Send, Users, Check } from 'lucide-react'
import type { ConnectedPlayer, CustomItem } from '../types'
import { bracketForCr, describeCoins, parseCr, rollHoard, rollIndividual, splitCoins } from '../lib/loot'
import type { Coins, LootItem, LootResult } from '../lib/loot'

const RARITY_COLOR: Record<string, string> = {
  common: 'text-slate-300 border-slate-600',
  uncommon: 'text-emerald-300 border-emerald-500/50',
  rare: 'text-sky-300 border-sky-500/50',
  'very rare': 'text-purple-300 border-purple-500/50',
  legendary: 'text-amber-300 border-amber-500/60'
}

const COIN_ORDER = ['pp', 'gp', 'ep', 'sp', 'cp'] as const

export function LootPage() {
  const [mode, setMode] = useState<'individual' | 'hoard'>('hoard')
  const [crText, setCrText] = useState('5')
  const [creatures, setCreatures] = useState('1')
  const [useHomebrew, setUseHomebrew] = useState(true)
  const [homebrew, setHomebrew] = useState<CustomItem[]>([])
  const [result, setResult] = useState<LootResult | null>(null)
  const [players, setPlayers] = useState<ConnectedPlayer[]>([])
  const [targets, setTargets] = useState<string[]>([])
  const [given, setGiven] = useState<Record<string, string>>({}) // item id → who got it
  const [coinsSent, setCoinsSent] = useState(false)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  useEffect(() => {
    window.api.items.list().then(setHomebrew)
    window.api.partySync.status().then((s) => setPlayers(s.players))
    return window.api.partySync.onUpdate((s) => setPlayers(s.players))
  }, [])

  const online = players.filter((p) => p.online)
  const touched = useRef(false)
  useEffect(() => {
    // Recipients default to everyone connected; once the DM picks by hand,
    // only people who have left are dropped.
    const ids = players.filter((p) => p.online).map((p) => p.clientId)
    setTargets((t) => {
      const kept = t.filter((id) => ids.includes(id))
      return touched.current ? kept : ids
    })
  }, [players])

  const cr = parseCr(crText)
  const bracket = useMemo(() => bracketForCr(cr), [cr])

  function flash(text: string, error = false) {
    setStatus({ text, error })
    setTimeout(() => setStatus(null), 4000)
  }

  function doRoll() {
    const pool = useHomebrew
      ? homebrew.map((h) => ({ name: h.name, rarity: h.rarity, category: h.category, description: h.description, damage: h.damage, damage_type: h.damage_type }))
      : []
    setResult(mode === 'hoard' ? rollHoard(cr, Math.random, pool) : rollIndividual(cr, parseInt(creatures) || 1))
    setGiven({})
    setCoinsSent(false)
    setStatus(null)
  }

  function nameOf(clientId: string): string {
    return players.find((p) => p.clientId === clientId)?.snapshot.name || 'player'
  }

  async function sendCoins() {
    if (!result) return
    if (targets.length === 0) return flash('Pick who to split the coins between.', true)
    const shares = splitCoins(result.coins, targets.length)
    let delivered = 0
    for (let i = 0; i < targets.length; i++) {
      const r = await window.api.partySync.command(targets[i], { cmd: 'currency', ...shares[i] })
      if (r.ok) delivered++
    }
    setCoinsSent(delivered > 0)
    flash(delivered > 0 ? `Coins split between ${delivered} player${delivered === 1 ? '' : 's'}.` : 'Nobody received the coins.', delivered === 0)
  }

  async function give(item: LootItem, clientId: string) {
    const notes = item.kind === 'magic' ? item.note : `${item.value} gp ${item.kind === 'gem' ? 'gem' : 'art object'}`
    const r = await window.api.partySync.command(clientId, {
      cmd: 'give_item',
      name: item.name,
      quantity: item.quantity,
      notes,
      damage: item.damage,
      damage_type: item.damage_type
    })
    if (r.ok) setGiven((g) => ({ ...g, [item.id]: nameOf(clientId) }))
    else flash("Couldn't reach that player.", true)
  }

  async function giveAllTo(clientId: string) {
    if (!result) return
    for (const it of [...result.magic, ...result.gems, ...result.art]) if (!given[it.id]) await give(it, clientId)
  }

  function toggleTarget(id: string) {
    touched.current = true
    setTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
  }

  const hasItems = !!result && result.magic.length + result.gems.length + result.art.length > 0
  const everything: LootItem[] = result ? [...result.magic, ...result.gems, ...result.art] : []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        <div>
          <h2 className="font-display text-xl text-white uppercase tracking-widest">Loot</h2>
          <p className="text-slate-500 text-sm mt-0.5">Roll treasure by challenge rating and hand it straight to the players' sheets.</p>
        </div>

        <div className="bg-surface-raised border border-border p-5">
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">Kind</p>
              <div className="flex">
                {(['hoard', 'individual'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setMode(k)}
                    className={`px-4 py-2 text-xs uppercase tracking-wider border transition-colors ${mode === k ? 'bg-amber-500/20 border-amber-500/60 text-white' : 'border-border text-slate-500 hover:text-slate-200'}`}
                  >
                    {k === 'hoard' ? 'Hoard' : 'Individual'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">Challenge rating</p>
              <input className="input w-24 text-center" value={crText} onChange={(e) => setCrText(e.target.value.replace(/[^0-9/.]/g, ''))} placeholder="5 or 1/2" />
            </div>
            {mode === 'individual' && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">Creatures</p>
                <input className="input w-20 text-center" value={creatures} onChange={(e) => setCreatures(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
            )}
            <button onClick={doRoll} className="btn-primary flex items-center gap-2 px-5 py-2.5">
              <Dices size={15} /> {result ? 'Re-roll' : 'Roll treasure'}
            </button>
            <span className="text-xs text-slate-600 pb-2.5">CR {bracket} table</span>
          </div>
          {mode === 'hoard' && (
            <label className="flex items-center gap-2 mt-4 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={useHomebrew} onChange={(e) => setUseHomebrew(e.target.checked)} />
              Mix in my homebrew items ({homebrew.length} saved)
            </label>
          )}
        </div>

        {result && (
          <>
            {/* Recipients */}
            <div className="bg-surface-raised border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-amber-400" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Hand out to</p>
              </div>
              {online.length === 0 ? (
                <p className="text-xs text-slate-600">No players are connected. Start Player Sync on the Party page to send things straight to their sheets — you can still roll and read the treasure here.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {online.map((p) => {
                    const on = targets.includes(p.clientId)
                    return (
                      <button
                        key={p.clientId}
                        onClick={() => toggleTarget(p.clientId)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'border-border text-slate-500 hover:text-slate-300'}`}
                      >
                        {on && <Check size={11} />} {p.snapshot.name || 'Unnamed'}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Coins */}
            <div className="bg-surface-raised border border-border p-5">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <CoinsIcon size={15} className="text-amber-400" />
                <h3 className="font-display text-sm font-semibold text-slate-200 uppercase tracking-wider">Coins</h3>
                <span className="text-xs text-slate-500">worth about {result.totalGp.toLocaleString()} gp in all</span>
                <button
                  onClick={sendCoins}
                  disabled={online.length === 0 || targets.length === 0}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider border border-border text-slate-300 hover:text-white hover:border-amber-500/60 transition-colors disabled:opacity-30"
                >
                  <Send size={11} /> {coinsSent ? 'Sent' : `Split between ${targets.length || 'no one'}`}
                </button>
              </div>
              <div className="flex gap-3 flex-wrap">
                {COIN_ORDER.map((c) => (
                  <div key={c} className={`min-w-[4.5rem] px-3 py-2 border text-center ${result.coins[c as keyof Coins] > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-border opacity-40'}`}>
                    <p className="font-display text-xl text-white">{result.coins[c as keyof Coins].toLocaleString()}</p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">{c}</p>
                  </div>
                ))}
              </div>
              {online.length > 0 && targets.length > 1 && (
                <p className="text-[11px] text-slate-600 mt-3">
                  Each of {targets.length} gets roughly {describeCoins(splitCoins(result.coins, targets.length)[0])}.
                </p>
              )}
            </div>

            {/* Items */}
            {(result.mode === 'hoard' || hasItems) && (
              <div className="bg-surface-raised border border-border p-5">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Wand2 size={15} className="text-amber-400" />
                  <h3 className="font-display text-sm font-semibold text-slate-200 uppercase tracking-wider">Items &amp; valuables</h3>
                  {hasItems && online.length > 0 && (
                    <select
                      className="input !w-auto ml-auto text-xs py-1"
                      value=""
                      onChange={(e) => { if (e.target.value) giveAllTo(e.target.value) }}
                    >
                      <option value="">Give everything to…</option>
                      {online.map((p) => <option key={p.clientId} value={p.clientId}>{p.snapshot.name}</option>)}
                    </select>
                  )}
                </div>

                {!hasItems ? (
                  <p className="text-xs text-slate-600">This hoard has no items or valuables — just coin. Re-roll for another.</p>
                ) : (
                  <div className="space-y-1.5">
                    {everything.map((it) => (
                      <div key={it.id} className="flex items-center gap-3 px-3 py-2 border border-border bg-surface-overlay/40">
                        <span className="flex-shrink-0 text-slate-500">
                          {it.kind === 'magic' ? <Wand2 size={14} /> : it.kind === 'gem' ? <Gem size={14} /> : <Palette size={14} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-100">
                            {it.quantity > 1 && <span className="text-slate-400">{it.quantity} × </span>}
                            {it.name}
                            {it.homebrew && <span className="ml-1.5 text-[9px] uppercase tracking-wider text-amber-400">homebrew</span>}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">{it.kind === 'magic' ? it.note : `${it.value.toLocaleString()} gp each`}</p>
                        </div>
                        {it.rarity && (
                          <span className={`px-1.5 py-0.5 border text-[10px] uppercase tracking-wider flex-shrink-0 ${RARITY_COLOR[it.rarity] ?? RARITY_COLOR.common}`}>{it.rarity}</span>
                        )}
                        {given[it.id] ? (
                          <span className="text-[11px] text-emerald-400 flex-shrink-0 w-28 text-right">→ {given[it.id]}</span>
                        ) : online.length > 0 ? (
                          <select
                            className="input !w-28 text-xs py-1 flex-shrink-0"
                            value=""
                            onChange={(e) => { if (e.target.value) give(it, e.target.value) }}
                          >
                            <option value="">Give to…</option>
                            {online.map((p) => <option key={p.clientId} value={p.clientId}>{p.snapshot.name}</option>)}
                          </select>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {status && <p className={`text-xs ${status.error ? 'text-red-400' : 'text-emerald-400'}`}>{status.text}</p>}
      </div>
    </div>
  )
}
