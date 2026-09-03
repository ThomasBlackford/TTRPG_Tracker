import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Card, PartyMember, SessionNote } from '../../types'

export function SessionEntry({
  note,
  onSaved,
  onClose
}: {
  note: SessionNote | null
  onSaved: (n: SessionNote) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [sessionNumber, setSessionNumber] = useState(String(note?.session_number ?? ''))
  const [sessionDate, setSessionDate] = useState(note?.session_date ?? new Date().toISOString().split('T')[0])
  const [recap, setRecap] = useState(note?.recap ?? note?.content ?? '')
  const [prepNotes, setPrepNotes] = useState(note?.prep_notes ?? '')
  const [linkedCards, setLinkedCards] = useState<string[]>(note?.linked_cards ?? [])
  const [linkedMembers, setLinkedMembers] = useState<string[]>(note?.linked_party_members ?? [])
  const [allCards, setAllCards] = useState<Card[]>([])
  const [allMembers, setAllMembers] = useState<PartyMember[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.cards.list().then(setAllCards)
    window.api.party.getMembers().then(setAllMembers)
  }, [])

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const saved = await window.api.sessions.save({
        ...(note?.id ? { id: note.id } : {}),
        title: title.trim(),
        session_number: sessionNumber ? parseInt(sessionNumber) : null,
        session_date: sessionDate,
        recap,
        prep_notes: prepNotes,
        linked_cards: linkedCards,
        linked_party_members: linkedMembers
      } as Parameters<typeof window.api.sessions.save>[0])
      onSaved(saved)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function toggleCard(id: string) {
    setLinkedCards((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function toggleMember(id: string) {
    setLinkedMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-display text-base font-semibold text-white">
            {note ? 'Edit Session Note' : 'New Session Note'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex gap-3">
            <div className="w-24">
              <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Session #</label>
              <input
                type="number"
                className="input"
                value={sessionNumber}
                onChange={(e) => setSessionNumber(e.target.value)}
                placeholder="—"
                min={1}
              />
            </div>
            <div className="w-44">
              <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Date</label>
              <input
                type="date"
                className="input"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Title *</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What happened this session?"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">
              Recap — what happened
            </label>
            <textarea
              className="input resize-none font-mono text-sm leading-relaxed"
              rows={9}
              value={recap}
              onChange={(e) => setRecap(e.target.value)}
              placeholder="Key decisions, world changes, NPC interactions..."
            />
          </div>

          <div>
            <label className="block text-xs text-amber-500/70 mb-1.5 uppercase tracking-wider font-medium">
              Prep for next time — follow-ups
            </label>
            <textarea
              className="input resize-none font-mono text-sm leading-relaxed bg-amber-500/5 border-amber-500/20 focus:border-amber-500/50"
              rows={5}
              value={prepNotes}
              onChange={(e) => setPrepNotes(e.target.value)}
              placeholder="Loose ends, what to introduce next, NPCs to follow up with. For anything that needs to outlive this one session, add it as a Thread instead."
            />
          </div>

          {allCards.length > 0 && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Linked cards</label>
              <div className="flex flex-wrap gap-1.5">
                {allCards.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleCard(c.id)}
                    className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                      linkedCards.includes(c.id)
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-surface-overlay border-border text-slate-500 hover:text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allMembers.length > 0 && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Party members involved</label>
              <div className="flex flex-wrap gap-1.5">
                {allMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMember(m.id)}
                    className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                      linkedMembers.includes(m.id)
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-surface-overlay border-border text-slate-500 hover:text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={!title.trim() || saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : note ? 'Save Changes' : 'Create Note'}
          </button>
        </div>
      </div>
    </div>
  )
}
