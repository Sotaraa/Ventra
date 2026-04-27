import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import TopBar from '@/components/layout/TopBar'
import { format, subDays, addDays } from 'date-fns'
import {
  UserCheck, UserX, Clock, Save, RefreshCw,
  ChevronLeft, ChevronRight, Users, CheckCircle,
} from 'lucide-react'
import type { Person, PersonGroup } from '@/types'
import toast from 'react-hot-toast'

type MarkStatus = 'present' | 'absent' | 'late' | 'authorised_absence' | null

interface PersonMark {
  person: Person
  status: MarkStatus
  existingId: string | null
  signedInAt: string | null
}

const GROUP_TABS: { label: string; value: PersonGroup }[] = [
  { label: 'Students',     value: 'student' },
  { label: 'Teaching',     value: 'teaching_staff' },
  { label: 'Non-Teaching', value: 'non_teaching_staff' },
]

const STATUS_OPTIONS: { value: MarkStatus; label: string; icon: React.ReactNode; active: string }[] = [
  { value: 'present',            label: 'Present',     icon: <UserCheck size={14} />,   active: 'bg-brand-600 text-white' },
  { value: 'absent',             label: 'Absent',      icon: <UserX size={14} />,       active: 'bg-red-500 text-white' },
  { value: 'late',               label: 'Late',        icon: <Clock size={14} />,       active: 'bg-amber-500 text-white' },
  { value: 'authorised_absence', label: 'Auth. Leave', icon: <CheckCircle size={14} />, active: 'bg-gray-600 text-white' },
]

export default function RegisterView() {
  const { site } = useSite()
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [group,      setGroup]      = useState<PersonGroup>('student')
  const [yearFilter, setYearFilter] = useState('all')
  const [marks,      setMarks]      = useState<PersonMark[]>([])
  const [yearGroups, setYearGroups] = useState<string[]>([])
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [dirty,      setDirty]      = useState(false)

  async function load() {
    if (!site) return
    setLoading(true)
    setDirty(false)

    let q = supabase
      .from('persons')
      .select('*')
      .eq('site_id', site.id)
      .eq('group', group)
      .eq('is_active', true)
      .order('last_name')

    if (group === 'student' && yearFilter !== 'all') q = q.eq('year_group', yearFilter)

    const { data: persons } = await q

    if (group === 'student') {
      const { data: allStudents } = await supabase
        .from('persons')
        .select('year_group')
        .eq('site_id', site.id)
        .eq('group', 'student')
        .eq('is_active', true)
        .not('year_group', 'is', null)
      const ygs = [...new Set((allStudents ?? []).map((p: any) => p.year_group as string))].sort()
      setYearGroups(ygs)
    } else {
      setYearGroups([])
    }

    if (!persons?.length) { setMarks([]); setLoading(false); return }

    const { data: records } = await supabase
      .from('attendance_records')
      .select('id, person_id, status, signed_in_at')
      .eq('date', date)
      .in('person_id', persons.map(p => p.id))

    const recMap = new Map((records ?? []).map(r => [r.person_id, r]))

    setMarks(persons.map(p => {
      const rec = recMap.get(p.id)
      return {
        person: p as Person,
        status: (rec?.status as MarkStatus) ?? null,
        existingId: rec?.id ?? null,
        signedInAt: rec?.signed_in_at ?? null,
      }
    }))

    setLoading(false)
  }

  useEffect(() => { load() }, [site, group, yearFilter, date])

  function setMark(personId: string, status: MarkStatus) {
    setMarks(prev => prev.map(m => m.person.id === personId ? { ...m, status } : m))
    setDirty(true)
  }

  function markAll(status: MarkStatus) {
    setMarks(prev => prev.map(m => ({ ...m, status })))
    setDirty(true)
  }

  async function saveRegister() {
    if (!site || !dirty) return
    setSaving(true)
    const now = new Date().toISOString()
    const toSave = marks.filter(m => m.status !== null)

    if (!toSave.length) {
      toast('No marks to save — mark at least one person first')
      setSaving(false)
      return
    }

    const toInsert = toSave.filter(m => !m.existingId)
    const toUpdate = toSave.filter(m => m.existingId)
    let hasError = false

    if (toInsert.length) {
      const { error } = await supabase.from('attendance_records').insert(
        toInsert.map(m => ({
          site_id: site.id,
          person_id: m.person.id,
          date,
          status: m.status,
          signed_in_at: (m.status === 'present' || m.status === 'late') ? now : null,
        }))
      )
      if (error) { console.error(error); hasError = true }
    }

    if (toUpdate.length) {
      const byStatus = new Map<string, string[]>()
      toUpdate.forEach(m => {
        const ids = byStatus.get(m.status!) ?? []
        ids.push(m.existingId!)
        byStatus.set(m.status!, ids)
      })
      for (const [status, ids] of byStatus) {
        const { error } = await supabase.from('attendance_records').update({ status }).in('id', ids)
        if (error) { console.error(error); hasError = true }
      }
    }

    if (hasError) {
      toast.error('Some records failed to save')
    } else {
      toast.success(`Register saved — ${toSave.length} records`)
      setDirty(false)
      load()
    }
    setSaving(false)
  }

  const summary = {
    present:  marks.filter(m => m.status === 'present').length,
    absent:   marks.filter(m => m.status === 'absent').length,
    late:     marks.filter(m => m.status === 'late').length,
    auth:     marks.filter(m => m.status === 'authorised_absence').length,
    unmarked: marks.filter(m => m.status === null).length,
  }

  const isToday = date === new Date().toISOString().slice(0, 10)

  return (
    <div>
      <TopBar
        title="Class Register"
        subtitle="Mark attendance by group"
        actions={
          <div className="flex gap-2">
            <button onClick={load} className="btn-secondary py-2 text-sm">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={saveRegister} disabled={saving || !dirty} className="btn-primary py-2 text-sm disabled:opacity-40">
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Saving…' : 'Save Register'}
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-5">

        {/* Controls row */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-1 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-1 flex-shrink-0">
            <button
              onClick={() => setDate(isoDate(subDays(new Date(date), 1)))}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center"
            >
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="text-sm font-medium text-gray-900 dark:text-white focus:outline-none px-1 bg-transparent"
            />
            <button
              onClick={() => setDate(isoDate(addDays(new Date(date), 1)))}
              disabled={isToday}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center disabled:opacity-30"
            >
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
            {GROUP_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => { setGroup(tab.value); setYearFilter('all') }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  group === tab.value
                    ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {group === 'student' && yearGroups.length > 0 && (
            <select
              className="input py-1.5 text-sm flex-shrink-0"
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
            >
              <option value="all">All year groups</option>
              {yearGroups.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>

        {/* Summary — plain text, no colored pills */}
        {!loading && marks.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-3 flex-wrap">
            {summary.present  > 0 && <span className="text-brand-600 dark:text-brand-400 font-medium">{summary.present} present</span>}
            {summary.absent   > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{summary.absent} absent</span>}
            {summary.late     > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{summary.late} late</span>}
            {summary.auth     > 0 && <span className="text-gray-600 dark:text-gray-400 font-medium">{summary.auth} auth. leave</span>}
            {summary.unmarked > 0 && <span className="text-gray-400">{summary.unmarked} unmarked</span>}
          </p>
        )}

        {/* Bulk actions */}
        {!loading && marks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-medium">Mark all as:</span>
            <button onClick={() => markAll('present')} className="px-3 py-1 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600 transition-colors">Present</button>
            <button onClick={() => markAll('absent')}  className="px-3 py-1 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-red-400 hover:text-red-600 transition-colors">Absent</button>
            <button onClick={() => markAll(null)}      className="px-3 py-1 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-500 dark:text-gray-500 hover:border-gray-300 transition-colors">Clear all</button>
          </div>
        )}

        {/* Register list */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : marks.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={36} className="mx-auto mb-3 opacity-25" />
              <p className="font-medium text-gray-500">No people found for this group</p>
              <p className="text-sm mt-1">Add people in People Management first</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {marks.map(({ person, status, signedInAt }) => (
                <div key={person.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                      {person.first_name[0]}{person.last_name[0]}
                    </div>
                    {status === 'present' && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-brand-500 border-2 border-white dark:border-[#162218]" />
                    )}
                    {status === 'absent' && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[#162218]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{person.full_name}</p>
                    <p className="text-xs text-gray-400">
                      {person.year_group ?? person.department ?? '—'}
                      {person.form_group ? ` · ${person.form_group}` : ''}
                      {signedInAt && status === 'present' ? ` · Kiosk in at ${format(new Date(signedInAt), 'HH:mm')}` : ''}
                    </p>
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setMark(person.id, status === opt.value ? null : opt.value)}
                        title={opt.label}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          status === opt.value
                            ? opt.active
                            : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                        }`}
                      >
                        {opt.icon}
                        <span className="hidden sm:inline">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {dirty && (
          <div className="fixed bottom-6 right-6 z-40">
            <button onClick={saveRegister} disabled={saving} className="btn-primary shadow-lg px-5 py-3">
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving…' : 'Save Register'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }
