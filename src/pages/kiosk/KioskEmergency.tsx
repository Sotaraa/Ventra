import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseKiosk as supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import { Flame, Delete, ShieldAlert, CheckCircle, ChevronLeft, Users } from 'lucide-react'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 30

// ─── Types ────────────────────────────────────────────────────────────────────

interface RollCallItem {
  id: string
  name: string
  group_label: string
  accounted: boolean
  accounted_at: string | null
}

interface EvacuationSuccess {
  name: string
  total: number
  eventId: string
}

// ─── Group display helpers ─────────────────────────────────────────────────────

const GROUP_ORDER = ['teaching_staff', 'non_teaching_staff', 'student', 'contractor', 'governor', 'visitor']

const GROUP_LABEL: Record<string, string> = {
  teaching_staff:     'Teaching Staff',
  non_teaching_staff: 'Non-Teaching Staff',
  student:            'Students',
  contractor:         'Contractors',
  governor:           'Governors',
  visitor:            'Visitors',
}

function groupLabel(g: string) {
  return GROUP_LABEL[g] ?? g
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KioskEmergency() {
  const navigate = useNavigate()
  const { site } = useSite()

  const [pin, setPin]               = useState('')
  const [attempts, setAttempts]     = useState(0)
  const [shake, setShake]           = useState(false)
  const [lockoutSecs, setLockoutSecs] = useState(0)
  const [triggering, setTriggering] = useState(false)
  const [success, setSuccess]       = useState<EvacuationSuccess | null>(null)
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

    const result = data as {
      success: boolean
      error?: string
      event_id?: string
      triggered_by?: string
      total_on_site?: number
    }

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

    setSuccess({
      name:    result.triggered_by ?? 'Unknown',
      total:   result.total_on_site ?? 0,
      eventId: result.event_id ?? '',
    })
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

  // ── Success → live roll call screen ──────────────────────────────────────────
  if (success) {
    return (
      <RollCallScreen
        eventId={success.eventId}
        triggeredBy={success.name}
        onDone={() => navigate('/kiosk')}
      />
    )
  }

  // ── PIN entry screen ──────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center select-none"
      style={{ background: 'linear-gradient(160deg, #7f1d1d 0%, #991b1b 45%, #b91c1c 100%)' }}
    >
      {/* Back button */}
      <div className="w-full px-6 pt-6 pb-2">
        <button
          onClick={() => navigate('/kiosk')}
          className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm"
        >
          <ChevronLeft size={18} /> Back to home
        </button>
      </div>

      {/* Header + numpad */}
      <div className="flex-1 flex flex-col items-center justify-center w-full">
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
    </div>
  )
}

// ─── Roll Call Screen ─────────────────────────────────────────────────────────

function RollCallScreen({
  eventId,
  triggeredBy,
  onDone,
}: {
  eventId: string
  triggeredBy: string
  onDone: () => void
}) {
  const [items, setItems]   = useState<RollCallItem[]>([])
  const [loading, setLoading] = useState(true)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchItems = useCallback(async () => {
    if (!eventId) return
    const { data } = await supabase
      .from('evacuation_roll_calls')
      .select('id, name, group_label, accounted, accounted_at')
      .eq('evacuation_event_id', eventId)
      .order('group_label')
      .order('name')
    if (data) setItems(data as RollCallItem[])
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    fetchItems()
    // Poll every 5s so marks from the admin portal show up here too
    pollingRef.current = setInterval(fetchItems, 5000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [fetchItems])

  const markAccounted = async (item: RollCallItem) => {
    if (item.accounted) return
    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, accounted: true, accounted_at: new Date().toISOString() } : i))
    await supabase
      .from('evacuation_roll_calls')
      .update({ accounted: true, accounted_at: new Date().toISOString() })
      .eq('id', item.id)
  }

  const accounted = items.filter(i => i.accounted).length
  const total     = items.length
  const allDone   = total > 0 && accounted === total
  const pct       = total > 0 ? Math.round((accounted / total) * 100) : 0

  // Group items
  const groups = GROUP_ORDER
    .map(g => ({ key: g, label: groupLabel(g), people: items.filter(i => i.group_label === g) }))
    .filter(g => g.people.length > 0)

  // Also catch any group_label values not in GROUP_ORDER
  const knownGroups = new Set(GROUP_ORDER)
  const extraGroups = [...new Set(items.map(i => i.group_label).filter(g => !knownGroups.has(g)))]
  extraGroups.forEach(g => groups.push({ key: g, label: groupLabel(g), people: items.filter(i => i.group_label === g) }))

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{ background: 'linear-gradient(160deg, #7f1d1d 0%, #991b1b 45%, #b91c1c 100%)' }}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <Flame size={16} className="text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Evacuation in Progress</h1>
            <p className="text-white/40 text-xs">Triggered by {triggeredBy}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/60 text-sm">
              {loading ? 'Loading roll call…' : `${accounted} of ${total} accounted`}
            </span>
            {!loading && (
              <span className={`text-sm font-bold ${allDone ? 'text-green-300' : 'text-white'}`}>
                {pct}%
              </span>
            )}
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-400' : 'bg-white'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {allDone && (
            <div className="flex items-center gap-1.5 mt-2 text-green-300 text-sm font-semibold">
              <CheckCircle size={15} />
              All personnel accounted for
            </div>
          )}
        </div>

        <div className="mt-3 h-px bg-white/10" />
      </div>

      {/* Roll call list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-white/50">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm">Loading roll call…</span>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/40">
            <Users size={32} className="opacity-40" />
            <p className="text-sm">No one was signed in at time of trigger</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(group => (
              <div key={group.key}>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2 px-1">
                  {group.label} · {group.people.filter(p => p.accounted).length}/{group.people.length}
                </p>
                <div className="space-y-2">
                  {group.people.map(person => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      onMark={() => markAccounted(person)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 flex-shrink-0 border-t border-white/10">
        <p className="text-white/30 text-xs text-center mb-3">
          Tap a name to mark as accounted &bull; Admin portal shows live updates
        </p>
        <button
          onClick={onDone}
          className="w-full py-3 rounded-2xl bg-white/10 border border-white/20 text-white/60 hover:text-white hover:bg-white/15 transition-colors text-sm font-medium"
        >
          Return to kiosk home
        </button>
      </div>
    </div>
  )
}

// ─── Person Row ───────────────────────────────────────────────────────────────

function PersonRow({ person, onMark }: { person: RollCallItem; onMark: () => void }) {
  return (
    <button
      onClick={onMark}
      disabled={person.accounted}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] text-left ${
        person.accounted
          ? 'bg-green-900/40 border-green-500/30 cursor-default'
          : 'bg-white/10 border-white/15 hover:bg-white/15 active:bg-white/20'
      }`}
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
        person.accounted ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/60'
      }`}>
        {person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
      </div>

      {/* Name */}
      <span className={`flex-1 font-semibold text-base leading-tight ${
        person.accounted ? 'text-green-200' : 'text-white'
      }`}>
        {person.name}
      </span>

      {/* Status */}
      {person.accounted ? (
        <CheckCircle size={22} className="text-green-400 flex-shrink-0" />
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-white/30 flex-shrink-0" />
      )}
    </button>
  )
}

// ─── Numpad key ───────────────────────────────────────────────────────────────

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
