import { create } from 'zustand'
import type { Card, CardType, Page } from '../types'

interface UIState {
  currentPage: Page
  setCurrentPage: (page: Page) => void

  isSearchOpen: boolean
  setSearchOpen: (open: boolean) => void

  selectedCard: Card | null
  setSelectedCard: (card: Card | null) => void

  cardForm: { open: boolean; editingCard: Card | null; defaultType: CardType }
  openCardForm: (defaultType?: CardType, editingCard?: Card) => void
  closeCardForm: () => void

  memberForm: { open: boolean; editingId: string | null }
  openMemberForm: (editingId?: string) => void
  closeMemberForm: () => void

  // Set when search (or anywhere else) wants Sessions/Threads to open a
  // specific item once it mounts, rather than just landing on the page.
  // Read-and-clear by the page itself.
  pendingSessionId: string | null
  setPendingSessionId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  currentPage: 'library',
  setCurrentPage: (page) => set({ currentPage: page, selectedCard: null }),

  isSearchOpen: false,
  setSearchOpen: (open) => set({ isSearchOpen: open }),

  selectedCard: null,
  setSelectedCard: (card) => set({ selectedCard: card }),

  cardForm: { open: false, editingCard: null, defaultType: 'npc' },
  openCardForm: (defaultType = 'npc', editingCard) =>
    set({ cardForm: { open: true, editingCard: editingCard ?? null, defaultType } }),
  closeCardForm: () =>
    set((s) => ({ cardForm: { ...s.cardForm, open: false, editingCard: null } })),

  memberForm: { open: false, editingId: null },
  openMemberForm: (editingId) => set({ memberForm: { open: true, editingId: editingId ?? null } }),
  closeMemberForm: () => set({ memberForm: { open: false, editingId: null } }),

  pendingSessionId: null,
  setPendingSessionId: (id) => set({ pendingSessionId: id })
}))
