import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseKiosk as supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import { Flame, Delete, ShieldAlert, CheckCircle, ChevronLeft } from 'lucide-react'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 30

export default function KioskEmergency() {
  const navigate = useNavigate()
  const { site } = useSite()

  const [pin, setPin]               = useState('')
  const [attempts, setAttempts]     = useState(0)
  const [shake, setShake]           = useState(false)
  const [lockoutSecs, setLockoutSecs] = useState(0)
  const [triggering, setTriggering] = useState(false)
  const [success, setSuccess]       = useState<{ name: string; total: number } | null>(null)
  const [error, setError]           = useState('')

  // Lockout countdown
  useEffect(() => {
    if (lockoutSecs <= 0) return
    const id = setInterval(() => setLockoutSecs(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [lockoutSecs])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  const submitPin = useCallback(async (finalPin: string) => {
    if (!site || triggering) return
    setTriggering(true)
    setError('')

    const { data, error: rpcErr } = await supabase.rpc('trigger_emergency_evacuation', {
      p_site_id: site.id,
      p_pin: finalPin,
      p_muster_point: null,
    })

    setTriggering(false)

    if (rpcErr || !data) {
      triggerShake()
      setPin('')
      setError('Something went wrong. Try again.')
      return
    }

    const result = data as { success: boolean; error?: string; triggered_by?: string; total_on_site?: number }

    if (!result.success) {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      setPin('')
      triggerShake()

      if (newAttempts >= MAX_ATTEMPTS) {
        setLockoutSecs(LOCKOUT_SECONDS)
        setAttempts(0)
        setError('')
      } else {
        setError(result.error === 'An evacuation is already active'
          ? 'An evacuation is already active.'
          : `Invalid PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? '' : 's'} remaining.`)
      }
      return
    }

    setSuccess({ name: result.triggered_by ?? 'Unknown', total: result.total_on_site ?? 0 })
  }, [site, attempts, triggering])

  const pressDigit = (d: string) => {
    if (lockoutSecs > 0 || triggering || success) return
    const next = (pin + d).slice(0, 4)
    setPin(next)
    setError('')
    if (next.length === 4) submitPin(next)
  }

  const backspace = () => {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  // ── Success screen ────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-8 select-none"
        style={{ background: 'linear-gradient(160deg, #7f1d1d 0%, #991b1b 45%, #b91c1c 100%)' }}>
        <div className="w-20 h-20 rounded-full bg-white/10 border-4 border-white/30 flex items-center justify-center mb-6">
          <CheckCircle size={44} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">Evacuation Triggered</h1>
        <p className="text-white/60 text-lg mb-1">Triggered by <span className="text-white font-semibold">{success.name}</span></p>
        <p className="text-white/40 text-sm mb-10">{success.total} {success.total === 1 ? 'person' : 'people'} on the roll call</p>
        <p className="text-white/50 text-sm max-w-xs">
          Staff can be marked as accounted for from the admin portal.
        </p>
        <button
          onClick={() => navigate('/kiosk')}
          className="mt-10 text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          Return to kiosk home
        </button>
      </div>
    )
  }

  // ── PIN entry screen ──────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center select-none"
      style={{ background: 'linear-gradient(160deg, #7f1d1d 0%, #991b1b 45%, #b91c1c 100%)' }}
    >
      {/* Back */}
      <button
        onClick={() => navigate('/kiosk')}
        className="absolute top-6 left-6 flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
      >
        <ChevronLeft size={18} /> Back
      </button>

      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center mx-auto mb-4">
          <Flame size={32} className="text-white animate-pulse" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">Emergency Evacuation</h1>
        <p className="text-white/50 text-sm">
          {lockoutSecs > 0
            ? `Too many attempts. Try again in ${lockoutSecs}s`
            : 'Enter your 4-digit emergency PIN'}
        </p>
      </div>

      {/* PIN dots */}
      <div className={`flex gap-5 mb-3 ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
              i < pin.length
                ? 'bg-white border-white scale-110'
                : 'bg-transparent border-white/40'
            }`}
          />
        ))}
      </div>

      {/* Error message */}
      <div className="h-6 mb-6 text-center">
        {error && (
          <p className="text-red-200 text-sm flex items-center gap-1.5 justify-center">
            <ShieldAlert size={14} /> {error}
          </p>
        )}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <NumKey key={d} label={d} onPress={() => pressDigit(d)} disabled={lockoutSecs > 0 || triggering} />
        ))}
        {/* Bottom row: empty, 0, backspace */}
        <div />
        <NumKey label="0" onPress={() => pressDigit('0')} disabled={lockoutSecs > 0 || triggering} />
        <button
          onClick={backspace}
          disabled={lockoutSecs > 0 || triggering || pin.length === 0}
          className="h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white disabled:opacity-30 active:bg-white/20 transition-colors"
        >
          <Delete size={20} />
        </button>
      </div>

      {triggering && (
        <div className="mt-8 flex items-center gap-2 text-white/60 text-sm">
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          Verifying...
        </div>
      )}
    </div>
  )
}

function NumKey({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className="h-16 rounded-2xl bg-white/10 border border-white/20 text-white text-2xl font-bold disabled:opacity-30 active:bg-white/25 hover:bg-white/15 transition-colors"
    >
      {label}
    </button>
  )
}
