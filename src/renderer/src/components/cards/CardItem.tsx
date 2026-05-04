import type { Card, CardType } from '../../types'
import { CardTypeBadge } from './CardTypeBadge'

const PLACEHOLDER_COLORS: Record<CardType, string> = {
  npc: '#3b82f6', item: '#22c55e', location: '#f97316', lore: '#a855f7', faction: '#ef4444'
}

const PLACEHOLDER_ICONS: Record<CardType, string> = {
  npc: '👤', item: '⚔️', location: '🗺️', lore: '📖', faction: '⚜️'
}

export function CardItem({ card, onClick, isSelected }: {
  card: Card
  onClick: () => void
  isSelected?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left rounded-xl border transition-all duration-150 overflow-hidden
        ${isSelected
          ? 'border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/30'
          : 'border-border bg-surface-raised hover:border-slate-600 hover:bg-surface-overlay'
        }`}
    >
      <div
        className="absolute top-0 left-0 w-1 h-full"
        style={{ backgroundColor: PLACEHOLDER_COLORS[card.type] }}
      />

      <div className="pl-4 pr-3 pt-3 pb-3 flex gap-3 items-start">
        <div
          className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl overflow-hidden"
          style={{ backgroundColor: PLACEHOLDER_COLORS[card.type] + '22' }}
        >
          {card.image_path ? (
            <img
              src={`file:///${card.image_path.replace(/\\/g, '/')}`}
              alt={card.name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <span>{PLACEHOLDER_ICONS[card.type]}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate group-hover:text-white">
            {card.name}
          </p>
          {card.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
              {card.description}
            </p>
          )}
          <div className="mt-2">
            <CardTypeBadge type={card.type} />
          </div>
        </div>
      </div>
    </button>
  )
}
