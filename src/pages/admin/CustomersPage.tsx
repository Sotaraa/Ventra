import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/layout/TopBar'
import {
  Plus, Building2, Copy, Check, X, ChevronRight,
  Users, ExternalLink, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string
  name: string
  slug: string
  subscription_tier: string
  is_active: boolean
  created_at: string
  sites: { id: string; name: string; slug: string }[]
}

// ─── Slug helper ─────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

const APP_URL = window.location.origin
const CONSENT_URL = `https://login.microsoftonline.com/common/adminconsent?client_id=${import.meta.env.VITE_AZURE_CLIENT_ID}`

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('tenants')
      .select('*, sites(id, name, slug)')
      .order('created_at', { ascending: false })
    setTenants((data as Tenant[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <TopBar
        title="Customers"
        subtitle="Manage tenants and onboard new schools"
        actions={
          <button onClick={() => setShowModal(true)} className="btn-primary py-2 text-sm">
            <Plus size={15} /> Onboard New Customer
          </button>
        }
      />

      <div className="p-6 space-y-4">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Customers', value: tenants.length },
            { label: 'Total Sites',     value: tenants.reduce((s, t) => s + t.sites.length, 0) },
            { label: 'Active',          value: tenants.filter(t => t.is_active).length },
          ].map(s => (
            <div key={s.label} className="card px-5 py-4">
              <p className="text-xs text-gray-400 font-medium">{s.label}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tenant list */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading customers…</span>
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-gray-400">
              <Building2 size={36} className="opacity-25" />
              <div className="text-center">
                <p className="font-medium text-gray-500">No customers yet</p>
                <p className="text-xs mt-1">Click "Onboard New Customer" to get started</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
              {tenants.map(tenant => (
                <li key={tenant.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm flex-shrink-0 mt-0.5">
                        {tenant.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white">{tenant.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            tenant.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {tenant.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 capitalize">
                            {tenant.subscription_tier}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">slug: {tenant.slug}</p>

                        {/* Sites */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {tenant.sites.map(site => (
                            <div key={site.id} className="flex items-center gap-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1">
                              <ChevronRight size={11} className="text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{site.name}</span>
                              <CopyButton text={`${APP_URL}/kiosk?site=${site.slug}`} label="kiosk URL" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 text-xs text-gray-400">
                      <Users size={13} />
                      {tenant.sites.length} site{tenant.sites.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showModal && (
        <OnboardModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  function copy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success(`Copied ${label}`)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-gray-400 hover:text-brand-500 transition-colors ml-0.5">
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

// ─── Onboard Modal ────────────────────────────────────────────────────────────

interface FormData {
  companyName: string
  schoolName:  string
  siteSlug:    string
  adminName:   string
  adminEmail:  string
  usesMicrosoft: boolean
  tier: string
}

type ModalStep = 'form' | 'saving' | 'done'

interface CreatedCustomer {
  tenantId: string
  siteId:   string
  siteSlug: string
  adminEmail: string
  usesMicrosoft: boolean
}

function OnboardModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<ModalStep>('form')
  const [created, setCreated] = useState<CreatedCustomer | null>(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState<FormData>({
    companyName:   '',
    schoolName:    '',
    siteSlug:      '',
    adminName:     '',
    adminEmail:    '',
    usesMicrosoft: true,
    tier:          'starter',
  })

  function set(field: keyof FormData, value: string | boolean) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-generate slug from school name (only if user hasn't manually edited it)
      if (field === 'schoolName' && typeof value === 'string') {
        next.siteSlug = toSlug(value)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.companyName || !form.schoolName || !form.siteSlug || !form.adminName || !form.adminEmail) {
      setError('Please fill in all fields.')
      return
    }
    setError('')
    setStep('saving')

    try {
      // 1. Create tenant
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({
          name: form.companyName,
          slug: form.siteSlug,
          subscription_tier: form.tier,
          is_active: true,
        })
        .select('id')
        .single()
      if (tenantErr) throw new Error('Could not create tenant: ' + tenantErr.message)

      // 2. Create site
      const { data: site, error: siteErr } = await supabase
        .from('sites')
        .insert({
          tenant_id: tenant.id,
          name:      form.schoolName,
          slug:      form.siteSlug,
          address:   'United Kingdom',
          timezone:  'Europe/London',
          is_active: true,
        })
        .select('id')
        .single()
      if (siteErr) throw new Error('Could not create site: ' + siteErr.message)

      // 3. Create IT admin profile
      const { error: profileErr } = await supabase
        .from('user_profiles')
        .insert({
          site_id:   site.id,
          tenant_id: tenant.id,
          email:     form.adminEmail.toLowerCase().trim(),
          full_name: form.adminName,
          role:      'site_admin',
          is_active: true,
        })
      if (profileErr) throw new Error('Could not create admin profile: ' + profileErr.message)

      setCreated({ tenantId: tenant.id, siteId: site.id, siteSlug: form.siteSlug, adminEmail: form.adminEmail, usesMicrosoft: form.usesMicrosoft })
      setStep('done')
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.')
      setStep('form')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={step !== 'saving' ? onClose : undefined} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
              <Building2 size={18} className="text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Onboard New Customer</h2>
              <p className="text-xs text-gray-400">Creates tenant, site, and IT admin account</p>
            </div>
          </div>
          {step !== 'saving' && (
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center">
              <X size={18} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Saving */}
        {step === 'saving' && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 size={36} className="text-brand-600 animate-spin" />
            <p className="text-sm text-gray-500">Setting up customer…</p>
          </div>
        )}

        {/* Done */}
        {step === 'done' && created && (
          <div className="p-6 space-y-5">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={24} className="text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">Customer Created!</h3>
              <p className="text-sm text-gray-500">Send these to the IT admin to get them live.</p>
            </div>

            {/* URL cards */}
            <div className="space-y-3">
              {created.usesMicrosoft && (
                <UrlCard
                  label="1. Microsoft Consent URL"
                  description="IT admin (Global Administrator) opens this once and clicks Accept"
                  url={CONSENT_URL}
                />
              )}
              <UrlCard
                label={created.usesMicrosoft ? '2. Admin Login URL' : '1. Admin Login URL'}
                description={`Sign in with ${created.adminEmail}`}
                url={`${APP_URL}/login`}
              />
              <UrlCard
                label={created.usesMicrosoft ? '3. Kiosk URL' : '2. Kiosk URL'}
                description="Bookmark this on the reception tablet"
                url={`${APP_URL}/kiosk?site=${created.siteSlug}`}
              />
            </div>

            <button onClick={onCreated} className="btn-primary w-full">
              Done
            </button>
          </div>
        )}

        {/* Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Company / Trust Name
                </label>
                <input
                  className="input"
                  placeholder="e.g. Gardener Schools Group"
                  value={form.companyName}
                  onChange={e => set('companyName', e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">The organisation that signed up — could be a trust or the school itself</p>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  School Name
                </label>
                <input
                  className="input"
                  placeholder="e.g. Kew House School"
                  value={form.schoolName}
                  onChange={e => set('schoolName', e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Site Slug <span className="text-gray-400 normal-case font-normal">(kiosk URL identifier)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 whitespace-nowrap">?site=</span>
                  <input
                    className="input font-mono text-sm"
                    placeholder="kew-house"
                    value={form.siteSlug}
                    onChange={e => set('siteSlug', toSlug(e.target.value))}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Auto-generated from school name. Must be unique.</p>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-white/[0.07] pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">IT Admin Account</p>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                <input
                  className="input"
                  placeholder="e.g. John Vasquez"
                  value={form.adminName}
                  onChange={e => set('adminName', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Work Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="e.g. john@gardenerschools.com"
                  value={form.adminEmail}
                  onChange={e => set('adminEmail', e.target.value)}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-white/[0.07] pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Setup</p>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.usesMicrosoft}
                  onChange={e => set('usesMicrosoft', e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">Uses Microsoft 365</p>
                  <p className="text-xs text-gray-400">Shows the admin consent URL in the confirmation screen</p>
                </div>
              </label>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Subscription Tier</label>
                <select
                  className="input"
                  value={form.tier}
                  onChange={e => set('tier', e.target.value)}
                >
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="internal">Internal (SOTARA)</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">
                <Building2 size={15} /> Create Customer
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── URL Card ─────────────────────────────────────────────────────────────────

function UrlCard({ label, description, url }: { label: string; description: string; url: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-500 flex-shrink-0">
          <ExternalLink size={13} />
        </a>
      </div>
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2">
        <p className="text-xs font-mono text-gray-600 dark:text-gray-300 flex-1 truncate">{url}</p>
        <button onClick={copy} className="text-gray-400 hover:text-brand-500 transition-colors flex-shrink-0">
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  )
}
