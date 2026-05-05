import { BookOpen, Users, ScrollText, Search, Map, Swords, CalendarDays } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import type { Page } from '../../types'

const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: 'library',  label: 'Library',  icon: <BookOpen size={18} /> },
  { page: 'party',    label: 'Party',    icon: <Users size={18} /> },
  { page: 'sessions', label: 'Sessions', icon: <ScrollText size={18} /> },
  { page: 'maps',     label: 'Maps',     icon: <Map size={18} /> },
  { page: 'encounter', label: 'Encounter', icon: <Swords size={18} /> },
  { page: 'timeline',  label: 'Timeline',  icon: <CalendarDays size={18} /> }
]

export function Sidebar() {
  const { currentPage, setCurrentPage, setSearchOpen } = useUIStore()

  return (
    <aside className="w-56 flex-shrink-0 bg-surface-raised border-r border-border flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <h1 className="font-display text-amber-400 text-lg font-semibold tracking-wide">
          LoreKeeper
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">Campaign Manager</p>
      </div>

      <button
        onClick={() => setSearchOpen(true)}
        className="mx-3 mt-4 flex items-center gap-2 px-3 py-2 rounded-lg
                   bg-surface-overlay border border-border text-slate-500 hover:text-slate-300
                   hover:border-border transition-colors text-sm"
      >
        <Search size={14} />
        <span>Search...</span>
        <kbd className="ml-auto text-xs bg-surface-base px-1.5 py-0.5 rounded border border-border font-mono">
          ⌘K
        </kbd>
      </button>

      <nav className="flex-1 px-3 mt-4 space-y-1">
        {navItems.map(({ page, label, icon }) => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              currentPage === page
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-border">
        <p className="text-slate-600 text-xs">v0.1.0</p>
      </div>
    </aside>
  )
}
