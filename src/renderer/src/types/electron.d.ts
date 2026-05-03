import type { Card, CardType, PartyMember, Resource, Reputation, SessionNote, SearchResult } from './index'

interface ElectronAPI {
  cards: {
    list: (filter?: { type?: string }) => Promise<Card[]>
    get: (id: string) => Promise<Card | null>
    save: (card: Partial<Card> & { name: string; type: CardType }) => Promise<Card>
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
  dialog: {
    openImage: () => Promise<string | null>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
