import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/AuthContext'
import toast from 'react-hot-toast'
import { LogIn } from 'lucide-react'
import Logo from '@/components/Logo'

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  )
}

export default function LoginPage() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msLoading, setMsLoading] = useState(false)

  if (user) return <Navigate to="/admin" replace />

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) toast.error(error.message)
    setLoading(false)
  }

  async function handleMicrosoftLogin() {
    setMsLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        // Use just the origin — it always matches Supabase's "Site URL" without
        // needing additional redirect URL whitelisting in the dashboard.
        // After OAuth the root route detects the session and sends the user to /admin.
        redirectTo: window.location.origin,
      },
    })
    if (error) {
      toast.error(error.message)
      setMsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #022c22 0%, #064e3b 50%, #047857 100%)' }}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
      />

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10 gap-4">
          <Logo size={48} variant="mark" />
          <div className="text-center">
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">Ventra</h1>
            <p className="text-white/40 text-sm mt-1 tracking-wide">Staff & Admin Login</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#0e1a14] rounded-2xl shadow-card-lg p-8 border border-white/10">

          <h2 className="text-lg font-display font-bold text-gray-900 dark:text-white mb-6">
            Welcome back
          </h2>

          {/* Microsoft SSO */}
          <button
            onClick={handleMicrosoftLogin}
            disabled={msLoading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 border border-gray-200 dark:border-white/10 rounded-xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 transition-all disabled:opacity-50 mb-6 text-sm"
          >
            {msLoading
              ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <MicrosoftLogo />
            }
            {msLoading ? 'Redirecting…' : 'Continue with Microsoft'}
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.07]" />
            <span className="text-xs text-gray-400 font-medium">or email</span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.07]" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@school.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <LogIn size={16} />
              }
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <a href="/kiosk" className="text-white/30 hover:text-white/70 text-xs transition-colors">
            ← Back to visitor kiosk
          </a>
        </div>
      </div>
    </div>
  )
}
