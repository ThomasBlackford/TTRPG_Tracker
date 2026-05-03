import { create } from 'zustand'
import type { SearchResult } from '../types'

interface SearchState {
  query: string
  results: SearchResult[]
  isLoading: boolean
  setQuery: (q: string) => void
  search: (q: string) => Promise<void>
  clear: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  isLoading: false,

  setQuery: (query) => set({ query }),

  search: async (q) => {
    set({ query: q, isLoading: true })
    if (!q.trim()) {
      set({ results: [], isLoading: false })
      return
    }
    const results = await window.api.search.query(q)
    set({ results, isLoading: false })
  },

  clear: () => set({ query: '', results: [], isLoading: false })
}))
