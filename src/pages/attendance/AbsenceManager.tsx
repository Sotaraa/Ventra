import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import TopBar from '@/components/layout/TopBar'
import { format, subDays } from 'date-fns'
import {
  Plus, Search, RefreshCw, X, Loader2,
  CheckCircle, AlertTriangle, Calendar, UserX,
} from 'lucide-react'
import type { AbsenceRecord, Person, AbsenceType } from '@/types'
import toast from 'react-hot-toast'

const ABSENCE_TYPES: { value: AbsenceType; label: string; colour: string }[] = [
  { value: 'sick',          label: 'Sick',            colour: 'bg-red-100 text-red-700' },
  { value: 'authorised',    label: 'Authorised',      colour: 'bg-green-100 text-green-700' },
  { value: 'unauthorised',  label: 'Unauthorised',    colour: 'bg-orange-100 text-orange-700' },
  { value: 'holiday',       label: 'Holiday',         colour: 'bg-blue-100 text-blue-700' },
  { value: 'medical',       label: 'Medical Appt.',   colour: 'bg-purple-100 text-purple-700' },
  { value: 'other',         label: 'Other',           colour: 'bg-gray-100 text-gray-600' },
]

const absenceColour = (type: AbsenceType) =>
  ABSENCE_TYPES.find(t => t.value === type)?.colour ?? 'bg-gray-100 text-gray-600'

const absenceLabel = (type: AbsenceType) =>
  ABSENCE_TYPES.find(t => t.value === type)?.label ?? type

// ─── Add / Edit Absence Modal ─────────────────────────────────────────────────

interface AddModalProps {
  siteId: string
  onClose: () => void
  onSaved: () => void
}

function AddAbsenceModal({ siteId, onClose, onSaved }: AddModalProps) {
  const today = new Date().toISOString().slice(0, 10)

  const [personSearch,   setPersonSearch]   = useState('')
  const [personResults,  setPersonResults]  = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [absenceType,    setAbsenceType]    = useState<AbsenceType>('sick')
  const [startDate,      setStartDate]      = useState(today)
  const [endDate,        setEndDate]        = useState(today)
  const [reason,         setReason]         = useState('')
  const [parentNotified, setParentNotified] = useState(false)
  const [saving,         setSaving]         = useState(false)

  useEffect(() => {
    if (personSearch.length < 2) { setPersonResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('persons')
        .select('id, first_name, last_name, full_name, group, year_group, department')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .ilike('full_name', `%${personSearch}%`)
        .limit(8)
      setPersonResults((data as Person[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [personSearch, siteId])

  async function handleSave() {
    if (!selectedPerson) return
    setSaving(true)
    const { error } = await supabase.from('absence_records').insert({
      site_id:            siteId,
      person_id:          selectedPerson.id,
      absence_type:       absenceType,
      start_date:         startDate,
      end_date:           endDate,
      reason:             reason.trim() || null,
      parent_notified:    parentNotified,
      parent_notified_at: parentNotified ? new Date().toISOString() : null,
    })
    if (error) {
      toast.error('Failed to record absence')
    } else {
      toast.success(`Absence recorded for ${selectedPerson.first_name}`)
      onSaved()
      onClose()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">Record Absence</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Person search */}
          <div>
            <label className="label">Person <span className="text-red-400">*</span></label>
            {selectedPerson ? (
              <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-xl border border-brand-200">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs flex-shrink-0">
                  {selectedPerson.first_name[0]}{selectedPerson.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{selectedPerson.full_name}</p>
                  <p className="text-xs text-gray-400">
                    {selectedPerson.group?.replace(/_/g, ' ')}
                    {selectedPerson.year_group ? ` · ${selectedPerson.year_group}` : ''}
                    {selectedPerson.department ? ` · ${selectedPerson.department}` : ''}
                  </p>
                </div>
                <button onClick={() => { setSelectedPerson(null); setPersonSearch('') }}
                  className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9"
                  placeholder="Search by name…"
                  value={personSearch}
                  onChange={e => setPersonSearch(e.target.value)}
                  autoFocus
                />
                {personResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-10 max-h-48 overflow-y-auto">
                    {personResults.map(p => (
                      <button key={p.id}
                        onClick={() => { setSelectedPerson(p); setPersonSearch(p.full_name); setPersonResults([]) }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs flex-shrink-0">
                          {p.first_name[0]}{p.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.full_name}</p>
                          <p className="text-xs text-gray-400">{p.group?.replace(/_/g, ' ')}{p.year_group ? ` · ${p.year_group}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Absence type */}
          <div>
            <label className="label">Absence Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ABSENCE_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setAbsenceType(t.value)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all text-left ${
                    absenceType === t.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={startDate}
                onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value) }} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={endDate} min={startDate}
                onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="label">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input" rows={2} placeholder="Brief reason for the absence…"
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          {/* Parent notified */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 border border-gray-100">
            <input type="checkbox" checked={parentNotified} onChange={e => setParentNotified(e.target.checked)}
              className="rounded w-4 h-4 accent-brand-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">Parent / Carer Notified</p>
              <p className="text-xs text-gray-400">Check if parent has been contacted about this absence</p>
            </div>
          </label>
        </div>

        <div className="px-6 pb-6">
          <button onClick={handleSave} disabled={saving || !selectedPerson} className="btn-primary w-full justify-center">
            {saving && <Loader2 size={15} className="animate-spin" />}
            Record Absence
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AbsenceManager() {
  const { site } = useSite()
  const today   = new Date().toISOString().slice(0, 10)
  const weekAgo = subDays(new Date(), 7).toISOString().slice(0, 10)

  const [absences,   setAbsences]   = useState<(AbsenceRecord & { person?: Person })[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [fromDate,   setFromDate]   = useState(weekAgo)
  const [toDate,     setToDate]     = useState(today)
  const [typeFilter, setTypeFilter] = useState<AbsenceType | 'all'>('all')
  const [showModal,  setShowModal]  = useState(false)

  async function load() {
    if (!site) return
    setLoading(true)
    let q = supabase
      .from('absence_records')
      .select('*, person:persons(id, first_name, last_name, full_name, group, year_group, department)')
      .eq('site_id', site.id)
      .gte('start_date', fromDate)
      .lte('start_date', toDate)
      .order('start_date', { ascending: false })
    if (typeFilter !== 'all') q = q.eq('absence_type', typeFilter)
    const { data, error } = await q
    if (error) { toast.error('Failed to load absences') }
    setAbsences((data ?? []) as (AbsenceRecord & { person?: Person })[])
    setLoading(false)
  }

  useEffect(() => { load() }, [site, fromDate, toDate, typeFilter])

  async function toggleParentNotified(absence: AbsenceRecord & { person?: Person }) {
    const newVal = !absence.parent_notified
    const { error } = await supabase
      .from('absence_records')
      .update({ parent_notified: newVal, parent_notified_at: newVal ? new Date().toISOString() : null })
      .eq('id', absence.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success(newVal ? 'Marked as notified' : 'Notification removed')
    load()
  }

  async function authorise(absence: AbsenceRecord) {
    const { error } = await supabase
      .from('absence_records')
      .update({ absence_type: 'authorised', approved_at: new Date().toISOString() })
      .eq('id', absence.id)
    if (error) { toast.error('Failed to authorise'); return }
    toast.success('Absence authorised')
    load()
  }

  async function deleteAbsence(id: string) {
    if (!confirm('Delete this absence record? This cannot be undone.')) return
    const { error } = await supabase.from('absence_records').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Deleted')
    load()
  }

  const filtered = search
    ? absences.filter(a =>
        a.person?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.reason?.toLowerCase().includes(search.toLowerCase())
      )
    : absences

  const unauth     = absences.filter(a => a.absence_type === 'unauthorised').length
  const unnotified = absences.filter(a => !a.parent_notified && a.person?.group === 'student').length

  const PRESETS = [
    { label: 'Today',    from: today,    to: today },
    { label: 'This week',from: weekAgo,  to: today },
    { label: 'Last 30d', from: subDays(new Date(), 30).toISOString().slice(0, 10), to: today },
  ]

  return (
    <div>
      <TopBar
        title="Absence Manager"
        subtitle="Review and manage absences"
        actions={
          <div className="flex gap-2">
            <button onClick={load} className="btn-secondary py-2 text-sm">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={() => setShowModal(true)} className="btn-primary py-2 text-sm">
              <Plus size={15} /> Record Absence
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-5">

        {/* Alert banners */}
        {(unauth > 0 || unnotified > 0) && (
          <div className="flex flex-wrap gap-3">
            {unauth > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700 font-medium">
                <AlertTriangle size={15} />
                {unauth} unauthorised absence{unauth !== 1 ? 's' : ''} in this period
              </div>
            )}
            {unnotified > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium">
                <AlertTriangle size={15} />
                {unnotified} student absence{unnotified !== 1 ? 's' : ''} — parent not yet notified
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 py-2" placeholder="Search by name or reason…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            <Calendar size={15} className="text-gray-400" />
            <input type="date" className="input py-1.5 text-sm" value={fromDate} max={toDate}
              onChange={e => setFromDate(e.target.value)} />
            <span className="text-gray-400 text-sm">–</span>
            <input type="date" className="input py-1.5 text-sm" value={toDate} min={fromDate} max={today}
              onChange={e => setToDate(e.target.value)} />
          </div>
          <select className="input py-1.5 text-sm flex-shrink-0" value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as AbsenceType | 'all')}>
            <option value="all">All types</option>
            {ABSENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Quick presets */}
        <div className="flex gap-2">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => { setFromDate(p.from); setToDate(p.to) }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                fromDate === p.from && toDate === p.to
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-100">
            <p className="text-sm text-gray-500">
              {loading ? 'Loading…' : `${filtered.length} absence${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <UserX size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No absences found</p>
              <p className="text-sm mt-1">Adjust the date range or record a new absence</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">Person</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Dates</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Reason</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Parent Notified</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(absence => (
                    <tr key={absence.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                            {absence.person?.first_name?.[0]}{absence.person?.last_name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{absence.person?.full_name}</p>
                            <p className="text-xs text-gray-400">
                              {absence.person?.group?.replace(/_/g, ' ')}
                              {absence.person?.year_group ? ` · ${absence.person.year_group}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${absenceColour(absence.absence_type)}`}>
                          {absenceLabel(absence.absence_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell whitespace-nowrap">
                        <span className="font-medium">{format(new Date(absence.start_date + 'T12:00:00'), 'dd MMM yyyy')}</span>
                        {absence.end_date !== absence.start_date && (
                          <span className="text-gray-400"> – {format(new Date(absence.end_date + 'T12:00:00'), 'dd MMM')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell max-w-xs truncate">
                        {absence.reason ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <button onClick={() => toggleParentNotified(absence)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            absence.parent_notified
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                          {absence.parent_notified ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                          {absence.parent_notified ? 'Notified' : 'Not notified'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {absence.absence_type === 'unauthorised' && (
                            <button onClick={() => authorise(absence)}
                              className="px-2.5 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors">
                              Authorise
                            </button>
                          )}
                          <button onClick={() => deleteAbsence(absence.id)}
                            className="px-2.5 py-1 rounded-lg bg-red-100 text-red-600 text-xs font-medium hover:bg-red-200 transition-colors">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && site && (
        <AddAbsenceModal siteId={site.id} onClose={() => setShowModal(false)} onSaved={load} />
      )}
    </div>
  )
}
