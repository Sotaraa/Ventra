import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/layout/TopBar'
import { Users, UserCheck, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import type { VisitLog } from '@/types'
import { format } from 'date-fns'

export default function ReceptionDashboard() {
  const [activeVisitors,    setActiveVisitors]    = useState<VisitLog[]>([])
  const [checkedInToday,    setCheckedInToday]    = useState(0)
  const [loading,           setLoading]           = useState(true)

  const today = new Date().toISOString().slice(0, 10)

  async function load() {
    setLoading(true)

    // Currently on site (checked_in status)
    const { data } = await supabase
      .from('visit_logs')
      .select('*, visitor:visitors(*)')
      .eq('status', 'checked_in')
      .gte('checked_in_at', `${today}T00:00:00`)
      .order('checked_in_at', { ascending: false })

    setActiveVisitors((data as VisitLog[]) ?? [])

    // Total checked in today regardless of current status
    const { count } = await supabase
      .from('visit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('checked_in_at', `${today}T00:00:00`)

    setCheckedInToday(count ?? 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('visit_logs_reception')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visit_logs' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div>
      <TopBar
        title="Reception"
        subtitle={format(new Date(), 'EEEE d MMMM yyyy')}
        actions={
          <button onClick={load} className="btn-secondary py-2 text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="On Site Now"       value={activeVisitors.length} icon={<Users size={20} />}         color="blue" />
          <StatCard label="Checked In Today"  value={checkedInToday}        icon={<UserCheck size={20} />}     color="green" />
          <StatCard label="Awaiting"          value={0}                     icon={<Clock size={20} />}         color="amber" />
          <StatCard label="Alerts"            value={0}                     icon={<AlertTriangle size={20} />} color="red" />
        </div>

        {/* Live visitor list */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Currently on Site</h2>
              <p className="text-sm text-gray-500">Visitors who have not yet signed out</p>
            </div>
            <span className="badge-green">{activeVisitors.length} active</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeVisitors.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">No visitors currently on site</p>
              <p className="text-sm mt-1">
                {checkedInToday > 0
                  ? `${checkedInToday} visitor${checkedInToday !== 1 ? 's' : ''} visited today (all signed out)`
                  : 'No visitors today yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activeVisitors.map(log => (
                <VisitorRow key={log.id} log={log} onCheckout={load} />
              ))}
            </div>
          )}
        </div>

        {/* Today's sign-out history */}
        {checkedInToday > activeVisitors.length && (
          <TodayHistory today={today} />
        )}
      </div>
    </div>
  )
}

function TodayHistory({ today }: { today: string }) {
  const [logs, setLogs] = useState<VisitLog[]>([])

  useEffect(() => {
    supabase
      .from('visit_logs')
      .select('*, visitor:visitors(*)')
      .eq('status', 'checked_out')
      .gte('checked_in_at', `${today}T00:00:00`)
      .order('checked_out_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setLogs((data as VisitLog[]) ?? []))
  }, [today])

  if (logs.length === 0) return null

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Signed Out Today</h2>
        <p className="text-sm text-gray-500">Visitors who have left the site today</p>
      </div>
      <div className="divide-y divide-gray-50">
        {logs.map(log => {
          const inTime  = log.checked_in_at  ? format(new Date(log.checked_in_at),  'HH:mm') : '—'
          const outTime = log.checked_out_at ? format(new Date(log.checked_out_at), 'HH:mm') : '—'
          return (
            <div key={log.id} className="flex items-center gap-4 px-6 py-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                {log.visitor?.first_name?.charAt(0)}{log.visitor?.last_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-700">{log.visitor?.full_name}</p>
                <p className="text-xs text-gray-400">
                  {log.visitor?.company && `${log.visitor.company} · `}
                  In {inTime} · Out {outTime}
                </p>
              </div>
              <span className="badge-gray text-xs">Signed out</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: 'blue' | 'green' | 'amber' | 'red' }) {
  const colors = {
    blue:  'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red:   'bg-red-50 text-red-600',
  }
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function VisitorRow({ log, onCheckout }: { log: VisitLog; onCheckout: () => void }) {
  const [loading, setLoading] = useState(false)

  async function checkout() {
    setLoading(true)
    await supabase
      .from('visit_logs')
      .update({ status: 'checked_out', checked_out_at: new Date().toISOString() })
      .eq('id', log.id)
    onCheckout()
    setLoading(false)
  }

  const checkedInTime = log.checked_in_at
    ? format(new Date(log.checked_in_at), 'HH:mm')
    : '—'

  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold flex-shrink-0">
        {log.visitor?.first_name?.charAt(0)}{log.visitor?.last_name?.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{log.visitor?.full_name}</p>
        <p className="text-sm text-gray-500 truncate">
          {log.visitor?.company && `${log.visitor.company} · `}
          {log.host_name && `Visiting ${log.host_name} · `}
          In at {checkedInTime}
        </p>
      </div>
      <span className={`hidden sm:inline-flex ${log.visitor?.visitor_type === 'contractor' ? 'badge-amber' : 'badge-blue'}`}>
        {log.visitor?.visitor_type}
      </span>
      <button
        onClick={checkout}
        disabled={loading}
        className="btn-secondary py-1.5 px-3 text-sm"
      >
        {loading
          ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          : 'Sign out'}
      </button>
    </div>
  )
}
