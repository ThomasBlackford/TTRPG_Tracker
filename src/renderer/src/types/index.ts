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
  linked_cards: string[]
  parent_id: string | null
  dm_notes: string
  created_at: string
  updated_at: string
}

export interface TimelineEvent {
  id: string
  title: string
  description: string
  day_number: number | null
  date_display: string
  linked_cards: string[]
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

export interface MapData {
  id: string
  name: string
  image_path: string | null
  description: string
  scale_pixels_per_unit: number   // natural image pixels per grid unit (default 50)
  scale_feet_per_unit: number     // real-world feet per grid unit (default 5)
  grid_offset_x: number           // grid x offset in natural image pixels
  grid_offset_y: number           // grid y offset in natural image pixels
  created_at: string
  updated_at: string
}

export interface MapPin {
  id: string
  map_id: string
  x: number
  y: number
  label: string
  card_id: string | null
  child_map_id: string | null
  color: string
  created_at: string
}

export interface FogState {
  gridCols: number  // default 64
  gridRows: number  // default 64
  cells: number[]   // flat array, 0=fogged, 1=revealed; length = gridCols*gridRows
}

export interface RulerState {
  start: { x: number; y: number } | null   // normalized 0-1 image coords
  end:   { x: number; y: number } | null
  frozen: boolean
  shareToPlayers: boolean
}

export interface SpotlightState {
  x: number   // normalized 0-1
  y: number
}

export type MapTool = 'pin' | 'fog' | 'ruler' | 'spotlight' | null

export type Page = 'library' | 'party' | 'sessions' | 'maps' | 'encounter' | 'timeline'

export type Condition =
  'Blinded' | 'Charmed' | 'Deafened' | 'Exhausted' | 'Frightened' |
  'Grappled' | 'Incapacitated' | 'Invisible' | 'Paralyzed' | 'Petrified' |
  'Poisoned' | 'Prone' | 'Restrained' | 'Stunned' | 'Unconscious'

export interface Combatant {
  id: string
  name: string
  type: 'party' | 'monster'
  party_member_id: string | null
  hp_current: number | null
  hp_max: number | null
  ac: number | null
  initiative: number | null
  conditions: Condition[]
  sort_order: number
}

export interface EncounterState {
  isActive: boolean
  round: number
  currentIndex: number
  combatants: Combatant[]
}

export interface SceneData {
  imagePath?: string
  title?: string
  subtitle?: string
}
