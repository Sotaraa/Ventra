import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseKiosk as supabase } from '@/lib/supabase'
import { Search, CheckCircle, ChevronLeft, User } from 'lucide-react'

type Step = 'search' | 'reason' | 'success'

interface CheckedInVisitor {
  visit_log_id: string
  visitor_id: string
  full_name: string
  company?: string
  purpose?: string
  checked_in_at: string
}

const REASONS = [
  { key: 'visit_complete',  label: 'Visit complete',       emoji: '✅' },
  { key: 'returning_later', label: 'Returning later today', emoji: '🔄' },
  { key: 'emergency',       label: 'Emergency departure',   emoji: '🚨' },
  { key: 'other',           label: 'Other',                 emoji: '📝' },
]

export default function VisitorCheckout() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('search')
  const [visitors, setVisitors] = useState<CheckedInVisitor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CheckedInVisitor | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadCheckedIn() {
      setLoading(true)
      const { data } = await supabase
        .from('visit_logs')
        .select(`
          id,
          visitor_id,
          purpose,
          checked_in_at,
          visitors (
            full_name,
            company
          )
        `)
        .eq('status', 'checked_in')
        .order('checked_in_at', { ascending: false })

      if (data) {
        setVisitors(
          data.map((row: any) => ({
            visit_log_id: row.id,
            visitor_id: row.visitor_id,
            full_name: row.visitors?.full_name ?? 'Unknown',
            company: row.visitors?.company,
            purpose: row.purpose,
            checked_in_at: row.checked_in_at,
          }))
        )
      }
      setLoading(false)
    }
    loadCheckedIn()
  }, [])

  const filtered = visitors.filter(v =>
    v.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (v.company ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleCheckout(reasonKey: string) {
    if (!selected) return
    setSubmitting(true)
    setError('')
    setReason(reasonKey)

    const { error: err } = await supabase
      .from('visit_logs')
      .update({
        checked_out_at: new Date().toISOString(),
        status: 'checked_out',
        check_out_reason: reasonKey,
      })
      .eq('id', selected.visit_log_id)

    if (err) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    setStep('success')
    setSubmitting(false)
    setTimeout(() => navigate('/kiosk'), 4000)
  }

  if (step === 'success' && selected) {
    const reasonLabel = REASONS.find(r => r.key === reason)?.label ?? reason
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center">
          <CheckCircle size={44} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white">Checked Out!</h2>
          <p className="text-brand-200 mt-1 text-lg">Thank you for visiting, {selected.full_name.split(' ')[0]}</p>
        </div>
        <div className="bg-white/10 rounded-2xl px-6 py-4 text-white space-y-1">
          <p className="text-sm text-brand-200">Time out</p>
          <p className="text-xl font-bold">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-sm text-brand-300">{reasonLabel}</p>
        </div>
        <p className="text-brand-300 text-sm">Returning to home screen…</p>
      </div>
    )
  }

  if (step === 'reason' && selected) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Reason for leaving?</h2>
          <p className="text-brand-200 text-sm">{selected.full_name}</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-white text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2.5">
          {REASONS.map(r => (
            <button
              key={r.key}
              onClick={() => handleCheckout(r.key)}
              disabled={submitting}
              className="bg-white rounded-2xl px-5 py-4 text-left flex items-center gap-4 hover:shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="text-2xl w-8 text-center flex-shrink-0">{r.emoji}</span>
              <span className="font-semibold text-gray-900">{r.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setStep('search')}
          className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
        >
          ← Back
        </button>
      </div>
    )
  }

  // Step: search
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/kiosk/signout')}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">Visitor Sign Out</h2>
          <p className="text-brand-200 text-sm">Find your name below</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-900 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-white/50"
          placeholder="Search your name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Visitor list */}
      <div className="bg-white rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <User size={32} className="mx-auto mb-2 opacity-40" />
            <p className="font-medium">No visitors currently on site</p>
            <p className="text-sm mt-1">You may have already signed out</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(v => (
              <li key={v.visit_log_id}>
                <button
                  onClick={() => { setSelected(v); setStep('reason') }}
                  className="w-full text-left px-5 py-4 hover:bg-amber-50 active:bg-amber-100 transition-colors flex items-center gap-4 min-h-[64px]"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm flex-shrink-0">
                    {v.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{v.full_name}</p>
                    <p className="text-sm text-gray-400 truncate">
                      {v.company ? `${v.company} · ` : ''}
                      In since {new Date(v.checked_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-brand-300 text-xs">
        {filtered.length} {filtered.length === 1 ? 'visitor' : 'visitors'} on site
      </p>
    </div>
  )
}
