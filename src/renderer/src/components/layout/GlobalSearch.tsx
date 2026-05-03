import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useSearchStore } from '../../store/searchStore'
import type { CardType, SearchResult } from '../../types'
import { CardTypeBadge, typeLabel } from '../cards/CardTypeBadge'

export function GlobalSearch() {
  const { isSearchOpen, setSearchOpen, setCurrentPage, setSelectedCard } = useUIStore()
  const { query, results, isLoading, search, clear } = useSearchStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape' && isSearchOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isSearchOpen])

  useEffect(() => {
    if (isSearchOpen) setTimeout(() => inputRef.current?.focus(), 50)
    else clear()
  }, [isSearchOpen])

  function handleClose() {
    setSearchOpen(false)
    clear()
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    if (debounceTimer) clearTimeout(debounceTimer)
    setDebounceTimer(setTimeout(() => search(q), 200))
  }

  async function handleSelect(result: SearchResult) {
    const card = await window.api.cards.get(result.id)
    if (card) {
      setCurrentPage('library')
      setSelectedCard(card)
    }
    handleClose()
  }

  if (!isSearchOpen) return null

  const grouped = groupByType(results)

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal max-w-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            defaultValue={query}
            onChange={handleInput}
            placeholder="Search NPCs, items, locations, lore..."
            className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none text-sm"
          />
          {isLoading && <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />}
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto py-2">
          {results.length === 0 && query.trim() && !isLoading && (
            <p className="text-slate-500 text-sm text-center py-8">No results for "{query}"</p>
          )}
          {results.length === 0 && !query.trim() && (
            <p className="text-slate-600 text-sm text-center py-8">Type to search your campaign...</p>
          )}

          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <div className="px-4 py-1.5">
                <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">
                  {typeLabel(type as CardType)}
                </span>
              </div>
              {items.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                >
                  <CardTypeBadge type={r.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-100 font-medium truncate">{r.name}</p>
                    {r.description && (
                      <p className="text-xs text-slate-500 truncate">{r.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function groupByType(results: SearchResult[]): Record<string, SearchResult[]> {
  return results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {} as Record<string, SearchResult[]>)
}
