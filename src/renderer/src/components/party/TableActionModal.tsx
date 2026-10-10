import { useState } from 'react'
import { X, Heart, Skull, Dices, Gift, ImageIcon, Check } from 'lucide-react'
import type { ConnectedPlayer, DmCommand, RollKind } from '../../types'
import { ABILITIES, CONDITIONS, SKILLS } from '../../lib/dnd5e'

export type ActionTab = 'hp' | 'condition' | 'reward' | 'roll' | 'handout'

const TABS: { id: ActionTab; label: string; icon: React.ReactNode }[] = [
  { id: 'hp', label: 'Damage / Heal', icon: <Heart size={13} /> },
  { id: 'condition', label: 'Condition', icon: <Skull size={13} /> },
  { id: 'roll', label: 'Request Roll', icon: <Dices size={13} /> },
  { id: 'reward', label: 'Rewards', icon: <Gift size={13} /> },
  { id: 'handout', label: 'Handout', icon: <ImageIcon size={13} /> }
]

interface Props {
  players: ConnectedPlayer[] // everyone who could be a target
  initialTargets: string[] // clientIds pre-selected
  initialTab?: ActionTab
  onClose: () => void
}

// One place for everything the DM can push to a player's sheet or screen.
// Targets are chosen at the top, so the same actions work for one player, a
// few, or the whole table.
export function TableActionModal({ players, initialTargets, initialTab = 'hp', onClose }: Props) {
  const online = players.filter((p) => p.online)
  const [tab, setTab] = useState<ActionTab>(initialTab)
  const [targets, setTargets] = useState<string[]>(initialTargets.filter((id) => online.some((p) => p.clientId === id)))
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  // hp
  const [amount, setAmount] = useState('')
  // condition
  const [condition, setCondition] = useState(CONDITIONS[0])
  // reward
  const [xp, setXp] = useState('')
  const [coins, setCoins] = useState({ pp: '', gp: '', ep: '', sp: '', cp: '' })
  const [itemName, setItemName] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [itemNotes, setItemNotes] = useState('')
  // roll
  const [rollKind, setRollKind] = useState<RollKind>('save')
  const [ability, setAbility] = useState('dex')
  const [skill, setSkill] = useState('perception')
  const [dc, setDc] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  // handout
  const [hoTitle, setHoTitle] = useState('')
  const [hoText, setHoText] = useState('')
  const [hoImage, setHoImage] = useState<string | null>(null)

  const noTargets = targets.length === 0

  function toggle(id: string) {
    setTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
  }

  async function sendAll(command: DmCommand, what: string) {
    if (noTargets) return setStatus({ text: 'Pick at least one connected player.', error: true })
    const res = await window.api.partySync.broadcast(command, targets)
    setStatus(
      res.sent > 0
        ? { text: `${what} → ${res.sent} player${res.sent === 1 ? '' : 's'}.` }
        : { text: 'Nobody received it — they may have disconnected.', error: true }
    )
  }

  const num = (s: string) => {
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? n : 0
  }

  async function sendHp(sign: 1 | -1) {
    const n = Math.abs(num(amount))
    if (!n) return setStatus({ text: 'Enter an amount first.', error: true })
    await sendAll({ cmd: 'hp_delta', amount: sign * n }, sign < 0 ? `${n} damage` : `${n} healing`)
  }

  async function sendReward() {
    const coinPayload = {
      pp: num(coins.pp), gp: num(coins.gp), ep: num(coins.ep), sp: num(coins.sp), cp: num(coins.cp)
    }
    let sentAny = false
    if (num(xp)) { await sendAll({ cmd: 'xp', amount: num(xp) }, `${num(xp)} XP`); sentAny = true }
    if (Object.values(coinPayload).some((v) => v)) { await sendAll({ cmd: 'currency', ...coinPayload }, 'Coins'); sentAny = true }
    if (itemName.trim()) {
      await sendAll({ cmd: 'give_item', name: itemName.trim(), quantity: Math.max(1, num(itemQty) || 1), notes: itemNotes.trim() }, itemName.trim())
      sentAny = true
    }
    if (!sentAny) setStatus({ text: 'Nothing to send yet.', error: true })
  }

  async function sendRoll() {
    let label = customLabel.trim()
    if (!label) {
      if (rollKind === 'save') label = `${ABILITIES.find((a) => a.key === ability)?.label} saving throw`
      else if (rollKind === 'check') label = `${ABILITIES.find((a) => a.key === ability)?.label} check`
      else if (rollKind === 'skill') label = `${SKILLS.find((s) => s.key === skill)?.label} check`
      else if (rollKind === 'initiative') label = 'Initiative'
      else label = 'Roll'
    }
    const dcNum = dc.trim() ? num(dc) : null
    await sendAll(
      {
        cmd: 'roll_request',
        rollId: crypto.randomUUID(),
        label,
        kind: rollKind,
        ability: rollKind === 'save' || rollKind === 'check' ? ability : undefined,
        skill: rollKind === 'skill' ? skill : undefined,
        dc: dcNum
      },
      label
    )
  }

  async function pickImage() {
    const p = await window.api.dialog.openImage()
    if (p) setHoImage(p)
  }

  async function sendHandout() {
    if (!hoTitle.trim() && !hoText.trim() && !hoImage) return setStatus({ text: 'Add a title, text or image.', error: true })
    if (noTargets) return setStatus({ text: 'Pick at least one connected player.', error: true })
    const res = await window.api.partySync.handout(targets, { title: hoTitle.trim() || 'Handout', text: hoText.trim(), imagePath: hoImage })
    setStatus(
      res.error ? { text: res.error, error: true }
        : res.sent > 0 ? { text: `Handout shown to ${res.sent} player${res.sent === 1 ? '' : 's'}.` }
        : { text: 'Nobody received it.', error: true }
    )
  }

  return (
    <div className="modal-backdrop p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal max-w-xl max-h-[88vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-display text-base font-semibold text-white tracking-wide uppercase">Table Control</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors"><X size={17} /></button>
        </div>

        {/* Targets */}
        <div className="px-5 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Send to</p>
            <div className="flex gap-3 text-[11px]">
              <button className="text-amber-400 hover:text-amber-300" onClick={() => setTargets(online.map((p) => p.clientId))}>All online</button>
              <button className="text-slate-500 hover:text-slate-300" onClick={() => setTargets([])}>None</button>
            </div>
          </div>
          {online.length === 0 ? (
            <p className="text-xs text-slate-600">No players are connected right now.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {online.map((p) => {
                const on = targets.includes(p.clientId)
                return (
                  <button
                    key={p.clientId}
                    onClick={() => toggle(p.clientId)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs border transition-colors ${
                      on ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'border-border text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {on && <Check size={11} />}
                    {p.snapshot.name || 'Unnamed'}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex border-b border-border flex-shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setStatus(null) }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] uppercase tracking-wider whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.id ? 'text-white border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === 'hp' && (
            <div className="space-y-3">
              <input
                className="input text-lg font-display text-center"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && sendHp(-1)}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-danger" onClick={() => sendHp(-1)}>Deal damage</button>
                <button className="btn-primary" onClick={() => sendHp(1)}>Heal</button>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Applied on the player's own sheet — temporary HP absorbs damage first, and it shows up in their log.
              </p>
            </div>
          )}

          {tab === 'condition' && (
            <div className="space-y-3">
              <select className="input" value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary" onClick={() => sendAll({ cmd: 'condition', condition, on: true }, `${condition} applied`)}>Apply</button>
                <button className="btn-ghost" onClick={() => sendAll({ cmd: 'condition', condition, on: false }, `${condition} removed`)}>Remove</button>
              </div>
            </div>
          )}

          {tab === 'roll' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={rollKind} onChange={(e) => setRollKind(e.target.value as RollKind)}>
                  <option value="save">Saving throw</option>
                  <option value="check">Ability check</option>
                  <option value="skill">Skill check</option>
                  <option value="initiative">Initiative</option>
                  <option value="custom">Flat d20</option>
                </select>
                {(rollKind === 'save' || rollKind === 'check') && (
                  <select className="input" value={ability} onChange={(e) => setAbility(e.target.value)}>
                    {ABILITIES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                )}
                {rollKind === 'skill' && (
                  <select className="input" value={skill} onChange={(e) => setSkill(e.target.value)}>
                    {SKILLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="DC (optional)" value={dc} onChange={(e) => setDc(e.target.value.replace(/[^0-9]/g, ''))} />
                <input className="input" placeholder="Label (optional)" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
              </div>
              <button className="btn-primary w-full" onClick={sendRoll}>Request roll</button>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Each player gets a prompt with their own modifier already worked out. Results come back to the roll log
                on the Party page, marked pass/fail if you set a DC.
              </p>
            </div>
          )}

          {tab === 'reward' && (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">Experience</p>
                <input className="input" placeholder="XP each" value={xp} onChange={(e) => setXp(e.target.value.replace(/[^0-9-]/g, ''))} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">Coins (each)</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((k) => (
                    <input
                      key={k}
                      className="input text-center"
                      placeholder={k.toUpperCase()}
                      value={coins[k]}
                      onChange={(e) => setCoins((c) => ({ ...c, [k]: e.target.value.replace(/[^0-9-]/g, '') }))}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">Item</p>
                <div className="grid grid-cols-[1fr_4rem] gap-1.5 mb-1.5">
                  <input className="input" placeholder="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                  <input className="input text-center" placeholder="Qty" value={itemQty} onChange={(e) => setItemQty(e.target.value.replace(/[^0-9]/g, ''))} />
                </div>
                <input className="input" placeholder="Notes (optional)" value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} />
              </div>
              <button className="btn-primary w-full" onClick={sendReward}>Send rewards</button>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
                <button className="btn-ghost text-xs" onClick={() => sendAll({ cmd: 'inspiration', on: true }, 'Inspiration')}>Grant inspiration</button>
                <button className="btn-ghost text-xs" onClick={() => sendAll({ cmd: 'rest', kind: 'short' }, 'Short rest')}>Short rest</button>
                <button className="btn-ghost text-xs" onClick={() => sendAll({ cmd: 'rest', kind: 'long' }, 'Long rest')}>Long rest</button>
              </div>
            </div>
          )}

          {tab === 'handout' && (
            <div className="space-y-3">
              <input className="input" placeholder="Title" value={hoTitle} onChange={(e) => setHoTitle(e.target.value)} />
              <textarea className="input resize-none" rows={4} placeholder="Text the players should read…" value={hoText} onChange={(e) => setHoText(e.target.value)} />
              <div className="flex items-center gap-2">
                <button className="btn-ghost text-xs" onClick={pickImage}>{hoImage ? 'Change image' : 'Attach image'}</button>
                {hoImage && (
                  <>
                    <span className="text-[11px] text-slate-500 truncate flex-1">{hoImage.split(/[\\/]/).pop()}</span>
                    <button className="text-slate-500 hover:text-slate-200" onClick={() => setHoImage(null)}><X size={13} /></button>
                  </>
                )}
              </div>
              <button className="btn-primary w-full" onClick={sendHandout}>Show to players</button>
            </div>
          )}

          {status && (
            <p className={`text-xs ${status.error ? 'text-red-400' : 'text-emerald-400'}`}>{status.text}</p>
          )}
        </div>
      </div>
    </div>
  )
}
