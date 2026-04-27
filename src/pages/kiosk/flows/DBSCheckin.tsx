import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseKiosk as supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import { ChevronLeft, ChevronRight, CheckCircle, ShieldCheck, Search } from 'lucide-react'
import type { Person } from '@/types'

type Step = 'details' | 'host' | 'rules' | 'success'

interface FormData {
  first_name: string
  last_name: string
  company: string
  dbs_number: string
  email: string
  phone: string
  host: Person | null
}

const SITE_RULES = [
  'Please wear your visitor badge visibly at all times.',
  'You must remain in pre-approved areas only unless escorted.',
  'Photography and recording on school premises is not permitted.',
  'Please report any safeguarding concerns immediately to reception.',
  'Your DBS clearance has been noted and is subject to verification.',
  'In an emergency, please follow staff instructions and evacuate to the muster point.',
]

export default function DBSCheckin() {
  const navigate = useNavigate()
  const { site } = useSite()
  const [step, setStep] = useState<Step>('details')
  const [form, setForm] = useState<FormData>({
    first_name: '', last_name: '', company: '',
    dbs_number: '', email: '', phone: '', host: null,
  })
  const [hostSearch, setHostSearch] = useState('')
  const [hostResults, setHostResults] = useState<Person[]>([])
  const [hostLoading, setHostLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (hostSearch.length < 2) {
      setHostResults([])
      return
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setHostLoading(true)
      const { data } = await supabase
        .from('persons')
        .select('id, first_name, last_name, full_name, department, email')
        .in('group', ['teaching_staff', 'non_teaching_staff'])
        .eq('is_active', true)
        .ilike('full_name', `%${hostSearch}%`)
        .limit(8)
      setHostResults((data as Person[]) ?? [])
      setHostLoading(false)
    }, 300)
  }, [hostSearch])

  function update(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const detailsValid =
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.company.trim() &&
    form.dbs_number.trim()

  async function handleSubmit() {
    if (!site) return
    setSubmitting(true)
    setError('')

    const { data: visitorData, error: vErr } = await supabase
      .from('visitors')
      .insert({
        site_id: site.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        full_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim(),
        visitor_type: 'contractor',
        nda_signed: true,
        nda_signed_at: new Date().toISOString(),
        notes: `DBS Number: ${form.dbs_number.trim()}`,
      })
      .select('id')
      .single()

    if (vErr || !visitorData) {
      setError('Could not register visitor. Please try again.')
      setSubmitting(false)
      return
    }

    const { error: lErr } = await supabase
      .from('visit_logs')
      .insert({
        site_id: site.id,
        visitor_id: visitorData.id,
        host_person_id: form.host?.id ?? null,
        host_name: form.host?.full_name ?? null,
        host_email: form.host?.email ?? null,
        purpose: `DBS-cleared contractor — ${form.company.trim()}`,
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        badge_printed: false,
      })

    if (lErr) {
      setError('Could not create visit record. Please try again.')
      setSubmitting(false)
      return
    }

    setStep('success')
    setSubmitting(false)
    setTimeout(() => navigate('/kiosk'), 5000)
  }

  // ─── Success ────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="w-20 h-20 rounded-full bg-purple-500 flex items-center justify-center">
          <CheckCircle size={44} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white">Signed In!</h2>
          <p className="text-brand-200 mt-1 text-lg">Welcome, {form.first_name}</p>
        </div>
        <div className="bg-white/10 rounded-2xl px-6 py-4 text-white space-y-1">
          <p className="text-sm text-brand-200">DBS Check-In recorded</p>
          <p className="font-bold">{form.company}</p>
          <p className="text-sm text-brand-300">
            {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {form.host && (
          <p className="text-brand-300 text-sm">
            {form.host.full_name} has been notified of your arrival
          </p>
        )}
        <p className="text-brand-300 text-sm">Returning to home screen…</p>
      </div>
    )
  }

  // ─── Site Rules ─────────────────────────────────────────────────────────────
  if (step === 'rules') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('host')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Contractor Rules</h2>
            <p className="text-brand-200 text-sm">Please read and accept before entering</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 space-y-3 max-h-[320px] overflow-y-auto">
          {SITE_RULES.map((rule, i) => (
            <div key={i} className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-purple-600 mt-0.5 flex-shrink-0" />
              <p className="text-gray-700 text-sm">{rule}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-white text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-kiosk bg-purple-600 text-white hover:bg-purple-700 w-full"
        >
          {submitting ? (
            <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle size={28} />
          )}
          {submitting ? 'Signing in…' : 'I Accept — Sign Me In'}
        </button>
      </div>
    )
  }

  // ─── Host (Who to See) ──────────────────────────────────────────────────────
  if (step === 'host') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('details')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Who to see?</h2>
            <p className="text-brand-200 text-sm">Search for the member of staff you're working with</p>
          </div>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-900 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-white/50"
            placeholder="Type a name…"
            value={hostSearch}
            onChange={e => { setHostSearch(e.target.value); setForm(f => ({ ...f, host: null })) }}
            autoFocus
          />
        </div>

        {form.host && (
          <div className="bg-white rounded-2xl px-5 py-3 flex items-center gap-3 border-2 border-purple-400">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm flex-shrink-0">
              {form.host.first_name[0]}{form.host.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{form.host.full_name}</p>
              <p className="text-xs text-gray-400">{form.host.department ?? 'Staff'}</p>
            </div>
            <CheckCircle size={20} className="text-purple-500 flex-shrink-0" />
          </div>
        )}

        {!form.host && hostSearch.length >= 2 && (
          <div className="bg-white rounded-2xl overflow-hidden max-h-[240px] overflow-y-auto">
            {hostLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : hostResults.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No staff found</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {hostResults.map(p => (
                  <li key={p.id}>
                    <button
                      onClick={() => { setForm(f => ({ ...f, host: p })); setHostSearch(p.full_name) }}
                      className="w-full text-left px-5 py-3.5 hover:bg-purple-50 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs flex-shrink-0">
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{p.full_name}</p>
                        <p className="text-xs text-gray-400">{p.department ?? 'Staff'}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          onClick={() => setStep('rules')}
          className="btn-kiosk bg-purple-600 text-white hover:bg-purple-700 w-full mt-1"
        >
          {form.host ? 'Continue' : 'Skip — Continue Without Host'}
          <ChevronRight size={24} />
        </button>
      </div>
    )
  }

  // ─── Details Form ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/kiosk/signin')}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">DBS Contractor Sign In</h2>
          <p className="text-brand-200 text-sm">Please enter your details</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">First name <span className="text-red-400">*</span></label>
            <input
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="John"
              value={form.first_name}
              onChange={e => update('first_name', e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Last name <span className="text-red-400">*</span></label>
            <input
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Smith"
              value={form.last_name}
              onChange={e => update('last_name', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Company / Organisation <span className="text-red-400">*</span></label>
          <input
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="ABC Contractors Ltd"
            value={form.company}
            onChange={e => update('company', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
            <ShieldCheck size={12} className="text-purple-600" />
            DBS Certificate Number <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
            placeholder="001234567890"
            value={form.dbs_number}
            onChange={e => update('dbs_number', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Email <span className="text-gray-300">(optional)</span></label>
          <input
            type="email"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="john@example.com"
            value={form.email}
            onChange={e => update('email', e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={() => setStep('host')}
        disabled={!detailsValid}
        className="btn-kiosk bg-purple-600 text-white hover:bg-purple-700 w-full disabled:opacity-40"
      >
        Continue
        <ChevronRight size={24} />
      </button>
    </div>
  )
}
