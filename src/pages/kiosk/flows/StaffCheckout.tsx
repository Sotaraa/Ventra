import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseKiosk as supabase } from '@/lib/supabase'
import PersonBrowser from '@/components/kiosk/PersonBrowser'
import { CheckCircle } from 'lucide-react'
import type { Person } from '@/types'

type Step = 'browse' | 'reason' | 'success'

const REASONS = [
  { key: 'finish_day',     label: 'Finish for the day',      emoji: '🏠' },
  { key: 'lunch_break',    label: 'Lunch break',              emoji: '🍽️' },
  { key: 'short_break',    label: 'Short break',              emoji: '☕' },
  { key: 'medical',        label: 'Medical appointment',      emoji: '🏥' },
  { key: 'field_trip',     label: 'Field trip / Site visit',  emoji: '🚌' },
  { key: 'training',       label: 'Training / CPD',           emoji: '📚' },
  { key: 'changing_sites', label: 'Changing sites',           emoji: '🔄' },
  { key: 'personal',       label: 'Personal',                 emoji: '👤' },
  { key: 'other',          label: 'Other',                    emoji: '📝' },
]

export default function StaffCheckout() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('browse')
  const [selected, setSelected] = useState<Person | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignOut(reasonKey: string) {
    if (!selected) return
    setLoading(true)
    setError('')
    setReason(reasonKey)

    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // Find existing attendance record for today
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('person_id', selected.id)
      .eq('date', today)
      .is('signed_out_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      // Update existing record
      const { error: err } = await supabase
        .from('attendance_records')
        .update({ signed_out_at: now, sign_out_reason: reasonKey, status: getStatus(reasonKey) })
        .eq('id', existing.id)

      if (err) {
        setError('Something went wrong. Please try again.')
        setLoading(false)
        return
      }
    } else {
      // No sign-in record found — create one showing left early / late arrival
      const { error: err } = await supabase
        .from('attendance_records')
        .insert({
          site_id: null, // will be filled by trigger or admin
          person_id: selected.id,
          date: today,
          status: getStatus(reasonKey),
          signed_out_at: now,
          sign_out_reason: reasonKey,
        })

      if (err) {
        setError('Something went wrong. Please try again.')
        setLoading(false)
        return
      }
    }

    setStep('success')
    setLoading(false)
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
          <h2 className="text-3xl font-bold text-white">Signed Out!</h2>
          <p className="text-brand-200 mt-1 text-lg">Take care, {selected.first_name}</p>
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
              onClick={() => handleSignOut(r.key)}
              disabled={loading}
              className="bg-white rounded-2xl px-5 py-4 text-left flex items-center gap-4 hover:shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="text-2xl w-8 text-center flex-shrink-0">{r.emoji}</span>
              <span className="font-semibold text-gray-900">{r.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setStep('browse')}
          className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
        >
          ← Back
        </button>
      </div>
    )
  }

  return (
    <PersonBrowser
      groups={['teaching_staff', 'non_teaching_staff']}
      title="Staff Sign Out"
      subtitle="Only staff currently signed in are shown"
      onlySignedIn
      onSelect={person => { setSelected(person); setStep('reason') }}
      onBack={() => navigate('/kiosk/signout')}
    />
  )
}

function getStatus(reasonKey: string) {
  // Any sign-out sets signed_out_at, so status must not stay 'present'
  // Dashboard uses signed_out_at IS NULL to determine who's physically on site
  if (['lunch_break', 'short_break'].includes(reasonKey)) return 'present' // brief absence, still attending today
  return 'left_early'
}
