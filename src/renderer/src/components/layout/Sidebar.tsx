import { useEffect, useState } from 'react'
import { BookOpen, Users, Search, Map, Swords, CalendarDays } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useSettings } from '../../contexts/SettingsContext'
import type { Page } from '../../types'

const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: 'party',     label: 'Party',     icon: <Users size={17} /> },
  { page: 'encounter', label: 'Encounter', icon: <Swords size={17} /> },
  { page: 'maps',      label: 'Maps',      icon: <Map size={17} /> },
  { page: 'library',   label: 'Library',   icon: <BookOpen size={17} /> },
  { page: 'timeline',  label: 'Timeline',  icon: <CalendarDays size={17} /> }
]

export function Sidebar() {
  const { currentPage, setCurrentPage, setSearchOpen } = useUIStore()
  const { sidebar } = useSettings()
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.app.version().then(setVersion).catch(() => {})
  }, [])

  return (
    <aside
      className={`w-52 flex-shrink-0 bg-surface-raised flex flex-col ${
        sidebar === 'right' ? 'border-l border-border' : 'border-r border-border'
      }`}
    >
      <div className="px-5 pt-6 pb-5">
        <h1 className="font-display text-white text-lg font-semibold tracking-[0.18em] uppercase">LoreKeeper</h1>
        <p className="text-amber-400/80 text-[10px] uppercase tracking-[0.3em] mt-1">Game Master</p>
      </div>

      <button
        onClick={() => setSearchOpen(true)}
        className="mx-4 mb-5 flex items-center gap-2 px-3 py-2 bg-surface-overlay border border-border
                   text-slate-500 hover:text-slate-200 hover:border-amber-500/50 transition-colors text-xs"
      >
        <Search size={13} />
        <span>Search library</span>
        <kbd className="ml-auto text-[10px] text-slate-600 font-mono">Ctrl K</kbd>
      </button>

      <nav className="flex-1">
        {navItems.map(({ page, label, icon }) => {
          const active = currentPage === page
          return (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`relative w-full flex items-center gap-3 pl-6 pr-4 py-3 text-xs uppercase tracking-[0.14em] transition-colors ${
                active
                  ? 'text-white bg-gradient-to-r from-amber-500/25 to-transparent'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <span
                className={`absolute left-0 top-0 bottom-0 w-[3px] transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}
                style={{ background: 'var(--gradient-brand)' }}
              />
              {icon}
              {label}
            </button>
          )
        })}
      </nav>

      <div className="px-6 py-4 border-t border-border">
        <p className="text-slate-600 text-[10px] tracking-widest uppercase">{version ? `v${version}` : ''}</p>
      </div>
    </aside>
  )
}
