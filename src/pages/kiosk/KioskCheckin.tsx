import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseKiosk as supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'

type Step = 'name' | 'type' | 'host' | 'nda' | 'complete'

interface CheckinForm {
  first_name: string
  last_name: string
  email: string
  company: string
  visitor_type: string
  host_name: string
  purpose: string
  nda_signed: boolean
}

const VISITOR_TYPES = [
  { value: 'parent', label: 'Parent / Guardian' },
  { value: 'contractor', label: 'Contractor / Tradesperson' },
  { value: 'official', label: 'Official / Inspector' },
  { value: 'supplier', label: 'Supplier / Delivery' },
  { value: 'other', label: 'Other' },
]

export default function KioskCheckin() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('name')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CheckinForm>({
    first_name: '',
    last_name: '',
    email: '',
    company: '',
    visitor_type: '',
    host_name: '',
    purpose: '',
    nda_signed: false,
  })

  function update(field: keyof CheckinForm, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit() {
    setSaving(true)
    try {
      // Upsert visitor record
      const { data: visitor, error: vErr } = await supabase
        .from('visitors')
        .insert({
          first_name: form.first_name,
          last_name: form.last_name,
          full_name: `${form.first_name} ${form.last_name}`,
          email: form.email || null,
          company: form.company || null,
          visitor_type: form.visitor_type,
          nda_signed: form.nda_signed,
          nda_signed_at: form.nda_signed ? new Date().toISOString() : null,
        })
        .select()
        .single()

      if (vErr) throw vErr

      // Create visit log
      const { error: lErr } = await supabase
        .from('visit_logs')
        .insert({
          visitor_id: visitor.id,
          host_name: form.host_name || null,
          purpose: form.purpose || null,
          status: 'checked_in',
          checked_in_at: new Date().toISOString(),
          badge_printed: false,
        })

      if (lErr) throw lErr

      setStep('complete')
    } catch {
      toast.error('Something went wrong. Please ask reception for help.')
    } finally {
      setSaving(false)
    }
  }

  if (step === 'complete') {
    return (
      <div className="flex flex-col items-center gap-6 pt-12 text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl">
          <Check size={48} className="text-green-500" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white">
            Welcome, {form.first_name}!
          </h2>
          <p className="text-brand-200 text-lg mt-2">
            You're checked in. Please take a seat — your host has been notified.
          </p>
        </div>
        <button
          onClick={() => navigate('/kiosk')}
          className="btn-kiosk bg-white text-brand-600 mt-4 px-12"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
      {/* Step indicator */}
      <div className="flex bg-gray-50 border-b border-gray-100">
        {(['name', 'type', 'host', 'nda'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`flex-1 py-3 text-center text-xs font-semibold transition-colors ${
              s === step ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-400'
            }`}
          >
            {i + 1}. {s === 'name' ? 'Your Details' : s === 'type' ? 'Visit Type' : s === 'host' ? 'Who to See' : 'Site Rules'}
          </div>
        ))}
      </div>

      <div className="p-8">
        {step === 'name' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Your details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First name *</label>
                <input className="input text-lg" value={form.first_name} onChange={e => update('first_name', e.target.value)} placeholder="Jane" />
              </div>
              <div>
                <label className="label">Last name *</label>
                <input className="input text-lg" value={form.last_name} onChange={e => update('last_name', e.target.value)} placeholder="Smith" />
              </div>
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input className="input text-lg" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="jane@example.com" />
            </div>
            <div>
              <label className="label">Company / Organisation (optional)</label>
              <input className="input text-lg" value={form.company} onChange={e => update('company', e.target.value)} placeholder="Acme Ltd" />
            </div>
          </div>
        )}

        {step === 'type' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">What brings you in?</h2>
            <div className="grid grid-cols-1 gap-3">
              {VISITOR_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => update('visitor_type', t.value)}
                  className={`w-full py-4 px-5 rounded-xl border-2 text-left font-semibold text-lg transition-all active:scale-98 ${
                    form.visitor_type === t.value
                      ? 'border-brand-600 bg-brand-50 text-brand-600'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'host' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Who are you visiting?</h2>
            <div>
              <label className="label">Name of person you're here to see</label>
              <input className="input text-lg" value={form.host_name} onChange={e => update('host_name', e.target.value)} placeholder="Mr Johnson" />
            </div>
            <div>
              <label className="label">Purpose of visit (optional)</label>
              <input className="input text-lg" value={form.purpose} onChange={e => update('purpose', e.target.value)} placeholder="Parent meeting, Inspection, etc." />
            </div>
          </div>
        )}

        {step === 'nda' && (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">Site rules & agreement</h2>
            <div className="bg-gray-50 rounded-xl p-5 max-h-48 overflow-y-auto text-sm text-gray-600 leading-relaxed">
              <p className="font-semibold text-gray-900 mb-2">Visitor Agreement</p>
              <p>By signing in, you agree to:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Follow all site safety and safeguarding policies</li>
                <li>Wear your visitor badge at all times while on site</li>
                <li>Report to reception before moving around the building</li>
                <li>Not photograph students or staff without permission</li>
                <li>Sign out before leaving the premises</li>
              </ul>
              <p className="mt-3 text-xs text-gray-400">Your data is processed in line with our privacy policy and GDPR.</p>
            </div>
            <button
              onClick={() => update('nda_signed', !form.nda_signed)}
              className={`w-full py-4 px-5 rounded-xl border-2 font-semibold text-lg transition-all flex items-center gap-3 ${
                form.nda_signed
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.nda_signed ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                {form.nda_signed && <Check size={16} className="text-white" />}
              </div>
              I agree to the site rules and visitor agreement
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => {
              const steps: Step[] = ['name', 'type', 'host', 'nda']
              const idx = steps.indexOf(step)
              if (idx === 0) navigate('/kiosk')
              else setStep(steps[idx - 1])
            }}
            className="btn-secondary"
          >
            <ChevronLeft size={18} /> Back
          </button>

          <button
            onClick={() => {
              const steps: Step[] = ['name', 'type', 'host', 'nda']
              const idx = steps.indexOf(step)
              if (idx === steps.length - 1) submit()
              else setStep(steps[idx + 1])
            }}
            disabled={
              saving ||
              (step === 'name' && (!form.first_name || !form.last_name)) ||
              (step === 'type' && !form.visitor_type) ||
              (step === 'nda' && !form.nda_signed)
            }
            className="btn-primary"
          >
            {saving ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : step === 'nda' ? (
              <>Complete Check-In <Check size={18} /></>
            ) : (
              <>Next <ChevronRight size={18} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
