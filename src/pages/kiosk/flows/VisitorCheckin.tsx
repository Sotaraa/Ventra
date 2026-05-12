import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { supabaseKiosk as supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import { sendEmail } from '@/lib/graphClient'
import {
  ChevronLeft, ChevronRight, CheckCircle,
  User, Briefcase, Search, ShieldCheck,
  Camera, RefreshCw, SkipForward, Printer,
} from 'lucide-react'
import type { VisitorType, Person, Site } from '@/types'

type Step = 'name' | 'photo' | 'purpose' | 'host' | 'rules' | 'success' | 'print'

interface FormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
  visitor_type: VisitorType | ''
  purpose: string
  host: Person | null
  photo_url: string | null
}

const VISITOR_TYPES: { key: VisitorType; label: string; subtitle: string; emoji: string }[] = [
  { key: 'parent',     label: 'Parent / Carer',      subtitle: 'Collecting or dropping off',   emoji: '👨‍👩‍👧' },
  { key: 'contractor', label: 'Contractor',           subtitle: 'Works, repairs or deliveries',  emoji: '🔧' },
  { key: 'official',   label: 'Official / Inspector', subtitle: 'Ofsted, LA or official visit',  emoji: '📋' },
  { key: 'supplier',   label: 'Supplier',             subtitle: 'Sales or product delivery',     emoji: '📦' },
  { key: 'other',      label: 'Other',                subtitle: 'Any other visitor',             emoji: '👤' },
]

const SITE_RULES = [
  'Please wear your visitor badge visibly at all times.',
  'Do not access areas beyond reception without a staff escort.',
  'Photography and recording on school premises is not permitted.',
  'Please report any safeguarding concerns immediately to reception.',
  'Mobile phones must be on silent in all teaching areas.',
  'In an emergency, please follow staff instructions and proceed to the designated muster point.',
]

// Fire-and-forget host notification — never blocks the sign-in flow
async function notifyHost(
  msalInstance: ReturnType<typeof useMsal>['instance'],
  form: FormData,
  site: Site,
  visitLogId: string,
  senderEmail?: string | null,
) {
  if (!form.host?.email) return
  const visitorName = `${form.first_name.trim()} ${form.last_name.trim()}`
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const subject = `Visitor arrived: ${visitorName}`
  const body = `
    <p>Hello ${form.host.first_name},</p>
    <p><strong>${visitorName}</strong> has just arrived at <strong>${site.name}</strong> and is waiting for you in reception.</p>
    ${form.company ? `<p><strong>Company:</strong> ${form.company}</p>` : ''}
    ${form.purpose ? `<p><strong>Purpose:</strong> ${form.purpose}</p>` : ''}
    <p><strong>Time:</strong> ${time}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
    <p style="color:#888;font-size:12px">Sent automatically by Ventra VMS</p>
  `
  try {
    await sendEmail(msalInstance, form.host.email, subject, body, senderEmail)
    await supabase.from('notification_logs').insert({
      site_id: site.id, visit_log_id: visitLogId,
      recipient_email: form.host.email, recipient_name: form.host.full_name,
      channel: 'email', subject, sent_at: new Date().toISOString(), delivered: true,
    })
  } catch (err) {
    console.warn('Host notification failed:', err)
    await supabase.from('notification_logs').insert({
      site_id: site.id, visit_log_id: visitLogId,
      recipient_email: form.host.email, recipient_name: form.host.full_name,
      channel: 'email', subject, sent_at: new Date().toISOString(),
      delivered: false, error: String(err),
    }).then(() => {}) // truly silent
  }
}

export default function VisitorCheckin() {
  const navigate = useNavigate()
  const { instance: msalInstance } = useMsal()
  const { site } = useSite()
  const [step, setStep] = useState<Step>('name')
  const [form, setForm] = useState<FormData>({
    first_name: '', last_name: '', email: '', phone: '',
    company: '', visitor_type: '', purpose: '', host: null, photo_url: null,
  })
  const [hostSearch,    setHostSearch]    = useState('')
  const [hostResults,   setHostResults]   = useState<Person[]>([])
  const [hostLoading,   setHostLoading]   = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState('')
  const [visitLogId,    setVisitLogId]    = useState('')
  const [senderEmail,   setSenderEmail]   = useState<string | null>(null)
  const hostSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load notification sender email from site settings
  useEffect(() => {
    if (!site?.id) return
    supabase.from('sites').select('settings').eq('id', site.id).single()
      .then(({ data }) => {
        setSenderEmail(data?.settings?.notifications?.notification_sender_email ?? null)
      })
  }, [site?.id])

  // Debounced host search
  useEffect(() => {
    if (hostSearch.length < 2) { setHostResults([]); return }
    if (hostSearchTimeout.current) clearTimeout(hostSearchTimeout.current)
    hostSearchTimeout.current = setTimeout(async () => {
      setHostLoading(true)
      const { data } = await supabase
        .from('persons')
        .select('id, first_name, last_name, full_name, department, email')
        .eq('site_id', site?.id ?? '')
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

  async function handleSubmit() {
    if (!site || !form.visitor_type) return
    setSubmitting(true)
    setError('')

    // 1. Insert visitor — do NOT include full_name (it's a generated column)
    const { data: visitorData, error: vErr } = await supabase
      .from('visitors')
      .insert({
        site_id: site.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        visitor_type: form.visitor_type,
        photo_url: form.photo_url || null,
        nda_signed: true,
        nda_signed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (vErr || !visitorData) {
      setError('Could not register visitor. Please try again.')
      setSubmitting(false)
      return
    }

    // 2. Create visit log
    const { data: logData, error: lErr } = await supabase
      .from('visit_logs')
      .insert({
        site_id: site.id,
        visitor_id: visitorData.id,
        host_person_id: form.host?.id ?? null,
        host_name: form.host?.full_name ?? null,
        host_email: form.host?.email ?? null,
        purpose: form.purpose.trim() || null,
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        badge_printed: false,
      })
      .select('id')
      .single()

    if (lErr) {
      setError('Could not create visit record. Please try again.')
      setSubmitting(false)
      return
    }

    // Notify host — fire and forget
    if (form.host && site && logData) {
      notifyHost(msalInstance, form, site, logData.id, senderEmail)
    }

    setVisitLogId(logData?.id ?? '')
    setStep('print')
    setSubmitting(false)
  }

  // ─── Print Badge step ───────────────────────────────────────────────────────
  if (step === 'print') {
    return (
      <PrintBadgeStep
        form={form}
        visitLogId={visitLogId}
        siteName={site?.name ?? 'Ventra'}
        onDone={() => setStep('success')}
      />
    )
  }

  // ─── Success ────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return <SuccessScreen form={form} onDone={() => navigate('/kiosk')} />
  }

  // ─── Photo Capture ──────────────────────────────────────────────────────────
  if (step === 'photo') {
    return (
      <PhotoStep
        siteId={site?.id ?? ''}
        firstName={form.first_name}
        onPhotoTaken={url => { setForm(f => ({ ...f, photo_url: url })); setStep('purpose') }}
        onSkip={() => setStep('purpose')}
        onBack={() => setStep('name')}
      />
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
            <h2 className="text-2xl font-bold text-white">Site Rules</h2>
            <p className="text-brand-200 text-sm">Please read and accept before entering</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 space-y-3 max-h-[340px] overflow-y-auto">
          {SITE_RULES.map((rule, i) => (
            <div key={i} className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-brand-600 mt-0.5 flex-shrink-0" />
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
          className="btn-kiosk bg-green-500 text-white hover:bg-green-600 w-full"
        >
          {submitting
            ? <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <CheckCircle size={28} />
          }
          {submitting ? 'Signing in…' : 'I Accept — Sign Me In'}
        </button>
      </div>
    )
  }

  // ─── Host Search ─────────────────────────────────────────────────────────────
  if (step === 'host') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('purpose')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Who are you seeing?</h2>
            <p className="text-brand-200 text-sm">Search for the member of staff you're visiting</p>
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
          <div className="bg-white rounded-2xl px-5 py-3 flex items-center gap-3 border-2 border-green-400">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm flex-shrink-0">
              {form.host.first_name[0]}{form.host.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{form.host.full_name}</p>
              <p className="text-xs text-gray-400">{form.host.department ?? 'Staff'}</p>
            </div>
            <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
          </div>
        )}

        {!form.host && hostSearch.length >= 2 && (
          <div className="bg-white rounded-2xl overflow-hidden max-h-[260px] overflow-y-auto">
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
                      className="w-full text-left px-5 py-3.5 hover:bg-brand-50 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs flex-shrink-0">
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
          className="btn-kiosk bg-brand-600 text-white hover:bg-brand-700 w-full mt-1"
        >
          {form.host ? 'Continue' : 'Skip — Continue Without Host'}
          <ChevronRight size={24} />
        </button>
      </div>
    )
  }

  // ─── Purpose ────────────────────────────────────────────────────────────────
  if (step === 'purpose') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('photo')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Purpose of visit</h2>
            <p className="text-brand-200 text-sm">What brings you in today?</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {VISITOR_TYPES.map(vt => {
            const selected = form.visitor_type === vt.key
            return (
              <button
                key={vt.key}
                onClick={() => setForm(f => ({ ...f, visitor_type: vt.key }))}
                className={`rounded-2xl px-5 py-4 text-left flex items-center gap-4 transition-all border-2 ${
                  selected
                    ? 'bg-amber-400 border-amber-400 shadow-lg scale-[1.01]'
                    : 'bg-white border-transparent hover:shadow-sm'
                }`}
              >
                <span className="text-2xl w-8 text-center flex-shrink-0">{vt.emoji}</span>
                <div className="flex-1">
                  <p className={`font-bold ${selected ? 'text-white' : 'text-gray-900'}`}>{vt.label}</p>
                  <p className={`text-xs ${selected ? 'text-amber-100' : 'text-gray-400'}`}>{vt.subtitle}</p>
                </div>
                {selected && <CheckCircle size={22} className="text-white flex-shrink-0" />}
              </button>
            )
          })}
        </div>

        <input
          className="w-full px-4 py-3 rounded-2xl text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-400"
          placeholder="Additional details (optional)"
          value={form.purpose}
          onChange={e => update('purpose', e.target.value)}
        />

        <button
          onClick={() => setStep('host')}
          disabled={!form.visitor_type}
          className="btn-kiosk bg-brand-600 text-white hover:bg-brand-700 w-full disabled:opacity-40"
        >
          Continue <ChevronRight size={24} />
        </button>
      </div>
    )
  }

  // ─── Name / Contact ─────────────────────────────────────────────────────────
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
          <h2 className="text-2xl font-bold text-white">Visitor Sign In</h2>
          <p className="text-brand-200 text-sm">Please enter your details</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">First name <span className="text-red-400">*</span></label>
            <input
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="John"
              value={form.first_name}
              onChange={e => update('first_name', e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Last name <span className="text-red-400">*</span></label>
            <input
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Smith"
              value={form.last_name}
              onChange={e => update('last_name', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            <Briefcase size={12} className="inline mr-1" />
            Company / Organisation <span className="text-gray-300">(optional)</span>
          </label>
          <input
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="ABC Ltd"
            value={form.company}
            onChange={e => update('company', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            <User size={12} className="inline mr-1" />
            Email <span className="text-gray-300">(optional)</span>
          </label>
          <input
            type="email"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="john@example.com"
            value={form.email}
            onChange={e => update('email', e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={() => setStep('photo')}
        disabled={!form.first_name.trim() || !form.last_name.trim()}
        className="btn-kiosk bg-brand-600 text-white hover:bg-brand-700 w-full disabled:opacity-40"
      >
        Continue <ChevronRight size={24} />
      </button>
    </div>
  )
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ form, onDone }: { form: FormData; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 5000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
      {form.photo_url ? (
        <img src={form.photo_url} alt="Visitor" className="w-24 h-24 rounded-full object-cover border-4 border-white/30" />
      ) : (
        <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
          <CheckCircle size={44} className="text-white" />
        </div>
      )}
      <div>
        <h2 className="text-3xl font-bold text-white">Welcome!</h2>
        <p className="text-brand-200 mt-1 text-lg">{form.first_name}, you're signed in</p>
      </div>
      {form.host && (
        <div className="bg-white/10 rounded-2xl px-6 py-4 text-white space-y-1">
          <p className="text-sm text-brand-200">Your host has been notified</p>
          <p className="font-bold">{form.host.full_name}</p>
          <p className="text-sm text-brand-300">Please take a seat in reception</p>
        </div>
      )}
      <p className="text-brand-300 text-sm">Returning to home screen…</p>
    </div>
  )
}

// ─── Print Badge Step ─────────────────────────────────────────────────────────
// DK-11240: 102mm × 51mm pre-cut label, landscape

async function toBase64(url: string): Promise<string> {
  const res  = await fetch(url)
  const blob = await res.blob()
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

function PrintBadgeStep({
  form,
  visitLogId,
  siteName,
  onDone,
}: {
  form: FormData
  visitLogId: string
  siteName: string
  onDone: () => void
}) {
  const [printing,    setPrinting]    = useState(false)
  const [printed,     setPrinted]     = useState(false)
  const [photoB64,    setPhotoB64]    = useState<string | null>(null)
  const [qrB64,       setQrB64]       = useState<string | null>(null)

  const timeIn = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  // Pre-load images as base64 so they render reliably inside the print iframe
  useEffect(() => {
    const qrData = encodeURIComponent(`VENTRA:${visitLogId}`)
    const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${qrData}&color=064e3b&margin=4`
    toBase64(qrUrl).then(setQrB64).catch(() => {})
    if (form.photo_url) toBase64(form.photo_url).then(setPhotoB64).catch(() => {})
  }, [])

  function buildBadgeHTML(): string {
    const initials = `${form.first_name[0] ?? ''}${form.last_name[0] ?? ''}`
    const photoTag = photoB64
      ? `<img src="${photoB64}" class="photo-img" />`
      : `<div class="photo-init">${initials}</div>`
    const qrTag = qrB64
      ? `<img src="${qrB64}" class="qr" />`
      : `<div class="qr-placeholder"></div>`

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Visitor Badge</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  @page {
    size: 102mm 51mm;
    margin: 0;
  }

  body {
    width: 102mm;
    height: 51mm;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    overflow: hidden;
    background: #fff;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .badge {
    display: flex;
    width: 102mm;
    height: 51mm;
    overflow: hidden;
  }

  /* ── Left panel: photo ── */
  .left {
    width: 36mm;
    height: 51mm;
    background: #022c22;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3mm;
    flex-shrink: 0;
  }

  .photo-img {
    width: 26mm;
    height: 26mm;
    border-radius: 50%;
    object-fit: cover;
    border: 0.8mm solid rgba(255,255,255,0.35);
  }

  .photo-init {
    width: 26mm;
    height: 26mm;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    border: 0.8mm solid rgba(255,255,255,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 12pt;
    font-weight: 800;
    letter-spacing: 0.5mm;
  }

  .visitor-label {
    color: rgba(255,255,255,0.9);
    font-size: 5.5pt;
    font-weight: 700;
    letter-spacing: 1.5mm;
    text-transform: uppercase;
  }

  /* ── Right panel: details ── */
  .right {
    flex: 1;
    padding: 4mm 3.5mm 3mm 4mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: #fff;
    overflow: hidden;
  }

  .top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 2mm;
  }

  .details { flex: 1; overflow: hidden; }

  .name {
    font-size: 11.5pt;
    font-weight: 800;
    color: #111;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .divider {
    height: 0.3mm;
    background: #e5e7eb;
    margin: 1.5mm 0;
  }

  .row { margin-bottom: 1mm; }
  .row-label {
    font-size: 5pt;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.4mm;
    line-height: 1;
  }
  .row-value {
    font-size: 7.5pt;
    font-weight: 600;
    color: #374151;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .qr {
    width: 20mm;
    height: 20mm;
    flex-shrink: 0;
    display: block;
  }
  .qr-placeholder {
    width: 20mm;
    height: 20mm;
    background: #f3f4f6;
    flex-shrink: 0;
  }

  .bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 0.3mm solid #f3f4f6;
    padding-top: 1.5mm;
  }

  .datetime {
    font-size: 6.5pt;
    color: #6b7280;
  }

  .site-name {
    font-size: 5pt;
    color: #9ca3af;
    text-align: right;
    text-transform: uppercase;
    letter-spacing: 0.3mm;
    max-width: 40mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
</head>
<body>
  <div class="badge">
    <div class="left">
      ${photoTag}
      <div class="visitor-label">Visitor</div>
    </div>
    <div class="right">
      <div class="top">
        <div class="details">
          <div class="name">${form.first_name} ${form.last_name}</div>
          <div class="divider"></div>
          ${form.company  ? `<div class="row"><div class="row-label">Company</div><div class="row-value">${form.company}</div></div>` : ''}
          ${form.host     ? `<div class="row"><div class="row-label">Visiting</div><div class="row-value">${form.host.full_name}</div></div>` : ''}
          ${form.purpose  ? `<div class="row"><div class="row-label">Purpose</div><div class="row-value">${form.purpose}</div></div>` : ''}
        </div>
        ${qrTag}
      </div>
      <div class="bottom">
        <div class="datetime">${dateStr} &nbsp;·&nbsp; ${timeIn}</div>
        <div class="site-name">${siteName}</div>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  async function printBadge() {
    setPrinting(true)

    // Use a hidden iframe — more reliable than window.open() on iOS AirPrint
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:none;opacity:0;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument!
    doc.open()
    doc.write(buildBadgeHTML())
    doc.close()

    // Give images time to load, then print
    await new Promise(r => setTimeout(r, 800))
    iframe.contentWindow!.print()
    await new Promise(r => setTimeout(r, 500))
    document.body.removeChild(iframe)

    // Mark as printed in DB
    await supabase.from('visit_logs')
      .update({ badge_printed: true, badge_printed_at: new Date().toISOString() })
      .eq('id', visitLogId)

    setPrinted(true)
    setPrinting(false)
    setTimeout(onDone, 2000)
  }

  // ── Screen preview (scaled to fit kiosk display) ────────────────────────────
  // Scale: 102mm → ~340px at 96dpi — we show at a fixed width of 340px
  const initials = `${form.first_name[0] ?? ''}${form.last_name[0] ?? ''}`

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div>
        <h2 className="text-3xl font-bold text-white">You're signed in!</h2>
        <p className="text-brand-200 mt-1">Welcome, {form.first_name} — please collect your badge</p>
      </div>

      {form.host && (
        <div className="bg-white/10 rounded-2xl px-6 py-3 text-white text-sm space-y-0.5">
          <p className="text-brand-200 text-xs">Host notified</p>
          <p className="font-bold">{form.host.full_name}</p>
        </div>
      )}

      {/* Badge preview — mirrors exact label proportions (102:51 = 2:1) */}
      <div
        className="overflow-hidden shadow-2xl border border-white/20"
        style={{ width: 340, height: 170, borderRadius: 10, display: 'flex' }}
      >
        {/* Left: photo panel */}
        <div style={{ width: 120, background: '#022c22', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0 }}>
          {photoB64 || form.photo_url ? (
            <img
              src={photoB64 ?? form.photo_url!}
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }}
            />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 24 }}>
              {initials}
            </div>
          )}
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase' }}>Visitor</p>
        </div>

        {/* Right: details panel */}
        <div style={{ flex: 1, background: '#fff', padding: '12px 11px 10px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#111', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {form.first_name} {form.last_name}
              </p>
              <div style={{ height: 1, background: '#e5e7eb', margin: '5px 0' }} />
              {form.company && (
                <div style={{ marginBottom: 3 }}>
                  <p style={{ fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Company</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.company}</p>
                </div>
              )}
              {form.host && (
                <div style={{ marginBottom: 3 }}>
                  <p style={{ fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Visiting</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.host.full_name}</p>
                </div>
              )}
              {form.purpose && (
                <div>
                  <p style={{ fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Purpose</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.purpose}</p>
                </div>
              )}
            </div>
            {/* QR code preview */}
            {qrB64 ? (
              <img src={qrB64} style={{ width: 56, height: 56, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 56, height: 56, background: '#f3f4f6', borderRadius: 4, flexShrink: 0 }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6', paddingTop: 5 }}>
            <p style={{ fontSize: 9, color: '#6b7280' }}>{dateStr} · {timeIn}</p>
            <p style={{ fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{siteName}</p>
          </div>
        </div>
      </div>

      <p className="text-white/40 text-xs">Preview · Actual label: 102mm × 51mm (DK-11240)</p>

      {/* Actions */}
      <div className="flex gap-3 w-full">
        <button
          onClick={onDone}
          className="flex-1 py-3 rounded-2xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
        >
          Skip Printing
        </button>
        <button
          onClick={printBadge}
          disabled={printing || printed}
          className="flex-1 btn-kiosk bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {printed
            ? <><CheckCircle size={20} /> Printed!</>
            : printing
            ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Printing…</>
            : <><Printer size={20} /> Print Badge</>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Photo Capture Step ────────────────────────────────────────────────────────

function PhotoStep({
  siteId,
  firstName,
  onPhotoTaken,
  onSkip,
  onBack,
}: {
  siteId: string
  firstName: string
  onPhotoTaken: (url: string) => void
  onSkip: () => void
  onBack: () => void
}) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)

  const [cameraReady,   setCameraReady]   = useState(false)
  const [cameraError,   setCameraError]   = useState('')
  const [captured,      setCaptured]      = useState<string | null>(null)  // data URL preview
  const [uploading,     setUploading]     = useState(false)

  const startCamera = useCallback(async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setCameraReady(true)
        }
      }
    } catch {
      setCameraError('Camera not available — you can skip this step.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  function capturePhoto() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Mirror the image (selfie mode)
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCaptured(dataUrl)
    stopCamera()
  }

  function retake() {
    setCaptured(null)
    startCamera()
  }

  async function usePhoto() {
    if (!captured || !siteId) return
    setUploading(true)

    // Convert data URL to blob
    const res  = await fetch(captured)
    const blob = await res.blob()
    const path = `${siteId}/${Date.now()}.jpg`

    const { error } = await supabase.storage
      .from('visitor-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

    if (error) {
      // On storage error, skip photo rather than blocking sign-in
      onSkip()
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('visitor-photos')
      .getPublicUrl(path)

    setUploading(false)
    onPhotoTaken(publicUrl)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { stopCamera(); onBack() }}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">Take a photo</h2>
          <p className="text-brand-200 text-sm">Hi {firstName}! Look at the camera and smile</p>
        </div>
      </div>

      {/* Camera / preview */}
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center">
        {cameraError ? (
          <div className="text-center p-8">
            <Camera size={40} className="mx-auto text-white/30 mb-3" />
            <p className="text-white/60 text-sm">{cameraError}</p>
          </div>
        ) : captured ? (
          <img src={captured} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
            muted
            playsInline
          />
        )}

        {/* Overlay guides */}
        {!captured && cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-48 rounded-full border-2 border-white/30 border-dashed" />
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Buttons */}
      {captured ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={retake}
            className="btn-kiosk bg-white/10 text-white hover:bg-white/20"
          >
            <RefreshCw size={20} /> Retake
          </button>
          <button
            onClick={usePhoto}
            disabled={uploading}
            className="btn-kiosk bg-green-500 text-white hover:bg-green-600"
          >
            {uploading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CheckCircle size={22} />
            }
            {uploading ? 'Saving…' : 'Use Photo'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { stopCamera(); onSkip() }}
            className="btn-kiosk bg-white/10 text-white hover:bg-white/20"
          >
            <SkipForward size={20} /> Skip
          </button>
          <button
            onClick={capturePhoto}
            disabled={!cameraReady || !!cameraError}
            className="btn-kiosk bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
          >
            <Camera size={22} /> Take Photo
          </button>
        </div>
      )}
    </div>
  )
}
