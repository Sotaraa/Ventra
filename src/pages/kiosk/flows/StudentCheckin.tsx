import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseKiosk as supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import PersonBrowser from '@/components/kiosk/PersonBrowser'
import { CheckCircle, LogIn } from 'lucide-react'
import type { Person } from '@/types'

type Step = 'browse' | 'confirm' | 'success'

export default function StudentCheckin() {
  const navigate = useNavigate()
  const { site } = useSite()
  const [step, setStep] = useState<Step>('browse')
  const [selected, setSelected] = useState<Person | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn() {
    if (!selected || !site) return
    setLoading(true)
    setError('')

    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    const { error: err } = await supabase
      .from('attendance_records')
      .insert({
        site_id: site.id,
        person_id: selected.id,
        date: today,
        status: 'present',
        signed_in_at: now,
        signed_out_at: null,
      })

    if (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setStep('success')
    setLoading(false)
    setTimeout(() => navigate('/kiosk'), 4000)
  }

  if (step === 'success' && selected) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
          <CheckCircle size={44} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white">Signed In!</h2>
          <p className="text-brand-200 mt-1 text-lg">Good {getGreeting()}, {selected.first_name}!</p>
        </div>
        <div className="bg-white/10 rounded-2xl px-6 py-4 text-white">
          <p className="text-sm text-brand-200">Time in</p>
          <p className="text-xl font-bold">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        {selected.year_group && (
          <div className="bg-white/10 rounded-xl px-4 py-2 text-brand-200 text-sm">
            {selected.year_group} {selected.form_group ? `· ${selected.form_group}` : ''}
          </div>
        )}
        <p className="text-brand-300 text-sm">Returning to home screen…</p>
      </div>
    )
  }

  if (step === 'confirm' && selected) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-2xl font-bold text-white">Confirm Sign In</h2>
          <p className="text-brand-200 text-sm">Is this you?</p>
        </div>

        <div className="bg-white rounded-2xl p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xl flex-shrink-0">
            {selected.first_name[0]}{selected.last_name[0]}
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{selected.full_name}</p>
            <p className="text-sm text-gray-500">
              {[selected.year_group, selected.form_group].filter(Boolean).join(' · ') || 'Student'}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-white text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="btn-kiosk bg-green-500 text-white hover:bg-green-600 w-full"
        >
          {loading ? (
            <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <LogIn size={28} />
          )}
          {loading ? 'Signing in…' : 'Yes, Sign Me In'}
        </button>

        <button
          onClick={() => setStep('browse')}
          className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
        >
          That's not me — go back
        </button>
      </div>
    )
  }

  return (
    <PersonBrowser
      siteId={site?.id ?? ''}
      groups={['student']}
      title="Student Sign In"
      subtitle="Find your name to sign in"
      onSelect={person => { setSelected(person); setStep('confirm') }}
      onBack={() => navigate('/kiosk/signin')}
    />
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
