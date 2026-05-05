import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, X, Check, Link, CalendarDays } from 'lucide-react'
import type { TimelineEvent, Card, CardType } from '../types'
import { CardSearchPicker } from '../components/cards/CardSearchPicker'

const TYPE_DOT: Record<CardType, string> = {
  npc: 'bg-sky-400',
  item: 'bg-emerald-400',
  location: 'bg-orange-400',
  lore: 'bg-purple-400',
  faction: 'bg-red-400',
}

interface EventFormState {
  title: string
  description: string
  day_number: string
  date_display: string
  linked_cards: string[]
}

const EMPTY_FORM: EventFormState = {
  title: '', description: '', day_number: '', date_display: '', linked_cards: []
}

function eventToForm(e: TimelineEvent): EventFormState {
  return {
    title: e.title,
    description: e.description,
    day_number: e.day_number != null ? String(e.day_number) : '',
    date_display: e.date_display,
    linked_cards: e.linked_cards,
  }
}

interface LinkedCardChipsProps {
  ids: string[]
}

function LinkedCardChips({ ids }: LinkedCardChipsProps) {
  const [cards, setCards] = useState<Card[]>([])
  useEffect(() => {
    if (!ids.length) { setCards([]); return }
    window.api.cards.getMany(ids).then(setCards)
  }, [ids.join(',')])

  if (!cards.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {cards.map(c => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]
                     bg-surface-overlay border border-border text-slate-400"
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_DOT[c.type as CardType]}`} />
          {c.name}
        </span>
      ))}
    </div>
  )
}

interface EventRowProps {
  event: TimelineEvent
  onEdit: () => void
  onDelete: () => void
}

function EventRow({ event, onEdit, onDelete }: EventRowProps) {
  return (
    <div className="group flex gap-4 py-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center flex-shrink-0 w-24 text-right">
        <span className="text-xs font-mono text-amber-400/70 leading-tight">
          {event.date_display || (event.day_number != null ? `Day ${event.day_number}` : '—')}
        </span>
      </div>

      {/* Dot + connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60 mt-0.5 flex-shrink-0" />
        <div className="w-px flex-1 bg-border mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-slate-200 leading-tight">{event.title}</h3>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
            >
              <Edit size={13} />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {event.description && (
          <p className="mt-1 text-sm text-slate-400 leading-relaxed">{event.description}</p>
        )}

        <LinkedCardChips ids={event.linked_cards} />
      </div>
    </div>
  )
}

interface EventFormProps {
  initial?: EventFormState
  onSave: (form: EventFormState) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function EventForm({ initial = EMPTY_FORM, onSave, onCancel, saving }: EventFormProps) {
  const [form, setForm] = useState<EventFormState>(initial)

  function set(key: keyof EventFormState, value: string | string[]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="bg-surface-raised border border-border rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Date / Label</label>
          <input
            className="input text-sm"
            placeholder="e.g. Day 42, 3rd of Highsun"
            value={form.date_display}
            onChange={e => set('date_display', e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Day # (for sorting)</label>
          <input
            className="input text-sm"
            type="number"
            placeholder="e.g. 42"
            value={form.day_number}
            onChange={e => set('day_number', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1">Title *</label>
        <input
          className="input text-sm"
          placeholder="What happened?"
          value={form.title}
          onChange={e => set('title', e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1">Description</label>
        <textarea
          className="input resize-none text-sm"
          rows={3}
          placeholder="Details…"
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />
      </div>

      <CardSearchPicker
        label="Linked Cards"
        selectedIds={form.linked_cards}
        onChange={ids => set('linked_cards', ids)}
        placeholder="Link NPCs, locations, items…"
      />

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-ghost text-sm">
          <X size={13} /> Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={!form.title.trim() || saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                     bg-amber-500/20 border border-amber-500/40 text-amber-300
                     hover:bg-amber-500/30 transition-colors disabled:opacity-40"
        >
          <Check size={13} /> {saving ? 'Saving…' : 'Save Event'}
        </button>
      </div>
    </div>
  )
}

export function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const data = await window.api.timeline.list()
    setEvents(data)
    setLoading(false)
  }

  async function handleSave(form: EventFormState, existingId?: string) {
    setSaving(true)
    try {
      await window.api.timeline.save({
        ...(existingId ? { id: existingId } : {}),
        title: form.title.trim(),
        description: form.description.trim(),
        day_number: form.day_number ? parseInt(form.day_number) : null,
        date_display: form.date_display.trim(),
        linked_cards: form.linked_cards,
      })
      await load()
      setCreating(false)
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return
    await window.api.timeline.delete(id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-600 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-raised flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <CalendarDays size={18} className="text-amber-400" />
          <h1 className="font-display text-base font-semibold text-white">Campaign Timeline</h1>
          <span className="text-xs text-slate-600">{events.length} events</span>
        </div>
        {!creating && (
          <button
            onClick={() => { setCreating(true); setEditingId(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border
                       bg-amber-500/20 border-amber-500/40 text-amber-300
                       hover:bg-amber-500/30 transition-colors"
          >
            <Plus size={13} /> Add Event
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* New event form */}
        {creating && (
          <div className="mb-6">
            <EventForm
              onSave={form => handleSave(form)}
              onCancel={() => setCreating(false)}
              saving={saving}
            />
          </div>
        )}

        {events.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Link size={40} className="text-slate-700" />
            <div className="text-center">
              <p className="text-slate-400 font-medium">No timeline events yet</p>
              <p className="text-slate-600 text-sm mt-1">Record key moments in your campaign history.</p>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border
                         bg-amber-500/20 border-amber-500/40 text-amber-300
                         hover:bg-amber-500/30 transition-colors text-sm"
            >
              <Plus size={14} /> Add First Event
            </button>
          </div>
        ) : (
          <div className="max-w-2xl">
            {events.map(event => (
              editingId === event.id ? (
                <div key={event.id} className="mb-2">
                  <EventForm
                    initial={eventToForm(event)}
                    onSave={form => handleSave(form, event.id)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                </div>
              ) : (
                <EventRow
                  key={event.id}
                  event={event}
                  onEdit={() => { setEditingId(event.id); setCreating(false) }}
                  onDelete={() => handleDelete(event.id)}
                />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
