export type CardType = 'npc' | 'item' | 'location' | 'lore' | 'faction'

export interface Card {
  id: string
  type: CardType
  name: string
  description: string
  image_path: string | null
  tags: string[]
  fields: Record<string, unknown>
  is_public: number
  created_at: string
  updated_at: string
}

export interface Resource {
  id: string
  name: string
  current: number
  max: number
  color: string
}

export interface PartyMember {
  id: string
  name: string
  player_name: string
  avatar_path: string | null
  initiative: number | null
  sort_order: number
  resources: Resource[]
}

export interface Reputation {
  party_member_id: string
  faction_id: string
  faction_name: string
  score: number
}

export interface SessionNote {
  id: string
  session_number: number | null
  title: string
  content: string
  linked_cards: string[]
  session_date: string
  created_at: string
}

export interface SearchResult {
  id: string
  type: CardType
  name: string
  description: string
  image_path: string | null
  tags: string[]
  is_public: number
}

export type Page = 'library' | 'party' | 'sessions'
