import type { Card, CardType, PartyMember, Resource, Reputation, SessionNote, SearchResult, MapData, MapPin, Combatant, EncounterState, SceneData, TimelineEvent, PartySyncState } from './index'

interface ElectronAPI {
  cards: {
    list: (filter?: { type?: string }) => Promise<Card[]>
    get: (id: string) => Promise<Card | null>
    getMany: (ids: string[]) => Promise<Card[]>
    getBacklinks: (cardId: string) => Promise<Card[]>
    getChildren: (parentId: string) => Promise<Card[]>
    save: (card: Partial<Card> & { name: string; type: CardType }) => Promise<Card>
    delete: (id: string) => Promise<void>
  }
  timeline: {
    list: () => Promise<TimelineEvent[]>
    save: (event: Partial<TimelineEvent> & { title: string }) => Promise<TimelineEvent>
    delete: (id: string) => Promise<void>
  }
  party: {
    getMembers: () => Promise<PartyMember[]>
    saveMember: (member: Partial<PartyMember> & { name: string }) => Promise<PartyMember>
    deleteMember: (id: string) => Promise<void>
    updateInitiative: (id: string, initiative: number | null) => Promise<void>
    updateResources: (id: string, resources: Resource[]) => Promise<void>
    getReputation: (memberId: string) => Promise<Reputation[]>
    setReputation: (memberId: string, factionId: string, score: number) => Promise<void>
  }
  sessions: {
    list: () => Promise<SessionNote[]>
    get: (id: string) => Promise<SessionNote | null>
    save: (note: Partial<SessionNote> & { title: string }) => Promise<SessionNote>
    delete: (id: string) => Promise<void>
  }
  search: {
    query: (q: string) => Promise<SearchResult[]>
  }
  maps: {
    list: () => Promise<MapData[]>
    get: (id: string) => Promise<MapData | null>
    save: (map: Partial<MapData> & { name: string }) => Promise<MapData>
    delete: (id: string) => Promise<void>
    getPins: (mapId: string) => Promise<MapPin[]>
    savePin: (pin: Partial<MapPin> & { map_id: string }) => Promise<MapPin>
    deletePin: (id: string) => Promise<void>
    getFog: (mapId: string) => Promise<unknown>
    saveFog: (data: { mapId: string; fogState: unknown }) => Promise<void>
    deleteFog: (mapId: string) => Promise<void>
    pushFogLive: (data: { mapId: string; fogState: unknown }) => Promise<void>
    pushRuler: (data: unknown) => Promise<void>
    pushSpotlight: (data: unknown) => Promise<void>
    pushGrid: (data: unknown) => Promise<void>
    pushEffect: (data: { id: string; type: string; x?: number; y?: number }) => Promise<void>
    pushAmbientVfx: (data: { rain: boolean; stormLightning: boolean }) => Promise<void>
    openPresentation: (mapId: string) => Promise<void>
    closePresentation: () => Promise<void>
    toggleFullscreen: () => Promise<void>
    setFullscreen: (value: boolean) => Promise<void>
    pushHandout: (imagePath: string) => Promise<void>
    clearHandout: () => Promise<void>
    setScene: (data: SceneData) => Promise<void>
    clearScene: () => Promise<void>
    onPresentUpdate: (cb: (mapId: string) => void) => () => void
    onFogUpdate: (cb: (data: { mapId: string; fogState: unknown }) => void) => () => void
    onRulerUpdate: (cb: (data: unknown) => void) => () => void
    onSpotlightUpdate: (cb: (data: unknown) => void) => () => void
    onGridUpdate: (cb: (data: unknown) => void) => () => void
    onEffectUpdate: (cb: (data: { id: string; type: string; x?: number; y?: number }) => void) => () => void
    onAmbientVfxUpdate: (cb: (data: { rain: boolean; stormLightning: boolean }) => void) => () => void
    onHandoutUpdate: (cb: (data: { imagePath: string } | null) => void) => () => void
    onSceneUpdate: (cb: (data: SceneData | null) => void) => () => void
  }
  encounter: {
    getState: () => Promise<EncounterState>
    start: () => Promise<EncounterState>
    end: () => Promise<EncounterState>
    addMonster: (data: { name: string; hp_max?: number; ac?: number; initiative?: number }) => Promise<EncounterState>
    addPartyMember: (memberId: string) => Promise<EncounterState>
    updateCombatant: (id: string, changes: Partial<Pick<Combatant, 'hp_current' | 'conditions' | 'initiative' | 'name' | 'ac'>>) => Promise<EncounterState>
    removeCombatant: (id: string) => Promise<EncounterState>
    nextTurn: () => Promise<EncounterState>
    prevTurn: () => Promise<EncounterState>
    onUpdate: (cb: (state: EncounterState | null) => void) => () => void
  }
  partySync: {
    start: () => Promise<{ ok: boolean; error?: string; running: boolean; address: string | null }>
    stop: () => Promise<{ running: boolean }>
    status: () => Promise<PartySyncState>
    reply: (clientId: string, text: string) => Promise<{ ok: boolean; error?: string }>
    onUpdate: (cb: (state: PartySyncState) => void) => () => void
  }
  dialog: {
    openImage: () => Promise<string | null>
    openMapImage: () => Promise<string | null>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
