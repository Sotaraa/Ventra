import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Site } from '@/types'

interface AppContextValue {
  currentSite: Site | null
  setCurrentSite: (site: Site | null) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  darkMode: boolean
  toggleDarkMode: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentSite, setCurrentSite] = useState<Site | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('ventra-theme') === 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
      localStorage.setItem('ventra-theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('ventra-theme', 'light')
    }
  }, [darkMode])

  function toggleDarkMode() {
    setDarkMode(prev => !prev)
  }

  return (
    <AppContext.Provider value={{ currentSite, setCurrentSite, sidebarOpen, setSidebarOpen, darkMode, toggleDarkMode }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
