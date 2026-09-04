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
  client_id: string | null // set once a synced player claims this roster entry
  dm_notes: string // private — never synced to the player's own app
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
  content: string // deprecated — pre-migration notes, superseded by recap
  recap: string // what actually happened
  prep_notes: string // follow-ups / what to bring into next session
  linked_cards: string[]
  linked_party_members: string[]
  session_date: string
  created_at: string
}

export type ThreadStatus = 'open' | 'resolved'

// A plot hook, promise, or reminder that needs to outlive a single session's
// notes — the running "don't forget X" board.
export interface Thread {
  id: string
  text: string
  status: ThreadStatus
  linked_card_id: string | null
  linked_member_id: string | null
  created_at: string
  resolved_at: string | null
  sort_order: number
}

export type SearchResultKind = 'card' | 'session' | 'thread'

// Cards carry their full original shape (type/tags/is_public all matter for
// the existing card-search UI); sessions and threads are lighter-weight —
// just enough to show a result row and jump to the right place.
export interface SearchResult {
  kind: SearchResultKind
  id: string
  name: string
  description: string
  type?: CardType
  image_path?: string | null
  tags?: string[]
  is_public?: number
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

export type MapTool = 'pin' | 'fog' | 'ruler' | 'spotlight' | 'vfx' | null

// Point effects need a target (x, y); screen effects (lightning, impact)
// play across the whole presentation window and ignore x/y.
export type VfxType =
  | 'lightning' | 'fireball' | 'frost' | 'poison' | 'heal' | 'impact'
  | 'rage' | 'counterspell' | 'radiant' | 'necrotic' | 'crit'
export const VFX_POINT_TYPES: VfxType[] = [
  'fireball', 'frost', 'poison', 'heal', 'rage', 'counterspell', 'radiant', 'necrotic', 'crit'
]

export interface VfxEvent {
  id: string
  type: VfxType
  x?: number   // normalized 0-1, point effects only
  y?: number
}

// Looping ambient layers — toggled on/off rather than fired once.
export interface AmbientVfxState {
  rain: boolean
  stormLightning: boolean
}

export const DEFAULT_AMBIENT_VFX: AmbientVfxState = { rain: false, stormLightning: false }

// Rays: two-click targeting (origin, then destination), a beam drawn
// between them that persists briefly like a point burst — session-only,
// never saved, same as VfxEvent above.
export type RayType = 'poison_ray' | 'ice_ray' | 'fire_ray' | 'lightning_ray'
export const RAY_TYPES: RayType[] = ['poison_ray', 'ice_ray', 'fire_ray', 'lightning_ray']

export interface RayEvent {
  id: string
  type: RayType
  from: { x: number; y: number } // normalized 0-1
  to: { x: number; y: number }
}

// Zones: two-click placement (center, then a point on the edge sets the
// radius) — unlike bursts and rays, these linger until the DM dismisses
// them from the Active Effects list. Deliberately NOT persisted to the
// database: they're runtime state for the current session, cleared on
// map switch or app restart, same as the ruler/spotlight/fog-brush-preview
// state already is.
//
export type ZoneType = 'smoke' | 'hold_person' | 'fear' | 'charm' | 'sleep' | 'silence' | 'web' | 'darkness'
export const ZONE_TYPES: ZoneType[] = ['smoke', 'hold_person', 'fear', 'charm', 'sleep', 'silence', 'web', 'darkness']

export interface ZoneMarker {
  id: string
  type: ZoneType
  center: { x: number; y: number } // normalized 0-1
  edge: { x: number; y: number }   // normalized 0-1 — defines the radius
}

// The in-progress VFX placement — bursts fire on one click; rays/zones are
// two-click, so the first point (origin/center) lives here between clicks.
export type VfxPending =
  | { kind: 'burst'; type: VfxType }
  | { kind: 'ray'; type: RayType; from: { x: number; y: number } | null }
  | { kind: 'zone'; type: ZoneType; center: { x: number; y: number } | null }
  | null

export type Page = 'library' | 'party' | 'sessions' | 'threads' | 'maps' | 'encounter' | 'timeline'

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

// Live data pushed over LAN from a connected LoreKeeper Companion (player)
// app — separate from the DM's own `party_members` table, since this is
// telemetry from the player's own app rather than anything the DM authored.
export interface PlayerSnapshot {
  name: string
  race: string
  class: string
  level: number
  ac: number | null
  initiative: number | null
  hp_current: number | null
  hp_max: number | null
  spellSlots: { level: number; max: number; current: number }[]
  resources: { id: string; name: string; current: number; max: number; color: string }[]
  conditions: Condition[]
}

export interface ConnectedPlayer {
  clientId: string
  snapshot: PlayerSnapshot
  lastSeen: number
}

export interface DmThreadMessage {
  from: 'player' | 'dm'
  text: string
  at: number
}

// One conversation per player, keyed by their stable client_id so a
// reconnect (WiFi hiccup, app restart) resumes the same thread instead of
// starting a new one.
export interface DmThread {
  clientId: string
  playerName: string
  messages: DmThreadMessage[]
}

export interface PartySyncState {
  running: boolean
  address: string | null
  // Every plausible LAN address the DM's PC has, best guess first (`address`
  // is just addresses[0]) — shown as a fallback list in the UI since the
  // "obvious" adapter isn't always the reachable one (VPNs, multiple NICs).
  addresses: string[]
  players: ConnectedPlayer[]
  threads: DmThread[]
}
