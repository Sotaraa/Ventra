import { Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Settings, AlertTriangle, LogIn, Flame } from 'lucide-react'
import { useSite } from '@/hooks/useSite'

export default function KioskLayout() {
  const { site, loading, noSlug } = useSite()

  // No ?site= param — show a clear error rather than silently loading a random school
  if (noSlug) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center select-none" style={{ background: 'linear-gradient(160deg, #022c22 0%, #064e3b 45%, #047857 100%)' }}>
        <div className="text-center max-w-sm px-6">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={28} className="text-amber-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No School Selected</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            This kiosk URL is missing a school identifier. Please use the full URL provided by your administrator.
          </p>
          <p className="text-white/25 text-xs font-mono">
            e.g. ventra.sotara.co.uk/kiosk?site=your-school
          </p>
        </div>
        <AdminMenu />
      </div>
    )
  }

  // Slug was found but no matching active site in DB — bad/stale slug in sessionStorage
  if (!loading && !site) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center select-none" style={{ background: 'linear-gradient(160deg, #022c22 0%, #064e3b 45%, #047857 100%)' }}>
        <div className="text-center max-w-sm px-6">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={28} className="text-amber-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">School Not Found</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            The school identifier in this URL is not recognised. Please check the URL and try again.
          </p>
          <p className="text-white/25 text-xs font-mono">
            e.g. ventra.sotara.co.uk/kiosk?site=your-school
          </p>
        </div>
        <AdminMenu />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: 'linear-gradient(160deg, #022c22 0%, #064e3b 45%, #047857 100%)' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">

        {/* School logo / name — left */}
        <SchoolBrand site={site} />

        {/* Sotara logo + clock — right */}
        <div className="flex items-center gap-6">
          <img
            src="/companylogo.png"
            alt="Sotara"
            className="h-8 w-auto opacity-70"
            style={{ mixBlendMode: 'screen' }}
          />
          <div className="text-right">
            <KioskClock />
          </div>
        </div>
      </header>

      {/* Subtle divider */}
      <div className="mx-8 h-px bg-white/[0.07]" />

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-6 py-8">
        <div className="w-full max-w-2xl">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative flex items-center justify-center py-4 px-6">
        <p className="text-white/25 text-xs tracking-wide">
          Touch the screen to begin &bull; Powered by Sotara.co.uk
        </p>
        <AdminMenu />
      </footer>
    </div>
  )
}

// ─── Admin Menu ───────────────────────────────────────────────────────────────

function AdminMenu() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close when tapping outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [open])

  return (
    <div ref={ref} className="absolute right-6 bottom-3">
      {/* Expandable menu — pops up above the cog */}
      {open && (
        <div className="absolute bottom-full right-0 mb-2 flex flex-col gap-1 items-end">
          <button
            onClick={() => { setOpen(false); navigate('/login') }}
            className="flex items-center gap-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-sm transition-all text-xs py-2 px-3 rounded-lg whitespace-nowrap"
          >
            <LogIn size={12} />
            Admin Login
          </button>
          <button
            onClick={() => { setOpen(false); navigate('/kiosk/emergency') }}
            className="flex items-center gap-2 text-red-300/80 hover:text-red-200 bg-red-900/30 hover:bg-red-900/50 border border-red-500/20 backdrop-blur-sm transition-all text-xs py-2 px-3 rounded-lg whitespace-nowrap"
          >
            <Flame size={12} />
            Emergency Evacuation
          </button>
        </div>
      )}

      {/* COG toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 transition-colors text-xs py-1 px-2 rounded ${
          open ? 'text-white/60' : 'text-white/20 hover:text-white/50'
        }`}
        title="Admin options"
      >
        <Settings size={11} className={open ? 'rotate-45 transition-transform duration-200' : 'transition-transform duration-200'} />
        Admin
      </button>
    </div>
  )
}

// ─── School Brand ─────────────────────────────────────────────────────────────

function SchoolBrand({ site }: { site: { name: string; logo_url?: string | null } | null }) {
  // While loading, render the same space to avoid layout shift
  if (!site) {
    return <div className="h-12 w-48 rounded-xl bg-white/[0.04] animate-pulse" />
  }

  return (
    <div className="flex items-center gap-4">
      {site.logo_url ? (
        /* Logo uploaded — show image + site name alongside */
        <>
          <img
            src={site.logo_url}
            alt={site.name}
            className="h-14 w-auto max-w-[200px] object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="border-l border-white/20 pl-4">
            <p className="text-base font-display font-semibold text-white leading-tight">{site.name}</p>
            <p className="text-xs text-white/40 tracking-widest uppercase mt-0.5">Visitor Check-In</p>
          </div>
        </>
      ) : (
        /* No logo — initial avatar + name */
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg leading-none">
              {site.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-lg font-display font-bold text-white leading-tight tracking-tight">{site.name}</p>
            <p className="text-xs text-white/40 tracking-widest uppercase mt-0.5">Visitor Check-In</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function KioskClock() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
      setDate(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <p className="text-3xl font-display font-bold text-white tabular-nums">{time}</p>
      <p className="text-xs text-white/40 text-right mt-0.5">{date}</p>
    </div>
  )
}
