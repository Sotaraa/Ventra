import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { AppProvider } from '@/store/AppContext'

export default function AppShell() {
  return (
    <AppProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
