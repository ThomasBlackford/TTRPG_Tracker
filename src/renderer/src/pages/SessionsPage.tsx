import { useState, useEffect } from 'react'
import { Plus, ScrollText, Trash2, Edit } from 'lucide-react'
import type { SessionNote } from '../types'
import { SessionEntry } from '../components/sessions/SessionEntry'

export function SessionsPage() {
  const [notes, setNotes] = useState<SessionNote[]>([])
  const [loading, setLoading] = useState(true)
  const [formNote, setFormNote] = useState<SessionNote | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadNotes()
  }, [])

  async function loadNotes() {
    setLoading(true)
    const data = await window.api.sessions.list()
    setNotes(data)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this session note?')) return
    await window.api.sessions.delete(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  function openNew() {
    setFormNote(null)
    setShowForm(true)
  }

  function openEdit(note: SessionNote) {
    setFormNote(note)
    setShowForm(true)
  }

  async function handleSaved(_note: SessionNote) {
    await loadNotes()
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Session Log</h2>
            <p className="text-slate-500 text-sm mt-0.5">{notes.length} session{notes.length !== 1 ? 's' : ''} recorded</p>
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={14} />
            New Session
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-16">
            <ScrollText size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No sessions logged yet.</p>
            <button onClick={openNew} className="mt-3 text-amber-400 hover:text-amber-300 text-sm transition-colors">
              Log your first session →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="group bg-surface-raised border border-border rounded-xl px-5 py-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {note.session_number != null && (
                        <span className="text-xs font-mono bg-surface-overlay border border-border px-2 py-0.5 rounded text-slate-400">
                          Session {note.session_number}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">{note.session_date}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-100">{note.title}</h3>
                    {note.content && (
                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                        {note.content}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => openEdit(note)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <SessionEntry
          note={formNote}
          onSaved={handleSaved}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
