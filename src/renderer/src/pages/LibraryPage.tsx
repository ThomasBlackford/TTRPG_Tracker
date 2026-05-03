import { useState, useEffect, useCallback } from 'react'
import { Plus, Filter } from 'lucide-react'
import type { Card, CardType } from '../types'
import { useUIStore } from '../store/uiStore'
import { CardItem } from '../components/cards/CardItem'
import { CardDetail } from '../components/cards/CardDetail'
import { CardForm } from '../components/cards/CardForm'

const FILTERS: { value: 'all' | CardType; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'npc',      label: 'NPCs' },
  { value: 'item',     label: 'Items' },
  { value: 'location', label: 'Locations' },
  { value: 'lore',     label: 'Lore' },
  { value: 'faction',  label: 'Factions' }
]

export function LibraryPage() {
  const { selectedCard, setSelectedCard, cardForm, openCardForm } = useUIStore()
  const [cards, setCards] = useState<Card[]>([])
  const [activeFilter, setActiveFilter] = useState<'all' | CardType>('all')
  const [loading, setLoading] = useState(true)

  const loadCards = useCallback(async () => {
    setLoading(true)
    const data = await window.api.cards.list(
      activeFilter !== 'all' ? { type: activeFilter } : undefined
    )
    setCards(data)
    setLoading(false)
  }, [activeFilter])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  async function handleSaved(card: Card) {
    await loadCards()
    setSelectedCard(card)
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-slate-500 mr-1" />
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setActiveFilter(value); setSelectedCard(null) }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeFilter === value
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => openCardForm(activeFilter === 'all' ? 'npc' : activeFilter)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={14} />
            New Card
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-center">
              <p className="text-slate-500 text-sm">No {activeFilter === 'all' ? 'cards' : activeFilter + 's'} yet.</p>
              <button
                onClick={() => openCardForm(activeFilter === 'all' ? 'npc' : activeFilter)}
                className="mt-3 text-amber-400 hover:text-amber-300 text-sm transition-colors"
              >
                Create your first one →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {cards.map((card) => (
                <CardItem
                  key={card.id}
                  card={card}
                  isSelected={selectedCard?.id === card.id}
                  onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedCard && (
        <CardDetail card={selectedCard} onRefresh={loadCards} />
      )}

      {cardForm.open && <CardForm onSaved={handleSaved} />}
    </div>
  )
}
