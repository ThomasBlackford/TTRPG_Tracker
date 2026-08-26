import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type StyleTheme = 'fantasy' | 'modern'
export type ColorTheme = 'amber' | 'crimson' | 'arcane'
export type SidebarSide = 'left' | 'right'

interface Settings {
  style: StyleTheme
  color: ColorTheme
  sidebar: SidebarSide
}

const DEFAULT_SETTINGS: Settings = { style: 'fantasy', color: 'amber', sidebar: 'left' }
const STORAGE_KEY = 'lorekeeper-dm-settings'

interface SettingsContextValue extends Settings {
  setStyle: (v: StyleTheme) => void
  setColor: (v: ColorTheme) => void
  setSidebar: (v: SidebarSide) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  // Reflect settings onto <html> as data attributes — that's what the CSS
  // variables in index.css key off of. Deliberately NOT applied to the
  // presentation window (see main.tsx) — the DM's personal theme choice
  // should never bleed into what's projected to players.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    document.documentElement.setAttribute('data-style', settings.style)
    document.documentElement.setAttribute('data-color', settings.color)
  }, [settings])

  const value: SettingsContextValue = {
    ...settings,
    setStyle: (style) => setSettings((s) => ({ ...s, style })),
    setColor: (color) => setSettings((s) => ({ ...s, color })),
    setSidebar: (sidebar) => setSettings((s) => ({ ...s, sidebar }))
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
