import { useMemo, useState } from 'react'
import { Search, Trash2, Crown } from 'lucide-react'
import type { LibraryEntry } from '../../lib/monsterLibrary'
import { searchLibrary } from '../../lib/monsterLibrary'

interface Props {
  library: LibraryEntry[]
  onPick: (entry: LibraryEntry) => void
  onDeleteCustom?: (id: string) => void
  placeholder?: string
}

// A search box over the bestiary and the DM's own monsters.
export function MonsterPicker({ library, onPick, onDeleteCustom, placeholder = 'Search bestiary…' }: Props) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => searchLibrary(library, query), [library, query])

  return (
    <div className="relative">
      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
      <input
        className="input text-xs pl-7"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {matches.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface-raised border border-border shadow-2xl max-h-64 overflow-y-auto">
          {matches.map((m) => (
            <div key={m.key} className="flex items-center group">
              <button
                type="button"
                onClick={() => { onPick(m); setQuery('') }}
                className="flex-1 flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
              >
                <span className="text-slate-200 truncate">
                  {m.name}
                  {m.legendary > 0 && <Crown size={10} className="inline ml-1.5 text-amber-300" />}
                  {m.custom && <span className="ml-1.5 text-[9px] uppercase tracking-wider text-amber-400">mine</span>}
                </span>
                <span className="text-slate-500 flex-shrink-0">CR {m.cr || '?'} · AC {m.ac ?? '—'} · {m.hp ?? '—'}hp</span>
              </button>
              {m.custom && onDeleteCustom && (
                <button
                  type="button"
                  onClick={() => onDeleteCustom(m.custom!.id)}
                  className="px-2 text-slate-700 hover:text-red-400 transition-colors"
                  title="Delete from My monsters"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
