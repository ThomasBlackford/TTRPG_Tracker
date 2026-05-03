import { X, Edit, Trash2, Eye, EyeOff, Tag } from 'lucide-react'
import type { Card } from '../../types'
import { useUIStore } from '../../store/uiStore'
import { CardTypeBadge } from './CardTypeBadge'

const FIELD_LABELS: Record<string, Record<string, string>> = {
  npc:      { race: 'Race', role: 'Role/Class', affiliation: 'Faction', status: 'Status', voice: 'Voice Notes' },
  item:     { rarity: 'Rarity', value: 'Value', attunement: 'Attunement', holder: 'Current Holder' },
  location: { region: 'Region', locType: 'Type', connected: 'Connected Locations' },
  lore:     { category: 'Category', related: 'Related Cards' },
  faction:  { alignment: 'Alignment', goal: 'Goal', leader: 'Leader', members: 'Notable Members' }
}

export function CardDetail({ card, onRefresh }: { card: Card; onRefresh: () => void }) {
  const { setSelectedCard, openCardForm } = useUIStore()

  async function handleDelete() {
    if (!confirm(`Delete "${card.name}"? This cannot be undone.`)) return
    await window.api.cards.delete(card.id)
    setSelectedCard(null)
    onRefresh()
  }

  async function togglePublic() {
    await window.api.cards.save({ ...card, is_public: card.is_public ? 0 : 1 })
    onRefresh()
    const updated = await window.api.cards.get(card.id)
    if (updated) setSelectedCard(updated)
  }

  const fieldLabels = FIELD_LABELS[card.type] ?? {}

  return (
    <div className="w-80 flex-shrink-0 bg-surface-raised border-l border-border flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <CardTypeBadge type={card.type} />
        <div className="flex items-center gap-1">
          <button
            onClick={togglePublic}
            title={card.is_public ? 'Public (click to hide)' : 'DM Only (click to make public)'}
            className={`p-1.5 rounded-lg transition-colors ${
              card.is_public
                ? 'text-amber-400 hover:bg-amber-500/10'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            {card.is_public ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <button
            onClick={() => openCardForm(card.type, card)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <Edit size={15} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={() => setSelectedCard(null)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {card.image_path && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={`file://${card.image_path}`}
              alt={card.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="px-4 py-4">
          <h2 className="font-display text-lg font-semibold text-white leading-tight">{card.name}</h2>

          {card.description && (
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">{card.description}</p>
          )}

          {Object.entries(card.fields).filter(([, v]) => v).length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Details</p>
              {Object.entries(card.fields).map(([key, value]) => {
                if (!value) return null
                const label = fieldLabels[key] ?? key
                return (
                  <div key={key}>
                    <span className="text-xs text-slate-500">{label}: </span>
                    <span className="text-sm text-slate-300">{String(value)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {card.tags.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Tag size={12} className="text-slate-500" />
                <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Tags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {card.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-surface-overlay border border-border px-2 py-0.5 rounded-full text-slate-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 text-xs text-slate-600">
            Updated {new Date(card.updated_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}
