import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthContext'
import { Shield, Clock, Users, CheckCircle, ArrowRight, Settings } from 'lucide-react'

// Full-page spinner matching the rest of the app
function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #022c22 0%, #064e3b 45%, #047857 100%)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        <p className="text-sm text-white/40">Loading Ventra...</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  // While Supabase processes the OAuth callback hash, show a spinner
  if (loading) return <FullPageSpinner />

  // Authenticated user hit / (e.g. after OAuth redirect) — send them to admin
  if (user) return <Navigate to="/admin" replace />

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{ background: 'linear-gradient(160deg, #022c22 0%, #064e3b 45%, #047857 100%)' }}
    >
      {/* ── Nav ── */}
      <header className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          {/* Ventra wordmark */}
          <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-base leading-none">V</span>
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none tracking-tight">Ventra</p>
            <p className="text-white/35 text-[10px] tracking-widest uppercase leading-none mt-0.5">by Sotara</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-white/60 hover:text-white border border-white/20 hover:border-white/40 transition-all text-sm px-4 py-2 rounded-lg"
        >
          <Settings size={14} />
          Admin Login
        </button>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-16">
        <div className="max-w-2xl">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/60 text-xs tracking-wide">School Visitor Management System</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
            Smarter sign-ins
            <br />
            <span className="text-emerald-300">for every school</span>
          </h1>

          <p className="text-white/50 text-lg leading-relaxed max-w-lg mx-auto mb-10">
            Ventra replaces paper registers with a modern kiosk that tracks staff, students, and visitors — all in one place.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://sotara.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-emerald-900 font-semibold px-6 py-3 rounded-xl hover:bg-emerald-50 transition-colors text-sm"
            >
              Learn more at Sotara
              <ArrowRight size={15} />
            </a>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 px-6 py-3 rounded-xl transition-all text-sm"
            >
              Admin portal
            </button>
          </div>
        </div>

        {/* ── Feature pills ── */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
          <FeatureCard
            icon={<Clock size={18} className="text-emerald-300" />}
            title="Real-time check-in"
            description="Touch-screen kiosk keeps an instant record of everyone on site"
          />
          <FeatureCard
            icon={<Shield size={18} className="text-emerald-300" />}
            title="Safeguarding built-in"
            description="DBS tracking, evacuation lists, and audit logs out of the box"
          />
          <FeatureCard
            icon={<Users size={18} className="text-emerald-300" />}
            title="AD sync"
            description="Pulls staff and student data directly from Microsoft Azure AD"
          />
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="flex items-center justify-between px-8 py-5 border-t border-white/[0.06]">
        <p className="text-white/20 text-xs">&copy; {new Date().getFullYear()} Sotara Ltd. All rights reserved.</p>
        <p className="text-white/20 text-xs">
          <CheckCircle size={11} className="inline mr-1" />
          Hosted securely on Vercel &amp; Supabase
        </p>
      </footer>
    </div>
  )
}

// ─── Feature card ─────────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-4 text-left">
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-white font-semibold text-sm mb-1">{title}</p>
      <p className="text-white/40 text-xs leading-relaxed">{description}</p>
    </div>
  )
}
