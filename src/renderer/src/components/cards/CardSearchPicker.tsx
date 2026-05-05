import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import type { Card, CardType } from '../../types'
import { typeLabel } from './CardTypeBadge'

const TYPE_DOT: Record<CardType, string> = {
  npc: 'bg-sky-400',
  item: 'bg-emerald-400',
  location: 'bg-orange-400',
  lore: 'bg-purple-400',
  faction: 'bg-red-400',
}

interface Props {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  excludeId?: string
  filterType?: CardType
  placeholder?: string
  label?: string
  maxItems?: number
}

export function CardSearchPicker({
  selectedIds,
  onChange,
  excludeId,
  filterType,
  placeholder = 'Search cards…',
  label,
  maxItems,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Card[]>([])
  const [selected, setSelected] = useState<Card[]>([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Resolve selected IDs to Card objects on mount / when selectedIds change
  useEffect(() => {
    if (!selectedIds.length) { setSelected([]); return }
    window.api.cards.getMany(selectedIds).then(setSelected)
  }, [selectedIds.join(',')])

  // Search as user types
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const q = query.trim()
    window.api.search.query(q).then((hits) => {
      let filtered = hits as Card[]
      if (filterType) filtered = filtered.filter(c => c.type === filterType)
      if (excludeId)  filtered = filtered.filter(c => c.id !== excludeId)
      filtered = filtered.filter(c => !selectedIds.includes(c.id))
      setResults(filtered.slice(0, 8))
    })
  }, [query])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function addCard(card: Card) {
    if (maxItems === 1) {
      setSelected([card])
      onChange([card.id])
    } else {
      setSelected(prev => [...prev, card])
      onChange([...selectedIds, card.id])
    }
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  function removeCard(id: string) {
    onChange(selectedIds.filter(i => i !== id))
    setSelected(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div>
      {label && (
        <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">
          {label}
        </label>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(c => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                         bg-surface-overlay border border-border text-slate-300"
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_DOT[c.type as CardType]}`} />
              {c.name}
              <button
                type="button"
                onClick={() => removeCard(c.id)}
                className="text-slate-500 hover:text-red-400 transition-colors leading-none"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input — hide when maxItems reached */}
      {(maxItems == null || selectedIds.length < maxItems) && <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          ref={inputRef}
          className="input pl-7 text-sm"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />

        {open && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-overlay border border-border
                       rounded-lg shadow-xl overflow-hidden"
          >
            {results.map(c => (
              <button
                key={c.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); addCard(c) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors"
              >
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 badge-${c.type}`}>
                  {typeLabel(c.type as CardType)}
                </span>
                <span className="text-sm text-slate-200 truncate">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>}
    </div>
  )
}
