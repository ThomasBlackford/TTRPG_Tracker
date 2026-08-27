import { useUIStore } from './store/uiStore'
import { useSettings } from './contexts/SettingsContext'
import { Sidebar } from './components/layout/Sidebar'
import { GlobalSearch } from './components/layout/GlobalSearch'
import { SettingsButton } from './components/layout/SettingsButton'
import { UpdateBanner } from './components/layout/UpdateBanner'
import { SecretMessagesWidget } from './components/party/SecretMessagesWidget'
import { LibraryPage } from './pages/LibraryPage'
import { PartyPage } from './pages/PartyPage'
import { SessionsPage } from './pages/SessionsPage'
import { MapPage } from './pages/MapPage'
import { EncounterPage } from './pages/EncounterPage'
import { TimelinePage } from './pages/TimelinePage'

export function App() {
  const { currentPage } = useUIStore()
  const { sidebar } = useSettings()

  const main = (
    <main className="flex-1 flex overflow-hidden">
      {currentPage === 'library'  && <LibraryPage />}
      {currentPage === 'party'    && <PartyPage />}
      {currentPage === 'sessions' && <SessionsPage />}
      {currentPage === 'maps'     && <MapPage />}
      {currentPage === 'encounter' && <EncounterPage />}
      {currentPage === 'timeline'  && <TimelinePage />}
    </main>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      {sidebar === 'right' ? (
        <>
          {main}
          <Sidebar />
        </>
      ) : (
        <>
          <Sidebar />
          {main}
        </>
      )}
      <GlobalSearch />
      <SecretMessagesWidget />
      <SettingsButton />
      <UpdateBanner />
    </div>
  )
}
