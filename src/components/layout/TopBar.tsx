import { Menu, Bell, Sun, Moon, RefreshCw } from 'lucide-react'
import { useApp } from '@/store/AppContext'
import { useAuth } from '@/store/AuthContext'

interface TopBarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  const { setSidebarOpen, darkMode, toggleDarkMode } = useApp()
  const { profile } = useAuth()

  return (
    <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0e1a14]/80 backdrop-blur-md border-b border-gray-100 dark:border-white/[0.07] px-4 lg:px-6 py-3.5">
      <div className="flex items-center gap-4">
        {/* Mobile menu */}
        <button
          className="lg:hidden text-gray-400 hover:text-gray-700 dark:hover:text-white min-h-touch min-w-touch flex items-center justify-center transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={22} />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-display font-bold text-gray-900 dark:text-white truncate leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Actions slot */}
        <div className="flex items-center gap-2">
          {actions}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-all min-h-touch min-w-touch flex items-center justify-center"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Notifications */}
          <button className="relative p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-all min-h-touch min-w-touch flex items-center justify-center">
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-amber-500 rounded-full ring-2 ring-white dark:ring-[#0e1a14]" />
          </button>

          {/* Avatar */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-100 dark:border-white/[0.07]">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
              {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="btn-secondary py-2 px-3 text-sm"
    >
      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      Refresh
    </button>
  )
}
