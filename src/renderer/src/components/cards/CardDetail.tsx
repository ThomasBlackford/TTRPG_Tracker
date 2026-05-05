import { useState, useEffect } from 'react'
import { X, Edit, Trash2, Eye, EyeOff, Tag, MonitorPlay, Image, ChevronRight, Lock } from 'lucide-react'
import type { Card, CardType } from '../../types'
import { useUIStore } from '../../store/uiStore'
import { CardTypeBadge, typeLabel } from './CardTypeBadge'

const FIELD_LABELS: Record<string, Record<string, string>> = {
  npc:      { race: 'Race', role: 'Role/Class', affiliation: 'Faction', status: 'Status', voice: 'Voice Notes' },
  item:     { rarity: 'Rarity', value: 'Value', attunement: 'Attunement', holder: 'Current Holder' },
  location: { region: 'Region', locType: 'Type', connected: 'Connected Locations', climate: 'Climate / Feel' },
  lore:     { category: 'Category', era: 'Era / Period', source: 'Source', related: 'Related Cards' },
  faction:  { alignment: 'Alignment', goal: 'Goal', leader: 'Leader', hq: 'Headquarters' }
}

const TYPE_DOT: Record<CardType, string> = {
  npc: 'bg-sky-400',
  item: 'bg-emerald-400',
  location: 'bg-orange-400',
  lore: 'bg-purple-400',
  faction: 'bg-red-400',
}

function CardChip({ card, onClick }: { card: Card; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs
                 bg-surface-overlay border border-border text-slate-300 hover:border-slate-500
                 hover:text-slate-100 transition-colors"
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_DOT[card.type as CardType]}`} />
      {card.name}
    </button>
  )
}

export function CardDetail({ card, onRefresh }: { card: Card; onRefresh: () => void }) {
  const { setSelectedCard, openCardForm } = useUIStore()
  const [linkedCards, setLinkedCards] = useState<Card[]>([])
  const [backlinks, setBacklinks] = useState<Card[]>([])
  const [parentCard, setParentCard] = useState<Card | null>(null)
  const [children, setChildren] = useState<Card[]>([])

  useEffect(() => {
    if (card.linked_cards?.length) {
      window.api.cards.getMany(card.linked_cards).then(setLinkedCards)
    } else {
      setLinkedCards([])
    }
    window.api.cards.getBacklinks(card.id).then(setBacklinks)
    if (card.type === 'location') {
      if (card.parent_id) window.api.cards.get(card.parent_id).then(c => setParentCard(c))
      else setParentCard(null)
      window.api.cards.getChildren(card.id).then(setChildren)
    }
  }, [card.id, card.linked_cards?.join(','), card.parent_id])

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

  function navigateTo(c: Card) {
    setSelectedCard(c)
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
          <div className="aspect-video w-full overflow-hidden relative group">
            <img
              src={`file:///${card.image_path.replace(/\\/g, '/')}`}
              alt={card.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex gap-1.5 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent">
              <button
                onClick={() => window.api.maps.pushHandout(card.image_path!)}
                title="Show to players on TV"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-black/60 text-emerald-300 hover:bg-black/80 transition-colors"
              >
                <MonitorPlay size={11} /> Show
              </button>
              <button
                onClick={() => window.api.maps.setScene({ imagePath: card.image_path ?? undefined, title: card.name })}
                title="Set as scene background"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-black/60 text-sky-300 hover:bg-black/80 transition-colors"
              >
                <Image size={11} /> Scene
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-4 space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-white leading-tight">{card.name}</h2>
            {card.description && (
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{card.description}</p>
            )}
          </div>

          {/* Type-specific fields */}
          {Object.entries(card.fields).filter(([, v]) => v).length > 0 && (
            <div className="space-y-1.5">
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

          {/* Location hierarchy */}
          {card.type === 'location' && (parentCard || children.length > 0) && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Hierarchy</p>
              {parentCard && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="text-slate-600">Parent:</span>
                  <CardChip card={parentCard} onClick={() => navigateTo(parentCard)} />
                </div>
              )}
              {children.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-600">Sub-locations:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {children.map(c => (
                      <CardChip key={c.id} card={c} onClick={() => navigateTo(c)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DM Notes (always private) */}
          {card.dm_notes && (
            <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <Lock size={11} className="text-amber-500/60" />
                <p className="text-xs text-amber-500/60 uppercase tracking-widest font-medium">DM Notes</p>
              </div>
              <p className="text-sm text-amber-200/70 leading-relaxed whitespace-pre-wrap">{card.dm_notes}</p>
            </div>
          )}

          {/* Linked cards */}
          {linkedCards.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Links</p>
              <div className="flex flex-wrap gap-1.5">
                {linkedCards.map(c => (
                  <CardChip key={c.id} card={c} onClick={() => navigateTo(c)} />
                ))}
              </div>
            </div>
          )}

          {/* Backlinks */}
          {backlinks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <ChevronRight size={11} className="text-slate-600" />
                <p className="text-xs text-slate-600 uppercase tracking-widest font-medium">Referenced by</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {backlinks.map(c => (
                  <CardChip key={c.id} card={c} onClick={() => navigateTo(c)} />
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {card.tags.length > 0 && (
            <div>
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

          <p className="text-xs text-slate-600">
            Updated {new Date(card.updated_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}
