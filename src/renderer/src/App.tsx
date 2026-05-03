import { useUIStore } from './store/uiStore'
import { Sidebar } from './components/layout/Sidebar'
import { GlobalSearch } from './components/layout/GlobalSearch'
import { LibraryPage } from './pages/LibraryPage'
import { PartyPage } from './pages/PartyPage'
import { SessionsPage } from './pages/SessionsPage'
import { MapPage } from './pages/MapPage'

export function App() {
  const { currentPage } = useUIStore()

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden">
        {currentPage === 'library'  && <LibraryPage />}
        {currentPage === 'party'    && <PartyPage />}
        {currentPage === 'sessions' && <SessionsPage />}
        {currentPage === 'maps'     && <MapPage />}
      </main>
      <GlobalSearch />
    </div>
  )
}
