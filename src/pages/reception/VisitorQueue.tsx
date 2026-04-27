import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import TopBar from '@/components/layout/TopBar'
import { Search, Plus, RefreshCw, X, LogOut, Clock, Building2, Mail, Phone, User, Calendar } from 'lucide-react'
import type { VisitLog, VisitStatus } from '@/types'
import { format, subDays, differenceInMinutes } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_TABS: { label: string; value: VisitStatus | 'all' }[] = [
  { label: 'All',        value: 'all' },
  { label: 'On Site',    value: 'checked_in' },
  { label: 'Expected',   value: 'expected' },
  { label: 'Signed Out', value: 'checked_out' },
  { label: 'Denied',     value: 'denied' },
]

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

export default function VisitorQueue() {
  const { site } = useSite()
  const [logs,         setLogs]         = useState<VisitLog[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<VisitStatus | 'all'>('all')
  const [selectedDate, setSelectedDate] = useState(isoDate(new Date()))
  const [showAdd,      setShowAdd]      = useState(false)
  const [selectedLog,  setSelectedLog]  = useState<VisitLog | null>(null)

  async function load() {
    if (!site) return
    setLoading(true)
    let query = supabase
      .from('visit_logs')
      .select('*, visitor:visitors(*)')
      .eq('site_id', site.id)
      .gte('created_at', `${selectedDate}T00:00:00`)
      .lte('created_at', `${selectedDate}T23:59:59`)
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)

    const { data } = await query
    setLogs((data as VisitLog[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [site, statusFilter, selectedDate])

  const filtered = search
    ? logs.filter(l =>
        l.visitor?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.host_name?.toLowerCase().includes(search.toLowerCase())
      )
    : logs

  async function signOut(log: VisitLog) {
    const { error } = await supabase
      .from('visit_logs')
      .update({ status: 'checked_out', checked_out_at: new Date().toISOString() })
      .eq('id', log.id)
    if (error) { toast.error('Failed to sign out'); return }
    toast.success(`${log.visitor?.full_name ?? 'Visitor'} signed out`)
    setSelectedLog(null)
    load()
  }

  const todayStr     = isoDate(new Date())
  const yesterdayStr = isoDate(subDays(new Date(), 1))
  const dateLabel    = selectedDate === todayStr ? 'Today'
    : selectedDate === yesterdayStr ? 'Yesterday'
    : format(new Date(selectedDate + 'T12:00:00'), 'd MMM yyyy')

  return (
    <div>
      <TopBar
        title="Visitor Log"
        subtitle={`${dateLabel} · ${filtered.length} visitor${filtered.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex gap-2">
            <button onClick={load} className="btn-secondary py-2 text-sm">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-primary py-2 text-sm">
              <Plus size={16} /> Add Visitor
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Date picker row */}
        <div className="flex flex-wrap items-center gap-2">
          <Calendar size={15} className="text-gray-400 flex-shrink-0" />
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedDate === todayStr ? 'bg-brand-600 text-white' : 'btn-secondary'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setSelectedDate(yesterdayStr)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedDate === yesterdayStr ? 'bg-brand-600 text-white' : 'btn-secondary'
            }`}
          >
            Yesterday
          </button>
          <input
            type="date"
            max={todayStr}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="input py-1.5 text-sm w-auto"
          />
        </div>

        {/* Search + status filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 py-2"
              placeholder="Search by visitor or host name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">Visitor</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Company</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Host</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">In</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Out</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(log => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {log.visitor?.photo_url ? (
                            <img
                              src={log.visitor.photo_url}
                              alt=""
                              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 text-brand-600 font-semibold text-sm">
                              {(log.visitor?.full_name ?? '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{log.visitor?.full_name ?? '—'}</p>
                            {log.purpose && <p className="text-xs text-gray-400">{log.purpose}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{log.visitor?.company ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{log.host_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {log.checked_in_at ? format(new Date(log.checked_in_at), 'HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {log.checked_out_at ? format(new Date(log.checked_out_at), 'HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {log.status === 'checked_in' && (
                          <button
                            onClick={e => { e.stopPropagation(); signOut(log) }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <LogOut size={12} /> Sign Out
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        No visitors found for {dateLabel.toLowerCase()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAdd && site && (
        <AddVisitorModal
          siteId={site.id}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}

      {selectedLog && (
        <VisitorDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onSignOut={() => signOut(selectedLog)}
        />
      )}
    </div>
  )
}

// ─── Visitor Detail Modal ─────────────────────────────────────────────────────

function VisitorDetailModal({
  log,
  onClose,
  onSignOut,
}: {
  log: VisitLog
  onClose: () => void
  onSignOut: () => void
}) {
  const v = log.visitor

  const duration = log.checked_in_at && log.checked_out_at
    ? differenceInMinutes(new Date(log.checked_out_at), new Date(log.checked_in_at))
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Visitor Details</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex gap-5 mb-6">
            {/* Photo */}
            <div className="flex-shrink-0">
              {v?.photo_url ? (
                <img
                  src={v.photo_url}
                  alt={v.full_name ?? ''}
                  className="w-20 h-20 rounded-2xl object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-brand-100 flex items-center justify-center">
                  <span className="text-brand-600 font-bold text-2xl">
                    {(v?.full_name ?? '?').split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </span>
                </div>
              )}
            </div>

            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold text-gray-900 leading-tight">{v?.full_name ?? '—'}</p>
              {v?.company && <p className="text-sm text-gray-500 mt-0.5">{v.company}</p>}
              <div className="mt-2">
                <StatusBadge status={log.status} />
              </div>
            </div>
          </div>

          {/* Detail grid */}
          <div className="space-y-3">
            {v?.email && (
              <DetailRow icon={<Mail size={14} />} label="Email" value={v.email} />
            )}
            {v?.phone && (
              <DetailRow icon={<Phone size={14} />} label="Phone" value={v.phone} />
            )}
            {log.host_name && (
              <DetailRow icon={<User size={14} />} label="Visiting" value={log.host_name} />
            )}
            {log.purpose && (
              <DetailRow icon={<Building2 size={14} />} label="Purpose" value={log.purpose} />
            )}
            <DetailRow
              icon={<Clock size={14} />}
              label="Signed In"
              value={log.checked_in_at ? format(new Date(log.checked_in_at), 'dd MMM yyyy, HH:mm') : '—'}
            />
            {log.checked_out_at && (
              <DetailRow
                icon={<Clock size={14} />}
                label="Signed Out"
                value={format(new Date(log.checked_out_at), 'dd MMM yyyy, HH:mm')}
              />
            )}
            {duration !== null && (
              <DetailRow
                icon={<Clock size={14} />}
                label="Duration"
                value={duration >= 60
                  ? `${Math.floor(duration / 60)}h ${duration % 60}m`
                  : `${duration}m`}
              />
            )}
            {log.notes && (
              <DetailRow icon={<User size={14} />} label="Notes" value={log.notes} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Close</button>
          {log.status === 'checked_in' && (
            <button
              onClick={onSignOut}
              className="btn-danger flex items-center gap-2"
            >
              <LogOut size={15} /> Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-sm text-gray-900">{value}</p>
      </div>
    </div>
  )
}

// ─── Add Visitor Modal ────────────────────────────────────────────────────────

function AddVisitorModal({
  siteId,
  onClose,
  onSaved,
}: {
  siteId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [company,    setCompany]    = useState('')
  const [email,      setEmail]      = useState('')
  const [hostName,   setHostName]   = useState('')
  const [purpose,    setPurpose]    = useState('')
  const [saving,     setSaving]     = useState(false)

  const PURPOSES = ['Meeting', 'Delivery', 'Maintenance', 'Interview', 'Parent Visit', 'Official Visit', 'Other']

  async function save() {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required')
      return
    }
    setSaving(true)

    // 1. Upsert visitor record (match by name + site)
    const { data: visitorData, error: visitorErr } = await supabase
      .from('visitors')
      .insert({
        site_id: siteId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        visitor_type: 'other',
      })
      .select('id')
      .single()

    if (visitorErr) {
      toast.error('Failed to create visitor: ' + visitorErr.message)
      setSaving(false)
      return
    }

    // 2. Create visit log
    const { error: logErr } = await supabase.from('visit_logs').insert({
      site_id: siteId,
      visitor_id: visitorData.id,
      host_name: hostName.trim() || null,
      purpose: purpose || null,
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
    })

    if (logErr) {
      toast.error('Failed to create visit log: ' + logErr.message)
      setSaving(false)
      return
    }

    toast.success(`${firstName} ${lastName} signed in`)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Add Visitor</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First Name <span className="text-red-500">*</span></label>
              <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" />
            </div>
            <div>
              <label className="label">Last Name <span className="text-red-500">*</span></label>
              <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
            </div>
          </div>
          <div>
            <label className="label">Company / Organisation</label>
            <input className="input" value={company} onChange={e => setCompany(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="label">Host Name</label>
            <input className="input" value={hostName} onChange={e => setHostName(e.target.value)} placeholder="Who are they visiting?" />
          </div>
          <div>
            <label className="label">Purpose of Visit</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PURPOSES.map(p => (
                <button
                  key={p}
                  onClick={() => setPurpose(purpose === p ? '' : p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    purpose === p
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
              {saving ? 'Adding…' : 'Sign In Visitor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VisitStatus }) {
  const map: Record<VisitStatus, string> = {
    checked_in:  'badge-green',
    checked_out: 'badge-gray',
    expected:    'badge-blue',
    denied:      'badge-red',
    cancelled:   'badge-gray',
    no_show:     'badge-amber',
  }
  const labels: Record<VisitStatus, string> = {
    checked_in:  'On Site',
    checked_out: 'Signed Out',
    expected:    'Expected',
    denied:      'Denied',
    cancelled:   'Cancelled',
    no_show:     'No Show',
  }
  return <span className={map[status] ?? 'badge-gray'}>{labels[status] ?? status}</span>
}
