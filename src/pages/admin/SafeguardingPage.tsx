import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import TopBar from '@/components/layout/TopBar'
import { format, differenceInDays, parseISO } from 'date-fns'
import {
  ShieldAlert, AlertTriangle, CheckCircle, Clock, Plus, Search,
  RefreshCw, X, Trash2, Eye, EyeOff, Shield, UserX,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { DbsStatus, AlertSeverity, PersonGroup } from '@/types'

interface DbsRow {
  id: string
  person_id: string
  dbs_number: string
  issue_date: string
  expiry_date: string
  status: DbsStatus
  certificate_url: string | null
  notes: string | null
  person?: { full_name: string; group: PersonGroup; department: string | null; year_group: string | null }
}

interface WatchlistRow {
  id: string
  full_name: string
  aliases: string[] | null
  reason: string
  severity: AlertSeverity
  is_active: boolean
  notes: string | null
  created_at: string
}

interface PersonOption {
  id: string
  full_name: string
  group: PersonGroup
  department: string | null
}

type Tab = 'dbs' | 'watchlist'

const DBS_STATUS_CONFIG: Record<DbsStatus, { label: string; dot: string; icon: React.ReactNode }> = {
  valid:         { label: 'Valid',         dot: 'bg-brand-500',  icon: <CheckCircle size={13} /> },
  expiring_soon: { label: 'Expiring Soon', dot: 'bg-amber-400',  icon: <Clock size={13} /> },
  expired:       { label: 'Expired',       dot: 'bg-red-500',    icon: <AlertTriangle size={13} /> },
  missing:       { label: 'Missing',       dot: 'bg-red-500',    icon: <UserX size={13} /> },
}

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; text: string; dot: string }> = {
  info:     { label: 'Info',     text: 'text-gray-500',   dot: 'bg-gray-400' },
  warning:  { label: 'Warning',  text: 'text-amber-600',  dot: 'bg-amber-400' },
  critical: { label: 'Critical', text: 'text-red-600',    dot: 'bg-red-500' },
}

export default function SafeguardingPage() {
  const { site } = useSite()
  const [tab,          setTab]          = useState<Tab>('dbs')
  const [dbsRecords,   setDbsRecords]   = useState<DbsRow[]>([])
  const [watchlist,    setWatchlist]    = useState<WatchlistRow[]>([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [showAddDbs,   setShowAddDbs]   = useState(false)
  const [showAddWatch, setShowAddWatch] = useState(false)
  const [editDbs,      setEditDbs]      = useState<DbsRow | null>(null)

  const load = useCallback(async () => {
    if (!site) return
    setLoading(true)

    const [{ data: dbs }, { data: watch }] = await Promise.all([
      supabase
        .from('dbs_records')
        .select('*, person:persons(full_name, group, department, year_group)')
        .eq('site_id', site.id)
        .order('expiry_date'),
      supabase
        .from('watchlist')
        .select('*')
        .eq('site_id', site.id)
        .order('created_at', { ascending: false }),
    ])

    const today = new Date()
    const updatedDbs = (dbs ?? []).map((r: any) => {
      const daysLeft = differenceInDays(parseISO(r.expiry_date), today)
      let status: DbsStatus = 'valid'
      if (daysLeft < 0)        status = 'expired'
      else if (daysLeft <= 60) status = 'expiring_soon'
      return { ...r, status } as DbsRow
    })

    setDbsRecords(updatedDbs)
    setWatchlist((watch ?? []) as WatchlistRow[])
    setLoading(false)
  }, [site])

  useEffect(() => { load() }, [load])

  const dbsStats = {
    valid:         dbsRecords.filter(r => r.status === 'valid').length,
    expiring_soon: dbsRecords.filter(r => r.status === 'expiring_soon').length,
    expired:       dbsRecords.filter(r => r.status === 'expired' || r.status === 'missing').length,
  }

  const filteredDbs   = search ? dbsRecords.filter(r => r.person?.full_name?.toLowerCase().includes(search.toLowerCase()) || r.dbs_number?.toLowerCase().includes(search.toLowerCase())) : dbsRecords
  const filteredWatch = search ? watchlist.filter(w => w.full_name.toLowerCase().includes(search.toLowerCase()) || w.reason.toLowerCase().includes(search.toLowerCase())) : watchlist

  async function toggleWatchlistActive(id: string, current: boolean) {
    const { error } = await supabase.from('watchlist').update({ is_active: !current }).eq('id', id)
    if (error) { toast.error('Failed to update'); return }
    toast.success(current ? 'Entry deactivated' : 'Entry reactivated')
    load()
  }

  async function deleteWatchlist(id: string) {
    if (!confirm('Remove this watchlist entry permanently?')) return
    const { error } = await supabase.from('watchlist').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Entry removed')
    load()
  }

  async function deleteDbs(id: string) {
    if (!confirm('Delete this DBS record?')) return
    const { error } = await supabase.from('dbs_records').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('DBS record deleted')
    load()
  }

  return (
    <div>
      <TopBar
        title="Safeguarding"
        subtitle="DBS records, Single Central Register & Watchlist"
        actions={
          <div className="flex gap-2">
            <button onClick={load} className="btn-secondary py-2 text-sm">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {tab === 'dbs' && (
              <button onClick={() => setShowAddDbs(true)} className="btn-primary py-2 text-sm">
                <Plus size={15} /> Add DBS Record
              </button>
            )}
            {tab === 'watchlist' && (
              <button onClick={() => setShowAddWatch(true)} className="btn-primary py-2 text-sm">
                <Plus size={15} /> Add to Watchlist
              </button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-5">

        {/* Stats — clean, no colored borders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">DBS Valid</p>
              <CheckCircle size={16} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{dbsStats.valid}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Expiring Within 60 Days</p>
              <Clock size={16} className={dbsStats.expiring_soon > 0 ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'} />
            </div>
            <p className={`text-3xl font-bold tabular-nums ${dbsStats.expiring_soon > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
              {dbsStats.expiring_soon}
            </p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Expired / Missing</p>
              <AlertTriangle size={16} className={dbsStats.expired > 0 ? 'text-red-400' : 'text-gray-300 dark:text-gray-600'} />
            </div>
            <p className={`text-3xl font-bold tabular-nums ${dbsStats.expired > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {dbsStats.expired}
            </p>
          </div>
        </div>

        {/* Tab bar + search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
            <TabBtn active={tab === 'dbs'} onClick={() => setTab('dbs')} icon={<Shield size={14} />} label="DBS Records" badge={dbsStats.expired} badgeColor="red" />
            <TabBtn active={tab === 'watchlist'} onClick={() => setTab('watchlist')} icon={<ShieldAlert size={14} />} label="Watchlist" badge={watchlist.filter(w => w.is_active).length} badgeColor="amber" />
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 py-2 text-sm"
              placeholder={tab === 'dbs' ? 'Search by name or DBS number…' : 'Search watchlist…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* DBS Table */}
        {tab === 'dbs' && (
          <div className="card overflow-hidden">
            {loading ? <LoadingState /> : filteredDbs.length === 0 ? (
              <EmptyState icon={<Shield size={36} />} title="No DBS records found" subtitle="Add a DBS certificate to get started" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/[0.07]">
                      {['Person', 'DBS Number', 'Expiry Date', 'Days Left', 'Status', ''].map((h, i) => (
                        <th key={i} className={`text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i === 1 ? 'hidden md:table-cell' : ''} ${i === 5 ? 'w-20' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                    {filteredDbs.map(r => {
                      const daysLeft = differenceInDays(parseISO(r.expiry_date), new Date())
                      const cfg = DBS_STATUS_CONFIG[r.status]
                      return (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-gray-900 dark:text-white">{r.person?.full_name ?? '—'}</p>
                            <p className="text-xs text-gray-400">{r.person?.department ?? (r.person?.group === 'teaching_staff' ? 'Teaching' : 'Non-Teaching')}</p>
                          </td>
                          <td className="px-4 py-3.5 text-gray-400 font-mono text-xs hidden md:table-cell">{r.dbs_number}</td>
                          <td className="px-4 py-3.5 text-gray-700 dark:text-gray-300">{format(parseISO(r.expiry_date), 'd MMM yyyy')}</td>
                          <td className="px-4 py-3.5">
                            <span className={`text-sm font-semibold tabular-nums ${
                              daysLeft < 0  ? 'text-red-600 dark:text-red-400' :
                              daysLeft <= 30 ? 'text-red-500' :
                              daysLeft <= 60 ? 'text-amber-600' :
                              'text-gray-700 dark:text-gray-300'
                            }`}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="flex items-center gap-1.5 text-xs">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                              <span className="text-gray-600 dark:text-gray-400">{cfg.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => setEditDbs(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors">
                                <Eye size={14} />
                              </button>
                              <button onClick={() => deleteDbs(r.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Watchlist */}
        {tab === 'watchlist' && (
          <div className="space-y-2">
            {loading ? (
              <div className="card"><LoadingState /></div>
            ) : filteredWatch.length === 0 ? (
              <div className="card">
                <EmptyState icon={<ShieldAlert size={36} />} title="Watchlist is empty" subtitle="Add a person of concern to monitor them at sign-in" />
              </div>
            ) : (
              filteredWatch.map(w => {
                const cfg = SEVERITY_CONFIG[w.severity]
                return (
                  <div key={w.id} className={`card p-5 ${!w.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                        <ShieldAlert size={15} className="text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-gray-900 dark:text-white">{w.full_name}</p>
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            <span className={cfg.text}>{cfg.label}</span>
                          </span>
                          {!w.is_active && <span className="text-xs text-gray-400">Inactive</span>}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{w.reason}</p>
                        {w.aliases && w.aliases.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">Also known as: {w.aliases.join(', ')}</p>
                        )}
                        {w.notes && <p className="text-xs text-gray-400 mt-1">{w.notes}</p>}
                        <p className="text-xs text-gray-400 mt-2">Added {format(new Date(w.created_at), 'd MMM yyyy')}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => toggleWatchlistActive(w.id, w.is_active)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                          {w.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button onClick={() => deleteWatchlist(w.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {showAddDbs && <AddDbsModal siteId={site?.id ?? ''} onClose={() => setShowAddDbs(false)} onSaved={() => { setShowAddDbs(false); load() }} />}
      {editDbs    && <AddDbsModal siteId={site?.id ?? ''} existing={editDbs} onClose={() => setEditDbs(null)} onSaved={() => { setEditDbs(null); load() }} />}
      {showAddWatch && <AddWatchlistModal siteId={site?.id ?? ''} onClose={() => setShowAddWatch(false)} onSaved={() => { setShowAddWatch(false); load() }} />}
    </div>
  )
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, label, badge, badgeColor }: {
  active: boolean; onClick: () => void; icon: React.ReactNode
  label: string; badge: number; badgeColor: 'red' | 'amber'
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      {icon}
      {label}
      {badge > 0 && (
        <span className={`w-4 h-4 rounded-full text-white text-xs flex items-center justify-center ml-0.5 ${badgeColor === 'red' ? 'bg-red-500' : 'bg-amber-500'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

// ─── Add DBS Modal ────────────────────────────────────────────────────────────

function AddDbsModal({ siteId, existing, onClose, onSaved }: {
  siteId: string; existing?: DbsRow | null; onClose: () => void; onSaved: () => void
}) {
  const [personId,   setPersonId]   = useState(existing?.person_id ?? '')
  const [dbsNumber,  setDbsNumber]  = useState(existing?.dbs_number ?? '')
  const [issueDate,  setIssueDate]  = useState(existing?.issue_date ?? '')
  const [expiryDate, setExpiryDate] = useState(existing?.expiry_date ?? '')
  const [notes,      setNotes]      = useState(existing?.notes ?? '')
  const [persons,    setPersons]    = useState<PersonOption[]>([])
  const [saving,     setSaving]     = useState(false)
  const [search,     setSearch]     = useState(existing?.person?.full_name ?? '')

  useEffect(() => {
    async function loadPersons() {
      const { data } = await supabase.from('persons').select('id, full_name, group, department').eq('site_id', siteId).in('group', ['teaching_staff', 'non_teaching_staff']).eq('is_active', true).order('last_name')
      setPersons((data ?? []) as PersonOption[])
    }
    loadPersons()
  }, [siteId])

  const filtered = search ? persons.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase())) : persons

  async function save() {
    if (!personId || !dbsNumber || !issueDate || !expiryDate) { toast.error('Fill in all required fields'); return }
    setSaving(true)
    const payload = { site_id: siteId, person_id: personId, dbs_number: dbsNumber, issue_date: issueDate, expiry_date: expiryDate, notes: notes || null, status: 'valid' as DbsStatus }
    const { error } = existing
      ? await supabase.from('dbs_records').update(payload).eq('id', existing.id)
      : await supabase.from('dbs_records').insert(payload)
    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return }
    toast.success(existing ? 'DBS record updated' : 'DBS record added')
    onSaved()
  }

  return (
    <Modal title={existing ? 'Edit DBS Record' : 'Add DBS Record'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Staff Member <span className="text-red-500">*</span></label>
          <input className="input" placeholder="Search name…" value={search} onChange={e => { setSearch(e.target.value); setPersonId('') }} />
          {search && !personId && filtered.length > 0 && (
            <div className="border border-gray-200 dark:border-white/10 rounded-xl mt-1 max-h-40 overflow-y-auto divide-y divide-gray-50 dark:divide-white/[0.04]">
              {filtered.slice(0, 8).map(p => (
                <button key={p.id} onClick={() => { setPersonId(p.id); setSearch(p.full_name) }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                  <span className="font-medium">{p.full_name}</span>
                  <span className="text-gray-400 ml-2 text-xs">{p.department ?? p.group}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="label">DBS Certificate Number <span className="text-red-500">*</span></label>
          <input className="input" value={dbsNumber} onChange={e => setDbsNumber(e.target.value)} placeholder="e.g. 001234567890" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Issue Date <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Expiry Date <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? <RefreshCw size={15} className="animate-spin" /> : null}
            {saving ? 'Saving…' : existing ? 'Update Record' : 'Add Record'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Watchlist Modal ──────────────────────────────────────────────────────

function AddWatchlistModal({ siteId, onClose, onSaved }: { siteId: string; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('')
  const [aliases,  setAliases]  = useState('')
  const [reason,   setReason]   = useState('')
  const [severity, setSeverity] = useState<AlertSeverity>('warning')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)

  async function save() {
    if (!fullName.trim() || !reason.trim()) { toast.error('Name and reason are required'); return }
    setSaving(true)
    const { error } = await supabase.from('watchlist').insert({
      site_id: siteId, full_name: fullName.trim(),
      aliases: aliases ? aliases.split(',').map(a => a.trim()).filter(Boolean) : null,
      reason: reason.trim(), severity, notes: notes || null, is_active: true,
    })
    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return }
    toast.success('Added to watchlist')
    onSaved()
  }

  return (
    <Modal title="Add to Watchlist" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Full Name <span className="text-red-500">*</span></label>
          <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Person's full name" />
        </div>
        <div>
          <label className="label">Aliases / Other Names</label>
          <input className="input" value={aliases} onChange={e => setAliases(e.target.value)} placeholder="Comma-separated aliases (optional)" />
        </div>
        <div>
          <label className="label">Reason <span className="text-red-500">*</span></label>
          <textarea className="input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this person on the watchlist?" />
        </div>
        <div>
          <label className="label">Severity</label>
          <div className="flex gap-2">
            {(['info', 'warning', 'critical'] as AlertSeverity[]).map(s => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors capitalize ${
                  severity === s
                    ? s === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
                    : s === 'warning'  ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
                    : 'border-gray-400 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300'
                    : 'border-gray-200 dark:border-white/10 text-gray-500 hover:border-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional context…" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? <RefreshCw size={15} className="animate-spin" /> : null}
            {saving ? 'Saving…' : 'Add to Watchlist'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#162218] rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-white/[0.07]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/[0.07]">
          <h2 className="font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <div className="mx-auto mb-3 w-fit opacity-25">{icon}</div>
      <p className="font-medium text-gray-500">{title}</p>
      <p className="text-sm mt-1">{subtitle}</p>
    </div>
  )
}
