import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/layout/TopBar'
import { Users, UserCheck, UserX, AlertTriangle, Zap, ShieldAlert, FileText, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import type { OccupancyCount } from '@/types'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [occupancy, setOccupancy] = useState<OccupancyCount>({
    students: 0, teaching_staff: 0, non_teaching_staff: 0, contractors: 0, visitors: 0, total: 0,
  })
  const [absentCount, setAbsentCount] = useState(0)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    const { count: visitorCount } = await supabase
      .from('visit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'checked_in')
      .gte('checked_in_at', `${today}T00:00:00`)

    const { data: attendance } = await supabase
      .from('attendance_records')
      .select('person:persons(group)')
      .eq('date', today)
      .eq('status', 'present')
      .is('signed_out_at', null)

    const counts = { student: 0, teaching_staff: 0, non_teaching_staff: 0, contractor: 0, governor: 0 }
    attendance?.forEach((r: any) => {
      const g = r.person?.group as keyof typeof counts
      if (g && g in counts) counts[g]++
    })

    const visitors = visitorCount ?? 0
    const personTotal = Object.values(counts).reduce((a, b) => a + b, 0)
    setOccupancy({
      students: counts.student,
      teaching_staff: counts.teaching_staff,
      non_teaching_staff: counts.non_teaching_staff,
      contractors: counts.contractor + counts.governor,
      visitors,
      total: personTotal + visitors,
    })

    const { count: absent } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .eq('date', today)
      .in('status', ['absent', 'unauthorised_absence'])

    setAbsentCount(absent ?? 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <TopBar
        title="Admin Dashboard"
        subtitle={format(new Date(), "EEEE d MMMM yyyy")}
        actions={
          <button onClick={load} className="btn-secondary py-2 text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      <div className="p-6 space-y-6">

        {/* Occupancy — single clean card */}
        <div>
          <p className="section-title">Current Occupancy</p>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-3 lg:grid-cols-6 divide-x divide-gray-100 dark:divide-white/[0.06]">
              <OccupancyItem label="Total On Site" value={occupancy.total} primary />
              <OccupancyItem label="Students"      value={occupancy.students} />
              <OccupancyItem label="Teaching"      value={occupancy.teaching_staff} />
              <OccupancyItem label="Non-Teaching"  value={occupancy.non_teaching_staff} />
              <OccupancyItem label="Contractors"   value={occupancy.contractors} />
              <OccupancyItem label="Visitors"      value={occupancy.visitors} />
            </div>
          </div>
        </div>

        {/* Today's summary */}
        <div>
          <p className="section-title">Today's Summary</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<UserX size={18} />}
              label="Absent Today"
              value={absentCount}
              alert={absentCount > 0}
            />
            <MetricCard icon={<AlertTriangle size={18} />} label="Active Alerts"  value={0} />
            <MetricCard icon={<ShieldAlert size={18} />}   label="DBS Expiring"   value={0} />
            <MetricCard icon={<FileText size={18} />}      label="Reports Due"    value={1} />
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <p className="section-title">Quick Actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction icon={<Zap size={20} />}       label="Emergency Evacuation" danger onClick={() => navigate('/admin/evacuation')} />
            <QuickAction icon={<Users size={20} />}     label="Manual Sign-In"       onClick={() => navigate('/reception/visitors')} />
            <QuickAction icon={<UserCheck size={20} />} label="Mark Attendance"      onClick={() => navigate('/attendance/register')} />
            <QuickAction icon={<FileText size={20} />}  label="Generate Report"      onClick={() => navigate('/admin/reports')} />
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OccupancyItem({ label, value, primary }: { label: string; value: number; primary?: boolean }) {
  return (
    <div className={`px-5 py-5 ${primary ? 'bg-brand-950 dark:bg-brand-900' : ''}`}>
      <p className={`text-xs font-medium mb-1.5 ${primary ? 'text-brand-400' : 'text-gray-400 dark:text-gray-500'}`}>
        {label}
      </p>
      <p className={`font-bold tabular-nums tracking-tight ${
        primary ? 'text-4xl text-white' : 'text-2xl text-gray-900 dark:text-white'
      }`}>
        {value}
      </p>
    </div>
  )
}

function MetricCard({ icon, label, value, alert }: {
  icon: React.ReactNode
  label: string
  value: number
  alert?: boolean
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
        <span className={`${alert && value > 0 ? 'text-red-400' : 'text-gray-300 dark:text-gray-600'}`}>
          {icon}
        </span>
      </div>
      <p className={`text-3xl font-bold tabular-nums ${
        alert && value > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
      }`}>
        {value}
      </p>
    </div>
  )
}

function QuickAction({ icon, label, onClick, danger }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`card p-5 flex flex-col items-center gap-3 text-center hover:shadow-card-md transition-all min-h-touch
        ${danger
          ? 'hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 dark:hover:border-red-900'
          : 'hover:border-gray-200 dark:hover:border-white/10'
        }`}
    >
      <span className={danger ? 'text-red-500' : 'text-gray-400'}>
        {icon}
      </span>
      <p className={`text-sm font-semibold leading-tight ${
        danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
      }`}>
        {label}
      </p>
    </button>
  )
}
