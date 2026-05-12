import { useEffect, useRef, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { supabase } from '@/lib/supabase'
import { searchUsers } from '@/lib/graphClient'
import type { GraphUser } from '@/lib/graphClient'
import { useSite } from '@/hooks/useSite'
import TopBar from '@/components/layout/TopBar'
import {
  Bell, Printer, Users, Globe, Shield,
  Loader2, CheckCircle, RefreshCw, Trash2,
  Plus, X, Plug, Info, Search, Upload, ImageOff,
  Crown, MonitorSmartphone, BookOpen, BellRing, ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { UserRole } from '@/types'

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function saveSiteField(siteId: string, fields: Record<string, unknown>) {
  return supabase.from('sites').update(fields).eq('id', siteId)
}

async function saveSiteSettings(siteId: string, section: string, values: Record<string, unknown>) {
  const { data: current } = await supabase
    .from('sites').select('settings').eq('id', siteId).single()
  const merged = { ...(current?.settings ?? {}), [section]: values }
  return supabase.from('sites').update({ settings: merged }).eq('id', siteId)
}

// ─── Site Details ─────────────────────────────────────────────────────────────

function SiteDetailsForm({ siteId }: { siteId: string }) {
  const { site, loading } = useSite()
  const [name,      setName]      = useState('')
  const [address,   setAddress]   = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [timezone,  setTimezone]  = useState('Europe/London')
  const [logoUrl,   setLogoUrl]   = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!site) return
    setName(site.name ?? '')
    setAddress(site.address ?? '')
    setPhone(site.phone ?? '')
    setEmail(site.email ?? '')
    setTimezone(site.timezone ?? 'Europe/London')
    setLogoUrl(site.logo_url ?? null)
  }, [site])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2 MB')
      return
    }

    setUploading(true)
    try {
      // Always upload to the same path so it replaces itself
      const ext  = file.name.split('.').pop() ?? 'png'
      const path = `${siteId}/logo.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      // Bust the browser cache so the new logo shows immediately
      const cacheBusted = `${publicUrl}?t=${Date.now()}`

      await saveSiteField(siteId, { logo_url: cacheBusted })
      setLogoUrl(cacheBusted)
      toast.success('Logo updated')
    } catch (err: any) {
      toast.error('Upload failed: ' + (err?.message ?? 'Unknown error'))
    }
    setUploading(false)
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function removeLogo() {
    await saveSiteField(siteId, { logo_url: null })
    setLogoUrl(null)
    toast.success('Logo removed')
  }

  async function save() {
    setSaving(true)
    const { error } = await saveSiteField(siteId, {
      name, address, phone: phone || null, email: email || null, timezone,
    })
    if (error) { toast.error('Failed to save') }
    else { toast.success('Saved'); setSaved(true); setTimeout(() => setSaved(false), 3000) }
    setSaving(false)
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">

      {/* ── Logo ── */}
      <div>
        <label className="label mb-2">School / Organisation Logo</label>
        <div className="flex items-center gap-4">
          {/* Preview box */}
          <div className="w-32 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Site logo"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <ImageOff size={24} className="text-gray-300" />
            )}
          </div>

          {/* Controls */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              PNG, JPG, SVG or WebP · Max 2 MB<br />
              Displayed on the visitor kiosk. Transparent backgrounds work best.
            </p>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-secondary py-1.5 text-sm"
              >
                {uploading
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Upload size={13} />}
                {uploading ? 'Uploading…' : logoUrl ? 'Change Logo' : 'Upload Logo'}
              </button>
              {logoUrl && (
                <button onClick={removeLogo} className="btn-secondary py-1.5 text-sm text-red-500 hover:text-red-600">
                  <X size={13} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-gray-100" />

      {/* ── Site details ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Site Name <span className="text-red-400">*</span></label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Gardener Schools" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="123 School Lane, London, SW1A 1AA" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 20 1234 5678" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@school.com" />
        </div>
        <div>
          <label className="label">Timezone</label>
          <select className="input" value={timezone} onChange={e => setTimezone(e.target.value)}>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="Europe/Dublin">Europe/Dublin</option>
            <option value="Europe/Paris">Europe/Paris (CET)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={save} disabled={saving || !name.trim()} className="btn-primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle size={15} /> : null}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ─── Notifications ────────────────────────────────────────────────────────────

function NotificationsForm({ siteId }: { siteId: string }) {
  const [receptionEmail,  setReceptionEmail]  = useState('')
  const [senderEmail,     setSenderEmail]     = useState('')
  const [teamsWebhook,    setTeamsWebhook]    = useState('')
  const [dbsEmail,        setDbsEmail]        = useState('')
  const [notifyOnArrival, setNotifyOnArrival] = useState(true)
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)

  useEffect(() => {
    supabase.from('sites').select('settings').eq('id', siteId).single()
      .then(({ data }) => {
        const n = data?.settings?.notifications ?? {}
        setReceptionEmail(n.visitor_arrival_email ?? '')
        setSenderEmail(n.notification_sender_email ?? '')
        setTeamsWebhook(n.teams_webhook_url ?? '')
        setDbsEmail(n.dbs_expiry_email ?? '')
        setNotifyOnArrival(n.notify_on_arrival ?? true)
        setLoading(false)
      })
  }, [siteId])

  async function save() {
    setSaving(true)
    const { error } = await saveSiteSettings(siteId, 'notifications', {
      visitor_arrival_email:      receptionEmail || null,
      notification_sender_email:  senderEmail    || null,
      teams_webhook_url:          teamsWebhook   || null,
      dbs_expiry_email:           dbsEmail       || null,
      notify_on_arrival:          notifyOnArrival,
    })
    if (error) { toast.error('Failed to save') } else { toast.success('Notification settings saved') }
    setSaving(false)
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">

      {/* How it works banner */}
      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">How visitor notifications work</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            When a visitor signs in at the kiosk, an email is <strong>automatically</strong> sent to whoever
            they say they are visiting. No manual action needed. The settings below let you configure
            an additional CC address and optional Teams alert for every arrival.
          </p>
        </div>
      </div>

      {/* Visitor arrival */}
      <div className="p-4 bg-gray-50 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 text-sm">Visitor Arrival Notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Host is notified automatically. Toggle this to also CC a central inbox.
            </p>
          </div>
          <ToggleSwitch checked={notifyOnArrival} onChange={setNotifyOnArrival} />
        </div>
        {notifyOnArrival && (
          <div className="space-y-3">
            <div>
              <label className="label">
                Send notifications from
                <span className="ml-1 text-gray-400 font-normal text-xs">(optional — shared mailbox address)</span>
              </label>
              <input
                type="email"
                className="input"
                value={senderEmail}
                onChange={e => setSenderEmail(e.target.value)}
                placeholder="ventra@school.com"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Leave blank to send from your Microsoft 365 account. Enter a shared mailbox
                (e.g. <span className="font-mono">ventra@school.com</span>) if you want notifications
                to come from a dedicated address. The mailbox must grant <strong>Send As</strong> permission
                to your IT admin account in Exchange Online.
              </p>
            </div>
            <div>
              <label className="label">
                Reception / Central CC Email
                <span className="ml-1 text-gray-400 font-normal text-xs">(optional, copied on every arrival)</span>
              </label>
              <input
                type="email"
                className="input"
                value={receptionEmail}
                onChange={e => setReceptionEmail(e.target.value)}
                placeholder="reception@school.com"
              />
            </div>
          </div>
        )}
      </div>

      {/* Teams */}
      <div className="p-4 bg-gray-50 rounded-xl space-y-3">
        <div>
          <p className="font-medium text-gray-900 text-sm">Microsoft Teams Channel Alert</p>
          <p className="text-xs text-gray-500 mt-0.5">Post a message to a Teams channel on every visitor arrival</p>
        </div>
        <div>
          <label className="label">Incoming Webhook URL <span className="text-gray-400 font-normal text-xs">(leave blank to disable)</span></label>
          <input
            className="input font-mono text-xs"
            value={teamsWebhook}
            onChange={e => setTeamsWebhook(e.target.value)}
            placeholder="https://outlook.office.com/webhook/…"
          />
        </div>
      </div>

      {/* DBS */}
      <div className="p-4 bg-gray-50 rounded-xl space-y-3">
        <div>
          <p className="font-medium text-gray-900 text-sm">DBS Expiry Alerts</p>
          <p className="text-xs text-gray-500 mt-0.5">Email this address when a DBS certificate is approaching expiry</p>
        </div>
        <div>
          <label className="label">Alert Email <span className="text-gray-400 font-normal text-xs">(leave blank to disable)</span></label>
          <input
            type="email"
            className="input"
            value={dbsEmail}
            onChange={e => setDbsEmail(e.target.value)}
            placeholder="hr@school.com"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Notification Settings'}
        </button>
      </div>
    </div>
  )
}

// ─── Badge Printing ───────────────────────────────────────────────────────────

function BadgePrintingForm({ siteId }: { siteId: string }) {
  const [enabled,     setEnabled]     = useState(false)
  const [printerType, setPrinterType] = useState('browser')
  const [showHost,    setShowHost]    = useState(true)
  const [showPurpose, setShowPurpose] = useState(true)
  const [showQr,      setShowQr]      = useState(false)
  const [showTime,    setShowTime]    = useState(true)
  const [showCompany, setShowCompany] = useState(true)
  const [showPhoto,   setShowPhoto]   = useState(false)
  const [accentColor, setAccentColor] = useState('#1e3a5f')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    supabase.from('sites').select('settings').eq('id', siteId).single()
      .then(({ data }) => {
        const b = data?.settings?.badge ?? {}
        setEnabled(b.enabled ?? false)
        setPrinterType(b.printer_type ?? 'browser')
        setShowHost(b.show_host ?? true)
        setShowPurpose(b.show_purpose ?? true)
        setShowQr(b.show_qr ?? false)
        setShowTime(b.show_time ?? true)
        setShowCompany(b.show_company ?? true)
        setShowPhoto(b.show_photo ?? false)
        setAccentColor(b.accent_color ?? '#1e3a5f')
        setLoading(false)
      })
  }, [siteId])

  async function save() {
    setSaving(true)
    const { error } = await saveSiteSettings(siteId, 'badge', {
      enabled, printer_type: printerType,
      show_host: showHost, show_purpose: showPurpose,
      show_qr: showQr, show_time: showTime,
      show_company: showCompany, show_photo: showPhoto,
      accent_color: accentColor,
    })
    if (error) { toast.error('Failed to save') } else { toast.success('Badge settings saved') }
    setSaving(false)
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
        <div>
          <p className="font-medium text-gray-900 text-sm">Badge Printing</p>
          <p className="text-xs text-gray-500 mt-0.5">Print a visitor badge automatically when they sign in</p>
        </div>
        <ToggleSwitch checked={enabled} onChange={setEnabled} />
      </div>

      <div className={!enabled ? 'opacity-40 pointer-events-none space-y-5' : 'space-y-5'}>

        {/* Two-column: controls + live preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left: controls */}
          <div className="space-y-4">
            {/* Printer type */}
            <div>
              <label className="label">Printer Type</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { value: 'browser', label: 'Browser Print', desc: 'Any printer via browser dialog' },
                  { value: 'dymo',    label: 'Dymo',          desc: 'Dymo LabelWriter series' },
                  { value: 'brother', label: 'Brother',       desc: 'Brother QL label printer' },
                  { value: 'zebra',   label: 'Zebra',         desc: 'Zebra ZPL printers' },
                ].map(p => (
                  <button key={p.value} type="button" onClick={() => setPrinterType(p.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      printerType === p.value
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${printerType === p.value ? 'text-brand-700' : 'text-gray-800'}`}>{p.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent colour */}
            <div>
              <label className="label">Badge Accent Colour</label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="color"
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-1"
                />
                <span className="text-sm font-mono text-gray-600">{accentColor}</span>
                <div className="flex gap-2">
                  {['#1e3a5f', '#16a34a', '#dc2626', '#7c3aed', '#0ea5e9'].map(c => (
                    <button key={c} onClick={() => setAccentColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${accentColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Badge fields */}
            <div>
              <label className="label">Badge Fields</label>
              <div className="mt-1 space-y-1">
                {[
                  { key: 'showPhoto',   label: 'Photo',            val: showPhoto,   set: setShowPhoto },
                  { key: 'showHost',    label: 'Host Name',        val: showHost,    set: setShowHost },
                  { key: 'showPurpose', label: 'Purpose of Visit', val: showPurpose, set: setShowPurpose },
                  { key: 'showCompany', label: 'Company',          val: showCompany, set: setShowCompany },
                  { key: 'showTime',    label: 'Time In',          val: showTime,    set: setShowTime },
                  { key: 'showQr',      label: 'QR Code',          val: showQr,      set: setShowQr },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={f.val} onChange={e => f.set(e.target.checked)}
                      className="rounded w-4 h-4 accent-brand-600" />
                    <span className="text-sm font-medium text-gray-700">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right: live badge preview */}
          <div>
            <label className="label mb-2">Live Preview</label>
            <div className="flex justify-center">
              <BadgePreview
                accentColor={accentColor}
                showHost={showHost}
                showPurpose={showPurpose}
                showCompany={showCompany}
                showTime={showTime}
                showQr={showQr}
                showPhoto={showPhoto}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Badge Settings'}
        </button>
      </div>
    </div>
  )
}

// ─── Badge Preview ─────────────────────────────────────────────────────────────

// Badge preview mirrors the DK-11240 label (102mm × 51mm) at screen scale (2:1 ratio)
function BadgePreview({
  accentColor, showHost, showPurpose, showCompany, showTime, showQr, showPhoto,
}: {
  accentColor: string
  showHost: boolean
  showPurpose: boolean
  showCompany: boolean
  showTime: boolean
  showQr: boolean
  showPhoto: boolean
}) {
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      className="overflow-hidden shadow-lg border border-gray-200 select-none"
      style={{ width: 340, height: 170, borderRadius: 8, display: 'flex' }}
    >
      {/* Left panel */}
      <div style={{
        width: 120, flexShrink: 0, background: accentColor,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7,
      }}>
        {showPhoto ? (
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 20,
          }}>
            JS
          </div>
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 20,
          }}>
            JS
          </div>
        )}
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 7, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>
          Visitor
        </p>
      </div>

      {/* Right panel */}
      <div style={{
        flex: 1, background: '#fff', padding: '11px 10px 9px 12px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#111', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              John Smith
            </p>
            <div style={{ height: 1, background: '#e5e7eb', margin: '4px 0' }} />
            {showCompany && (
              <div style={{ marginBottom: 2 }}>
                <p style={{ fontSize: 6, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Company</p>
                <p style={{ fontSize: 9, fontWeight: 600, color: '#374151' }}>Acme Ltd</p>
              </div>
            )}
            {showHost && (
              <div style={{ marginBottom: 2 }}>
                <p style={{ fontSize: 6, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Visiting</p>
                <p style={{ fontSize: 9, fontWeight: 600, color: '#374151' }}>Mrs Johnson</p>
              </div>
            )}
            {showPurpose && (
              <div>
                <p style={{ fontSize: 6, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Purpose</p>
                <p style={{ fontSize: 9, fontWeight: 600, color: '#374151' }}>Parent Meeting</p>
              </div>
            )}
          </div>

          {/* QR code */}
          {showQr && (
            <div style={{
              width: 50, height: 50, flexShrink: 0, borderRadius: 4,
              background: '#f9fafb', display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 1, padding: 4,
            }}>
              {/* Simple static QR-like pattern */}
              {[1,1,1,1,1,1, 1,0,0,0,0,1, 1,0,1,1,0,1, 1,0,1,0,1,1, 1,0,0,0,0,1, 1,1,1,1,1,1].map((v, i) => (
                <div key={i} style={{ borderRadius: 1, background: v ? accentColor : 'transparent' }} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6', paddingTop: 5 }}>
          <p style={{ fontSize: 8, color: '#6b7280' }}>
            {dateStr}{showTime ? ' · 09:32 AM' : ''}
          </p>
          <p style={{ fontSize: 6, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Ventra VMS</p>
        </div>
      </div>
    </div>
  )
}

// ─── User Roles ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  site_admin:  'Site Admin',
  reception:   'Reception',
  teacher:     'Teacher',
  host:        'Host',
}

const ROLE_DESC: Record<UserRole, string> = {
  super_admin: 'Full access to all sites and settings',
  site_admin:  'Full access to this site',
  reception:   'Visitor management and reception dashboard',
  teacher:     'Class register and attendance',
  host:        'View own visitor notifications only',
}

const ROLE_COLOUR: Record<UserRole, string> = {
  super_admin: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  site_admin:  'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  reception:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  teacher:     'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  host:        'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

const ROLE_ICON: Record<UserRole, React.ReactNode> = {
  super_admin: <Crown size={11} />,
  site_admin:  <ShieldCheck size={11} />,
  reception:   <MonitorSmartphone size={11} />,
  teacher:     <BookOpen size={11} />,
  host:        <BellRing size={11} />,
}

interface UserProfileRow {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  last_login?: string
}

function UserRolesSection({ siteId }: { siteId: string }) {
  const [users,      setUsers]      = useState<UserProfileRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showAddUser,setShowAddUser]= useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, is_active, last_login')
      .eq('site_id', siteId)
      .order('full_name')
    setUsers((data ?? []) as UserProfileRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [siteId])

  async function changeRole(userId: string, role: UserRole) {
    const { error } = await supabase.from('user_profiles').update({ role }).eq('id', userId)
    if (error) { toast.error('Failed to change role'); return }
    toast.success('Role updated')
    load()
  }

  async function toggleActive(user: UserProfileRow) {
    const { error } = await supabase
      .from('user_profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success(user.is_active ? 'User deactivated' : 'User reactivated')
    load()
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''} on this site</p>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary py-1.5 text-sm">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setShowAddUser(true)} className="btn-primary py-1.5 text-sm">
            <Plus size={13} /> Add User
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No users yet</p>
          <p className="text-sm mt-1">Add a user below. They will be matched when they first log in.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className={`flex items-center gap-4 p-4 rounded-xl border ${user.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold flex-shrink-0">
                {user.full_name?.charAt(0) ?? user.email?.charAt(0) ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{user.full_name || '—'}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
                {user.last_login && (
                  <p className="text-xs text-gray-300 mt-0.5">
                    Last login: {new Date(user.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={user.role}
                  onChange={e => changeRole(user.id, e.target.value as UserRole)}
                  className={`text-xs font-semibold px-2 py-1.5 rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-brand-400 cursor-pointer ${ROLE_COLOUR[user.role]}`}
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button
                  onClick={() => toggleActive(user)}
                  title={user.is_active ? 'Deactivate user' : 'Reactivate user'}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    user.is_active ? 'hover:bg-red-50 text-gray-300 hover:text-red-500' : 'bg-green-50 text-green-500 hover:bg-green-100'
                  }`}
                >
                  {user.is_active ? <Trash2 size={14} /> : <CheckCircle size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role legend */}
      <div className="mt-4 p-4 bg-gray-50 rounded-xl">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Role Permissions</p>
        <div className="space-y-2">
          {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
            <div key={r} className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-semibold flex-shrink-0 ${ROLE_COLOUR[r]}`}>
                {ROLE_ICON[r]}
                {ROLE_LABELS[r]}
              </span>
              <span className="text-xs text-gray-500">{ROLE_DESC[r]}</span>
            </div>
          ))}
        </div>
      </div>

      {showAddUser && (
        <AddUserModal
          siteId={siteId}
          onClose={() => setShowAddUser(false)}
          onSaved={() => { setShowAddUser(false); load() }}
        />
      )}
    </div>
  )
}

// ─── Add User Modal ───────────────────────────────────────────────────────────

function AddUserModal({ siteId, onClose, onSaved }: { siteId: string; onClose: () => void; onSaved: () => void }) {
  const { instance: msalInstance } = useMsal()
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<GraphUser[]>([])
  const [selected,  setSelected]  = useState<GraphUser | null>(null)
  const [role,      setRole]      = useState<UserRole>('reception')
  const [searching, setSearching] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced Azure AD search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const users = await searchUsers(msalInstance, query)
        setResults(users)
      } catch (err: any) {
        toast.error('Azure AD search failed: ' + (err?.message ?? 'Unknown error'))
      }
      setSearching(false)
    }, 350)
  }, [query])

  async function save() {
    if (!selected) { toast.error('Select a user first'); return }
    const email = (selected.mail ?? selected.userPrincipalName ?? '').toLowerCase()
    if (!email) { toast.error('User has no email address in Azure AD'); return }
    setSaving(true)

    const { data: existing } = await supabase
      .from('user_profiles').select('id').eq('email', email).maybeSingle()

    if (existing) {
      toast.error('This user already has access to Ventra')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('user_profiles').insert({
      site_id: siteId,
      email,
      full_name: selected.displayName ?? `${selected.givenName ?? ''} ${selected.surname ?? ''}`.trim(),
      role,
      is_active: true,
    })

    if (error) {
      toast.error('Failed to add user: ' + error.message)
      setSaving(false)
      return
    }

    toast.success(`${selected.displayName} added — they can now sign in with Microsoft`)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Add User</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">

          {/* Azure AD search */}
          <div>
            <label className="label">Search Microsoft 365 Directory</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Type a name or email…"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null) }}
                autoFocus
              />
              {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
            </div>
          </div>

          {/* Search results */}
          {results.length > 0 && !selected && (
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {results.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-50 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs flex-shrink-0">
                    {(u.givenName?.[0] ?? u.displayName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{u.displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{u.mail ?? u.userPrincipalName}</p>
                    {u.department && <p className="text-xs text-gray-300">{u.department}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && !searching && results.length === 0 && !selected && (
            <p className="text-center py-3 text-sm text-gray-400">No users found for "{query}"</p>
          )}

          {/* Selected user confirmation */}
          {selected && (
            <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-xl border border-brand-200">
              <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {(selected.givenName?.[0] ?? selected.displayName?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-900">{selected.displayName}</p>
                <p className="text-xs text-brand-600 truncate">{selected.mail ?? selected.userPrincipalName}</p>
              </div>
              <button onClick={() => { setSelected(null); setResults([]) }} className="text-brand-400 hover:text-brand-600 p-1">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Role — only shown once a user is selected */}
          {selected && (
            <div>
              <label className="label">Role</label>
              <div className="grid grid-cols-1 gap-2 mt-1">
                {(Object.keys(ROLE_LABELS) as UserRole[]).filter(r => r !== 'super_admin').map(r => (
                  <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    role === r ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="accent-brand-600" />
                    <div>
                      <p className={`text-sm font-semibold ${role === r ? 'text-brand-700' : 'text-gray-800'}`}>{ROLE_LABELS[r]}</p>
                      <p className="text-xs text-gray-400">{ROLE_DESC[r]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={save} disabled={saving || !selected} className="btn-primary flex-1 disabled:opacity-40">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {saving ? 'Adding…' : 'Add User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Safeguarding Settings ────────────────────────────────────────────────────

function SafeguardingSettingsForm({ siteId }: { siteId: string }) {
  const [warnDays,  setWarnDays]  = useState(30)
  const [watchlist, setWatchlist] = useState(true)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    supabase.from('sites').select('settings').eq('id', siteId).single()
      .then(({ data }) => {
        const s = data?.settings?.safeguarding ?? {}
        setWarnDays(s.dbs_expiry_warning_days ?? 30)
        setWatchlist(s.watchlist_enabled ?? true)
        setLoading(false)
      })
  }, [siteId])

  async function save() {
    setSaving(true)
    const { error } = await saveSiteSettings(siteId, 'safeguarding', {
      dbs_expiry_warning_days: warnDays,
      watchlist_enabled: watchlist,
    })
    if (error) { toast.error('Failed to save') } else { toast.success('Safeguarding settings saved') }
    setSaving(false)
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      <div className="p-4 bg-gray-50 rounded-xl space-y-3">
        <div>
          <p className="font-medium text-gray-900 text-sm">DBS Expiry Warning Threshold</p>
          <p className="text-xs text-gray-500 mt-0.5">Flag DBS certificates this many days before they expire</p>
        </div>
        <div className="flex gap-2">
          {[30, 60, 90].map(d => (
            <button key={d} type="button" onClick={() => setWarnDays(d)}
              className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                warnDays === d
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
        <div>
          <p className="font-medium text-gray-900 text-sm">Visitor Watchlist Matching</p>
          <p className="text-xs text-gray-500 mt-0.5">Alert reception if a visitor name matches a watchlist entry at sign-in</p>
        </div>
        <ToggleSwitch checked={watchlist} onChange={setWatchlist} />
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Safeguarding Settings'}
        </button>
      </div>
    </div>
  )
}

// ─── Integrations ─────────────────────────────────────────────────────────────

function IntegrationsSection() {
  const azureConfigured = !!(
    import.meta.env.VITE_AZURE_CLIENT_ID &&
    import.meta.env.VITE_AZURE_CLIENT_ID !== 'PLACEHOLDER_CLIENT_ID'
  )

  return (
    <div className="space-y-4">

      {/* Azure AD */}
      <div className={`flex items-start gap-4 p-5 rounded-xl border-2 ${
        azureConfigured ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex-shrink-0 mt-0.5">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
            <path d="M11.5 2L2 8.5v7L11.5 22 21 15.5v-7L11.5 2z" fill="#0078D4" />
            <path d="M11.5 2v20M2 8.5l9.5 5.5 9.5-5.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-gray-900 text-sm">Azure AD / Microsoft 365</p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              azureConfigured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${azureConfigured ? 'bg-green-500' : 'bg-gray-400'}`} />
              {azureConfigured ? 'Connected' : 'Not configured'}
            </span>
          </div>
          <p className="text-xs text-gray-500">Single sign-on, staff directory sync, and host notification emails via Microsoft Graph.</p>
          <p className={`text-xs mt-1.5 font-medium ${azureConfigured ? 'text-green-700' : 'text-gray-400'}`}>
            {azureConfigured
              ? 'Microsoft Graph API active — SSO and email notifications enabled.'
              : 'Contact your IT administrator to configure the Azure AD App Registration.'}
          </p>
        </div>
      </div>

      {/* iSAMS */}
      <div className="border-2 border-gray-200 bg-white rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5">
            iS
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-semibold text-gray-900 text-sm">iSAMS</p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                Not configured
              </span>
            </div>
            <p className="text-xs text-gray-500">Sync student and staff records directly from your iSAMS Management Information System.</p>
            <p className="text-xs mt-1.5 font-medium text-gray-400">
              Contact support to enable your iSAMS integration.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-xl flex gap-3 items-start">
        <Plug size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">
          Need a different integration? More connectors (SIMS, Bromcom, ParentPay) are on the roadmap.
          Contact support to request a priority integration.
        </p>
      </div>
    </div>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-11 h-6 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-brand-600' : 'bg-gray-200'
      }`}
    >
      <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

function Spinner() {
  return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-600" /></div>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SectionId = 'site' | 'notifications' | 'badge' | 'roles' | 'safeguarding' | 'integrations'

export default function SettingsPage() {
  const { site } = useSite()
  const [active, setActive] = useState<SectionId>('site')

  const SECTIONS: { id: SectionId; icon: React.ReactNode; label: string; desc: string }[] = [
    { id: 'site',         icon: <Globe size={20} />,   label: 'Site Details',   desc: 'Name, address, timezone' },
    { id: 'notifications',icon: <Bell size={20} />,    label: 'Notifications',  desc: 'Email, Teams, alerts' },
    { id: 'badge',        icon: <Printer size={20} />, label: 'Badge Printing', desc: 'Printer type, template' },
    { id: 'roles',        icon: <Users size={20} />,   label: 'User Roles',     desc: 'Manage access levels' },
    { id: 'safeguarding', icon: <Shield size={20} />,  label: 'Safeguarding',   desc: 'DBS alerts, watchlist' },
    { id: 'integrations', icon: <Plug size={20} />,    label: 'Integrations',   desc: 'Azure AD, iSAMS & more' },
  ]

  const TITLES: Record<SectionId, { title: string; desc: string }> = {
    site:         { title: 'Site Details',         desc: 'Basic information about your school or site' },
    notifications:{ title: 'Notifications',         desc: 'Configure email and Teams alerts' },
    badge:        { title: 'Badge Printing',        desc: 'Customise your visitor badge layout and fields' },
    roles:        { title: 'User Roles',            desc: 'Manage who can access Ventra and at what level' },
    safeguarding: { title: 'Safeguarding Settings', desc: 'DBS expiry thresholds and watchlist configuration' },
    integrations: { title: 'Integrations',          desc: 'Connect Ventra to your other platforms' },
  }

  return (
    <div>
      <TopBar title="Settings" subtitle="Platform configuration" />
      <div className="p-6 flex gap-6">

        {/* Sidebar nav */}
        <div className="w-56 flex-shrink-0 space-y-1">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors flex items-center gap-3 ${
                active === s.id
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
              <span className={active === s.id ? 'text-brand-600' : 'text-gray-400'}>{s.icon}</span>
              <div className="min-w-0">
                <p>{s.label}</p>
                <p className="text-xs text-gray-400 font-normal truncate">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0 card p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">{TITLES[active].title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{TITLES[active].desc}</p>
          </div>

          {site && active === 'site'          && <SiteDetailsForm          siteId={site.id} />}
          {site && active === 'notifications' && <NotificationsForm        siteId={site.id} />}
          {site && active === 'badge'         && <BadgePrintingForm        siteId={site.id} />}
          {site && active === 'roles'         && <UserRolesSection         siteId={site.id} />}
          {site && active === 'safeguarding'  && <SafeguardingSettingsForm siteId={site.id} />}
          {        active === 'integrations'  && <IntegrationsSection />}
          {!site  && active !== 'integrations'&& <Spinner />}
        </div>
      </div>
    </div>
  )
}
