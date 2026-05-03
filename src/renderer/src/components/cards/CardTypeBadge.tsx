import type { CardType } from '../../types'

export function typeLabel(type: CardType): string {
  return { npc: 'NPC', item: 'Item', location: 'Location', lore: 'Lore', faction: 'Faction' }[type]
}

export function CardTypeBadge({ type }: { type: CardType }) {
  return (
    <span className={`badge-${type} text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0`}>
      {typeLabel(type)}
    </span>
  )
}
