import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/layout/TopBar'
import { UserCheck, UserX, Clock, AlertTriangle, RefreshCw, LogOut } from 'lucide-react'
import { format } from 'date-fns'
import type { Person, PersonGroup, AttendanceRecord } from '@/types'
import toast from 'react-hot-toast'

interface NotInBuilding { person: Person }

const GROUP_TABS: { label: string; value: PersonGroup | 'all' }[] = [
  { label: 'All',          value: 'all' },
  { label: 'Students',     value: 'student' },
  { label: 'Teaching',     value: 'teaching_staff' },
  { label: 'Non-Teaching', value: 'non_teaching_staff' },
]

export default function AttendanceDashboard() {
  const [presentList, setPresentList] = useState<AttendanceRecord[]>([])
  const [absentList,  setAbsentList]  = useState<NotInBuilding[]>([])
  const [loading,     setLoading]     = useState(true)
  const [groupFilter, setGroupFilter] = useState<PersonGroup | 'all'>('all')

  const today = new Date().toISOString().slice(0, 10)

  async function load() {
    setLoading(true)

    const { data: presentData, error: presentErr } = await supabase
      .from('attendance_records')
      .select('*, person:persons(id, first_name, last_name, full_name, group, year_group, department, email)')
      .eq('date', today)
      .eq('status', 'present')
      .is('signed_out_at', null)
      .order('signed_in_at', { ascending: true })

    if (presentErr) {
      toast.error('Failed to load attendance')
      setLoading(false)
      return
    }

    const allPresent = (presentData ?? []) as AttendanceRecord[]
    const filtered = groupFilter === 'all'
      ? allPresent
      : allPresent.filter(r => r.person?.group === groupFilter)

    setPresentList(filtered)

    let personsQ = supabase
      .from('persons')
      .select('*')
      .eq('is_active', true)
      .not('group', 'eq', 'contractor')
      .not('group', 'eq', 'governor')
      .order('last_name')

    if (groupFilter !== 'all') personsQ = personsQ.eq('group', groupFilter)

    const { data: allPersons } = await personsQ
    const presentPersonIds = new Set(filtered.map(r => (r.person as any)?.id).filter(Boolean))
    const notIn = (allPersons ?? []).filter(p => !presentPersonIds.has(p.id))
    setAbsentList(notIn.map(p => ({ person: p as Person })))
    setLoading(false)
  }

  useEffect(() => { load() }, [groupFilter])

  async function signOut(record: AttendanceRecord) {
    const { error } = await supabase
      .from('attendance_records')
      .update({ status: 'present', signed_out_at: new Date().toISOString(), sign_out_reason: 'end_of_day' })
      .eq('id', record.id)
    if (error) { toast.error('Failed to sign out'); return }
    toast.success(`${record.person?.first_name} signed out`)
    load()
  }

  return (
    <div>
      <TopBar
        title="Attendance"
        subtitle={format(new Date(), 'EEEE d MMMM yyyy')}
        actions={
          <button onClick={load} className="btn-secondary py-2 text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      <div className="p-6 space-y-6">

        {/* Stats — clean row, no colored borders */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: <UserCheck size={16} />, label: 'Present',      value: presentList.length, color: presentList.length > 0 ? 'text-brand-600 dark:text-brand-400' : '' },
            { icon: <UserX size={16} />,     label: 'Not In',       value: absentList.length,  color: absentList.length  > 0 ? 'text-red-600 dark:text-red-400'   : '' },
            { icon: <Clock size={16} />,     label: 'Late',         value: 0,                  color: '' },
            { icon: <AlertTriangle size={16}/>,label:'Unauthorised', value: 0,                  color: '' },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-gray-300 dark:text-gray-600">{icon}</span>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
              </div>
              <p className={`text-3xl font-bold tabular-nums ${color || 'text-gray-900 dark:text-white'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Group filter tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 w-fit">
          {GROUP_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setGroupFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                groupFilter === tab.value
                  ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Currently Present */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-white/[0.07] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Currently In The Building</h2>
              <p className="text-sm text-gray-400">Signed in and on site right now</p>
            </div>
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
              {presentList.length} present
            </span>
          </div>

          {loading ? <LoadingSpinner /> : presentList.length === 0 ? (
            <EmptyState icon={<UserCheck size={32} />} text="No one signed in yet today" />
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {presentList.map(record => {
                const person = record.person as Person | undefined
                if (!person) return null
                const timeIn = record.signed_in_at ? format(new Date(record.signed_in_at), 'HH:mm') : '—'
                return (
                  <div key={record.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {person.first_name[0]}{person.last_name[0]}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-brand-500 border-2 border-white dark:border-[#162218]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{person.full_name}</p>
                      <p className="text-xs text-gray-400">
                        {person.department ?? person.year_group ?? person.group?.replace(/_/g, ' ') ?? '—'}
                        {record.signed_in_at && ` · In at ${timeIn}`}
                      </p>
                    </div>
                    <button
                      onClick={() => signOut(record)}
                      className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                    >
                      <LogOut size={12} /> Out
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Not In Building */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-white/[0.07] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Not In The Building</h2>
              <p className="text-sm text-gray-400">Expected but not yet signed in</p>
            </div>
            {absentList.length > 0 && (
              <span className="text-sm font-semibold text-red-500 tabular-nums">
                {absentList.length} absent
              </span>
            )}
          </div>

          {loading ? <LoadingSpinner /> : absentList.length === 0 ? (
            <EmptyState icon={<UserCheck size={32} />} text="Everyone is accounted for" />
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {absentList.slice(0, 100).map(({ person }) => (
                <div key={person.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {person.first_name[0]}{person.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{person.full_name}</p>
                    <p className="text-xs text-gray-400">
                      {person.group?.replace(/_/g, ' ')}
                      {person.year_group ? ` · ${person.year_group}` : ''}
                      {person.department ? ` · ${person.department}` : ''}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-red-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    Not in
                  </span>
                </div>
              ))}
              {absentList.length > 100 && (
                <p className="text-center text-xs text-gray-400 py-3">
                  +{absentList.length - 100} more — use group filter to narrow down
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-12 text-gray-300">
      <div className="mx-auto mb-3 w-fit opacity-40">{icon}</div>
      <p className="text-sm font-medium text-gray-400">{text}</p>
    </div>
  )
}
