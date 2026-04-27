import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserCheck, ClipboardList,
  BarChart2, Settings, LogOut, ShieldAlert, QrCode,
  Bell, BookOpen, X, Flame,
} from 'lucide-react'
import { useAuth } from '@/store/AuthContext'
import { useApp } from '@/store/AppContext'
import Logo from '@/components/Logo'
import type { UserRole } from '@/types'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles: UserRole[]
  group?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard',    path: '/admin',               icon: <LayoutDashboard size={18} />, roles: ['super_admin', 'site_admin'],                           group: 'Overview' },
  { label: 'Reception',    path: '/reception',           icon: <Bell size={18} />,            roles: ['super_admin', 'site_admin', 'reception'],              group: 'Daily' },
  { label: 'Visitors',     path: '/reception/visitors',  icon: <QrCode size={18} />,          roles: ['super_admin', 'site_admin', 'reception'],              group: 'Daily' },
  { label: 'Attendance',   path: '/attendance',          icon: <UserCheck size={18} />,       roles: ['super_admin', 'site_admin', 'reception', 'teacher'],   group: 'Daily' },
  { label: 'Register',     path: '/attendance/register', icon: <BookOpen size={18} />,        roles: ['super_admin', 'site_admin', 'teacher'],                group: 'Daily' },
  { label: 'People',       path: '/admin/people',        icon: <Users size={18} />,           roles: ['super_admin', 'site_admin'],                           group: 'Admin' },
  { label: 'Safeguarding', path: '/admin/safeguarding',  icon: <ShieldAlert size={18} />,     roles: ['super_admin', 'site_admin'],                           group: 'Admin' },
  { label: 'Emergency',    path: '/admin/evacuation',    icon: <Flame size={18} />,           roles: ['super_admin', 'site_admin'],                           group: 'Admin' },
  { label: 'Reports',      path: '/admin/reports',       icon: <BarChart2 size={18} />,       roles: ['super_admin', 'site_admin'],                           group: 'Admin' },
  { label: 'Audit Log',    path: '/admin/audit',         icon: <ClipboardList size={18} />,   roles: ['super_admin', 'site_admin'],                           group: 'Admin' },
  { label: 'Settings',     path: '/admin/settings',      icon: <Settings size={18} />,        roles: ['super_admin', 'site_admin'],                           group: 'Admin' },
]

export default function Sidebar() {
  const { profile, user, signOut } = useAuth()
  const { sidebarOpen, setSidebarOpen } = useApp()

  const role = profile?.role ?? null
  const visible = role ? navItems.filter(item => item.roles.includes(role)) : []

  // Group nav items
  const groups = visible.reduce<Record<string, NavItem[]>>((acc, item) => {
    const g = item.group ?? 'Other'
    ;(acc[g] ??= []).push(item)
    return acc
  }, {})

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-30 h-full w-64 flex flex-col
          bg-brand-950 text-white
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.07]">
          <Logo size={34} />
          <button
            className="lg:hidden text-white/40 hover:text-white transition-colors p-1"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                {group}
              </p>
              <ul className="space-y-0.5">
                {items.map(item => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/admin'}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-touch
                        ${isActive
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          : 'text-white/50 hover:bg-white/[0.06] hover:text-white/90'
                        }`
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-white/[0.07] bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-700 border border-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0 text-amber-400">
              {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white/90">
                {profile?.full_name ?? user?.email?.split('@')[0] ?? '…'}
              </p>
              <p className="text-[11px] text-white/35 capitalize tracking-wide">
                {role ? role.replace(/_/g, ' ') : '…'}
              </p>
            </div>
            <button
              onClick={signOut}
              className="text-white/30 hover:text-red-400 transition-colors p-1"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
