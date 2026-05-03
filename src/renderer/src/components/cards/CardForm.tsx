import { useState, useEffect } from 'react'
import { X, Image } from 'lucide-react'
import type { Card, CardType } from '../../types'
import { useUIStore } from '../../store/uiStore'
import { typeLabel } from './CardTypeBadge'

const CARD_TYPES: CardType[] = ['npc', 'item', 'location', 'lore', 'faction']

const ALIGNMENTS = [
  '', // blank / unset
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
  'Unaligned'
]

const NPC_STATUSES = ['', 'Alive', 'Dead', 'Unknown', 'Missing', 'Undead', 'Captured']

const ITEM_RARITIES = ['', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact', 'Unique']

type FieldDef = { key: string; label: string; placeholder: string; options?: string[] }

const TYPE_FIELDS: Record<CardType, FieldDef[]> = {
  npc: [
    { key: 'race',        label: 'Race / Species',   placeholder: 'e.g. Human, Elf, Dwarf' },
    { key: 'role',        label: 'Role / Class',      placeholder: 'e.g. Blacksmith, Assassin' },
    { key: 'alignment',   label: 'Alignment',         placeholder: '', options: ALIGNMENTS },
    { key: 'affiliation', label: 'Faction / Guild',   placeholder: 'e.g. The Crimson Pact' },
    { key: 'status',      label: 'Status',            placeholder: '', options: NPC_STATUSES },
    { key: 'voice',       label: 'Voice / Mannerisms',placeholder: 'Notes for roleplay' }
  ],
  item: [
    { key: 'rarity',     label: 'Rarity',         placeholder: '', options: ITEM_RARITIES },
    { key: 'value',      label: 'Value',           placeholder: 'e.g. 500 gp' },
    { key: 'attunement', label: 'Attunement',      placeholder: 'e.g. Requires attunement by a wizard' },
    { key: 'holder',     label: 'Current Holder',  placeholder: 'Who has this item?' }
  ],
  location: [
    { key: 'region',  label: 'Region',       placeholder: 'e.g. The Thornwood' },
    { key: 'locType', label: 'Type',         placeholder: 'e.g. City, Dungeon, Wilderness' },
    { key: 'climate', label: 'Climate / Feel',placeholder: 'e.g. Cold, Foreboding' }
  ],
  lore: [
    { key: 'category', label: 'Category',      placeholder: 'e.g. History, Religion, Magic' },
    { key: 'era',      label: 'Era / Period',   placeholder: 'e.g. The Age of Dragons' },
    { key: 'source',   label: 'Source',         placeholder: 'Where did this knowledge come from?' }
  ],
  faction: [
    { key: 'alignment', label: 'Alignment',     placeholder: '', options: ALIGNMENTS },
    { key: 'goal',      label: 'Primary Goal',  placeholder: 'What does this faction want?' },
    { key: 'leader',    label: 'Leader',         placeholder: 'Name of the faction head' },
    { key: 'hq',        label: 'Headquarters',   placeholder: 'Where do they operate from?' }
  ]
}

export function CardForm({ onSaved }: { onSaved: (card: Card) => void }) {
  const { cardForm, closeCardForm } = useUIStore()
  const { editingCard, defaultType } = cardForm

  const [type, setType] = useState<CardType>(editingCard?.type ?? defaultType)
  const [name, setName] = useState(editingCard?.name ?? '')
  const [description, setDescription] = useState(editingCard?.description ?? '')
  const [tags, setTags] = useState(editingCard?.tags.join(', ') ?? '')
  const [fields, setFields] = useState<Record<string, string>>(
    editingCard?.fields as Record<string, string> ?? {}
  )
  const [imagePath, setImagePath] = useState<string | null>(editingCard?.image_path ?? null)
  const [isPublic, setIsPublic] = useState(editingCard?.is_public === 1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editingCard) setFields({})
  }, [type])

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  async function pickImage() {
    const path = await window.api.dialog.openImage()
    if (path) setImagePath(path)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const saved = await window.api.cards.save({
        ...(editingCard?.id ? { id: editingCard.id } : {}),
        type,
        name: name.trim(),
        description: description.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        fields,
        image_path: imagePath,
        is_public: isPublic ? 1 : 0
      } as Parameters<typeof window.api.cards.save>[0])
      onSaved(saved)
      closeCardForm()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={closeCardForm}>
      <div
        className="modal max-w-xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-display text-base font-semibold text-white">
            {editingCard ? 'Edit Card' : 'New Card'}
          </h2>
          <button onClick={closeCardForm} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!editingCard && (
            <div>
              <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">Type</label>
              <div className="flex gap-2 flex-wrap">
                {CARD_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      type === t
                        ? `badge-${t} font-medium`
                        : 'bg-surface-overlay text-slate-400 border border-border hover:border-slate-500'
                    }`}
                  >
                    {typeLabel(t)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${typeLabel(type)} name...`}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Description</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
            />
          </div>

          {TYPE_FIELDS[type].map(({ key, label, placeholder, options }) => (
            <div key={key}>
              <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">{label}</label>
              {options ? (
                <select
                  className="input appearance-none"
                  value={fields[key] ?? ''}
                  onChange={(e) => setField(key, e.target.value)}
                >
                  {options.map((o) => (
                    <option key={o} value={o} className="bg-surface-overlay">
                      {o === '' ? `— Select ${label} —` : o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  value={fields[key] ?? ''}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={placeholder}
                />
              )}
            </div>
          ))}

          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Tags</label>
            <input
              className="input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="merchant, important, alive (comma-separated)"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Image</label>
            <div className="flex items-center gap-3">
              {imagePath && (
                <img
                  src={`file://${imagePath}`}
                  alt="preview"
                  className="w-16 h-16 rounded-lg object-cover border border-border"
                />
              )}
              <button onClick={pickImage} className="btn-ghost flex items-center gap-2">
                <Image size={14} />
                {imagePath ? 'Change Image' : 'Choose Image'}
              </button>
              {imagePath && (
                <button onClick={() => setImagePath(null)} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                  Remove
                </button>
              )}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 rounded accent-amber-500"
            />
            <span className="text-sm text-slate-300">Visible in player view</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border flex-shrink-0">
          <button onClick={closeCardForm} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : editingCard ? 'Save Changes' : 'Create Card'}
          </button>
        </div>
      </div>
    </div>
  )
}
