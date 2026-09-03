import { useState, useEffect } from 'react'
import { Plus, Check, Trash2, RotateCcw, Link2, ChevronDown } from 'lucide-react'
import type { Card, PartyMember, Thread } from '../types'
import { CardTypeBadge } from '../components/cards/CardTypeBadge'
import { useUIStore } from '../store/uiStore'

function ThreadRow({
  thread, card, member, onResolve, onReopen, onDelete
}: {
  thread: Thread
  card: Card | null
  member: PartyMember | null
  onResolve: () => void
  onReopen: () => void
  onDelete: () => void
}) {
  const { setCurrentPage, setSelectedCard } = useUIStore()
  const resolved = thread.status === 'resolved'

  return (
    <div className={`group flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors ${
      resolved ? 'bg-surface-raised/50 border-border/60' : 'bg-surface-raised border-border hover:border-slate-600'
    }`}>
      <button
        onClick={resolved ? onReopen : onResolve}
        title={resolved ? 'Reopen' : 'Mark resolved'}
        className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full border flex items-center justify-center transition-colors ${
          resolved
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            : 'border-slate-600 text-transparent hover:border-amber-400 hover:text-amber-400/50'
        }`}
      >
        <Check size={12} />
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-relaxed ${resolved ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
          {thread.text}
        </p>
        {(card || member) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {card && (
              <button
                onClick={() => { setCurrentPage('library'); setSelectedCard(card) }}
                className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <CardTypeBadge type={card.type} />
                <span className="text-xs text-slate-400">{card.name}</span>
              </button>
            )}
            {member && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-surface-overlay border border-border text-slate-400">
                {member.name}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export function ThreadsPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [members, setMembers] = useState<PartyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkedCardId, setLinkedCardId] = useState('')
  const [linkedMemberId, setLinkedMemberId] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [t, c, m] = await Promise.all([
      window.api.threads.list(),
      window.api.cards.list(),
      window.api.party.getMembers()
    ])
    setThreads(t)
    setCards(c)
    setMembers(m)
    setLoading(false)
  }

  async function handleAdd() {
    if (!text.trim()) return
    const created = await window.api.threads.create({
      text: text.trim(),
      linked_card_id: linkedCardId || null,
      linked_member_id: linkedMemberId || null
    })
    setThreads((prev) => [created, ...prev])
    setText('')
    setLinkedCardId('')
    setLinkedMemberId('')
    setLinkOpen(false)
  }

  async function setStatus(id: string, status: 'open' | 'resolved') {
    const updated = await window.api.threads.update(id, { status })
    if (updated) setThreads((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }

  async function handleDelete(id: string) {
    await window.api.threads.delete(id)
    setThreads((prev) => prev.filter((t) => t.id !== id))
  }

  const open = threads.filter((t) => t.status === 'open')
  const resolved = threads.filter((t) => t.status === 'resolved')
  const cardById = (id: string | null) => (id ? cards.find((c) => c.id === id) ?? null : null)
  const memberById = (id: string | null) => (id ? members.find((m) => m.id === id) ?? null : null)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-white">Threads</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Plot hooks, promises, and reminders that need to outlive one session's notes
          </p>
        </div>

        <div className="bg-surface-raised border border-border rounded-xl p-3 mb-6">
          <div className="flex items-center gap-2">
            <input
              className="input text-sm"
              placeholder="Add a plot hook or reminder..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={() => setLinkOpen((v) => !v)}
              title="Link to a card or party member"
              className={`p-2 rounded-lg border transition-colors flex-shrink-0 ${
                linkOpen || linkedCardId || linkedMemberId
                  ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                  : 'border-border text-slate-500 hover:text-slate-300'
              }`}
            >
              <Link2 size={14} />
            </button>
            <button
              onClick={handleAdd}
              disabled={!text.trim()}
              className="btn-primary py-2 px-3 disabled:opacity-40 flex-shrink-0"
            >
              <Plus size={15} />
            </button>
          </div>

          {linkOpen && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
              <select className="input text-xs py-1.5" value={linkedCardId} onChange={(e) => setLinkedCardId(e.target.value)}>
                <option value="">No linked card</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select className="input text-xs py-1.5" value={linkedMemberId} onChange={(e) => setLinkedMemberId(e.target.value)}>
                <option value="">No linked party member</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {open.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-10">
                Nothing open. Jot down a plot hook or reminder above so it doesn't get lost.
              </p>
            ) : (
              <div className="space-y-2">
                {open.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    card={cardById(t.linked_card_id)}
                    member={memberById(t.linked_member_id)}
                    onResolve={() => setStatus(t.id, 'resolved')}
                    onReopen={() => setStatus(t.id, 'open')}
                    onDelete={() => handleDelete(t.id)}
                  />
                ))}
              </div>
            )}

            {resolved.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowResolved((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2"
                >
                  <ChevronDown size={13} className={`transition-transform ${showResolved ? '' : '-rotate-90'}`} />
                  {resolved.length} resolved
                </button>
                {showResolved && (
                  <div className="space-y-2">
                    {resolved.map((t) => (
                      <ThreadRow
                        key={t.id}
                        thread={t}
                        card={cardById(t.linked_card_id)}
                        member={memberById(t.linked_member_id)}
                        onResolve={() => setStatus(t.id, 'resolved')}
                        onReopen={() => setStatus(t.id, 'open')}
                        onDelete={() => handleDelete(t.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
