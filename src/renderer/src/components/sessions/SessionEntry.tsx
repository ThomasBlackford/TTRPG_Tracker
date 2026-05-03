import { useState } from 'react'
import { X } from 'lucide-react'
import type { SessionNote } from '../../types'

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
  const [content, setContent] = useState(note?.content ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const saved = await window.api.sessions.save({
        ...(note?.id ? { id: note.id } : {}),
        title: title.trim(),
        session_number: sessionNumber ? parseInt(sessionNumber) : null,
        session_date: sessionDate,
        content,
        linked_cards: note?.linked_cards ?? []
      } as Parameters<typeof window.api.sessions.save>[0])
      onSaved(saved)
      onClose()
    } finally {
      setSaving(false)
    }
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
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Notes</label>
            <textarea
              className="input resize-none font-mono text-sm leading-relaxed"
              rows={14}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Session recap, key decisions, world changes, NPC interactions..."
            />
          </div>
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
