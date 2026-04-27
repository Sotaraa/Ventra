import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import TopBar from '@/components/layout/TopBar'
import { FileText, Download, Calendar, Loader2, Shield, Flame, UserX } from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek, differenceInMinutes } from 'date-fns'
import toast from 'react-hot-toast'

// ── helpers ──────────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

// ── main component ────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { site } = useSite()
  const today      = isoDate(new Date())
  const weekStart  = isoDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const weekEnd    = isoDate(endOfWeek(new Date(),   { weekStartsOn: 1 }))

  // Shared date range state per report
  const [visitorFrom,    setVisitorFrom]    = useState(today)
  const [visitorTo,      setVisitorTo]      = useState(today)
  const [attendanceFrom, setAttendanceFrom] = useState(weekStart)
  const [attendanceTo,   setAttendanceTo]   = useState(weekEnd)
  const [absenceFrom,    setAbsenceFrom]    = useState(weekStart)
  const [absenceTo,      setAbsenceTo]      = useState(weekEnd)
  const [evacFrom,       setEvacFrom]       = useState(isoDate(subDays(new Date(), 90)))
  const [evacTo,         setEvacTo]         = useState(today)
  const [loadingId,      setLoadingId]      = useState<string | null>(null)

  // ── Visitor Log CSV ─────────────────────────────────────────────────────────
  async function exportVisitorLog() {
    if (!site) return
    setLoadingId('visitor_log')
    try {
      const { data, error } = await supabase
        .from('visit_logs')
        .select('*, visitor:visitors(first_name, last_name, full_name, email, company, visitor_type, phone)')
        .eq('site_id', site.id)
        .gte('checked_in_at', `${visitorFrom}T00:00:00`)
        .lte('checked_in_at', `${visitorTo}T23:59:59`)
        .order('checked_in_at', { ascending: false })

      if (error) throw error
      if (!data?.length) { toast('No visitors in that date range', { icon: '📋' }); return }

      const header = ['Date', 'Time In', 'Time Out', 'Visitor Name', 'Company', 'Type', 'Host', 'Purpose', 'Status']
      const rows = data.map((l: any) => [
        l.checked_in_at  ? format(new Date(l.checked_in_at),  'dd/MM/yyyy') : '',
        l.checked_in_at  ? format(new Date(l.checked_in_at),  'HH:mm')     : '',
        l.checked_out_at ? format(new Date(l.checked_out_at), 'HH:mm')     : '',
        l.visitor?.full_name ?? '',
        l.visitor?.company   ?? '',
        l.visitor?.visitor_type ?? '',
        l.host_name  ?? '',
        l.purpose    ?? '',
        l.status,
      ])

      downloadCSV(`ventra-visitor-log-${visitorFrom}-to-${visitorTo}.csv`, [header, ...rows])
      toast.success(`Exported ${data.length} visitor records`)
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Attendance Report CSV ───────────────────────────────────────────────────
  async function exportAttendance() {
    if (!site) return
    setLoadingId('weekly_attendance')
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*, person:persons(first_name, last_name, full_name, group, year_group, department, email, employee_number, student_id)')
        .eq('site_id', site.id)
        .gte('date', attendanceFrom)
        .lte('date', attendanceTo)
        .order('date', { ascending: true })

      if (error) throw error
      if (!data?.length) { toast('No attendance records in that date range', { icon: '📋' }); return }

      const header = ['Date', 'Name', 'Group', 'Department / Year', 'Status', 'Time In', 'Time Out', 'Reason', 'Employee No.', 'Student ID']
      const rows = data.map((r: any) => [
        r.date,
        r.person?.full_name ?? '',
        r.person?.group?.replace(/_/g, ' ') ?? '',
        r.person?.department ?? r.person?.year_group ?? '',
        r.status,
        r.signed_in_at  ? format(new Date(r.signed_in_at),  'HH:mm') : '',
        r.signed_out_at ? format(new Date(r.signed_out_at), 'HH:mm') : '',
        r.sign_out_reason ?? '',
        r.person?.employee_number ?? '',
        r.person?.student_id      ?? '',
      ])

      downloadCSV(`ventra-attendance-${attendanceFrom}-to-${attendanceTo}.csv`, [header, ...rows])
      toast.success(`Exported ${data.length} attendance records`)
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed')
    } finally {
      setLoadingId(null)
    }
  }

  // ── People CSV ──────────────────────────────────────────────────────────────
  async function exportPeople() {
    if (!site) return
    setLoadingId('people')
    try {
      const { data, error } = await supabase
        .from('persons')
        .select('*')
        .eq('site_id', site.id)
        .order('last_name')

      if (error) throw error
      if (!data?.length) { toast('No people records found', { icon: '📋' }); return }

      const header = ['First Name', 'Last Name', 'Email', 'Group', 'Department', 'Year Group', 'Form Group', 'Employee No.', 'Student ID', 'Status', 'Source']
      const rows = data.map((p: any) => [
        p.first_name, p.last_name, p.email ?? '',
        p.group?.replace(/_/g, ' ') ?? '',
        p.department ?? '', p.year_group ?? '', p.form_group ?? '',
        p.employee_number ?? '', p.student_id ?? '',
        p.is_active ? 'Active' : 'Archived',
        p.azure_oid ? 'Azure AD' : 'Manual',
      ])

      downloadCSV(`ventra-people-${isoDate(new Date())}.csv`, [header, ...rows])
      toast.success(`Exported ${data.length} people`)
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Absence Summary CSV ─────────────────────────────────────────────────────
  async function exportAbsenceSummary() {
    if (!site) return
    setLoadingId('absence')
    try {
      const { data, error } = await supabase
        .from('absence_records')
        .select('*, person:persons(full_name, group, year_group, department, student_id, employee_number)')
        .eq('site_id', site.id)
        .gte('start_date', absenceFrom)
        .lte('start_date', absenceTo)
        .order('start_date', { ascending: false })

      if (error) throw error
      if (!data?.length) { toast('No absence records in that date range', { icon: '📋' }); return }

      const header = [
        'From', 'To', 'Days', 'Name', 'Group', 'Year / Dept',
        'Student ID', 'Employee No.', 'Absence Type', 'Reason',
        'Parent Notified', 'Approved',
      ]
      const rows = data.map((a: any) => {
        const start = new Date(a.start_date)
        const end   = new Date(a.end_date ?? a.start_date)
        const days  = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
        return [
          a.start_date,
          a.end_date ?? a.start_date,
          days,
          a.person?.full_name ?? '',
          a.person?.group?.replace(/_/g, ' ') ?? '',
          a.person?.department ?? a.person?.year_group ?? '',
          a.person?.student_id      ?? '',
          a.person?.employee_number ?? '',
          a.absence_type?.replace(/_/g, ' ') ?? '',
          a.reason ?? '',
          a.parent_notified ? 'Yes' : 'No',
          a.approved_at ? format(new Date(a.approved_at), 'dd/MM/yyyy') : 'Pending',
        ]
      })

      downloadCSV(`ventra-absences-${absenceFrom}-to-${absenceTo}.csv`, [header, ...rows])
      toast.success(`Exported ${data.length} absence records`)
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Safeguarding / SCR CSV ──────────────────────────────────────────────────
  async function exportSafeguarding() {
    if (!site) return
    setLoadingId('safeguarding')
    try {
      const [dbsRes, watchlistRes] = await Promise.all([
        supabase
          .from('dbs_records')
          .select('*, person:persons(full_name, group, department, employee_number)')
          .eq('site_id', site.id)
          .order('expiry_date', { ascending: true }),
        supabase
          .from('watchlist')
          .select('*')
          .eq('site_id', site.id)
          .eq('is_active', true)
          .order('severity', { ascending: false }),
      ])

      if (dbsRes.error) throw dbsRes.error
      if (watchlistRes.error) throw watchlistRes.error

      const today_d = new Date()

      // Section 1 — DBS Register
      const dbsHeader = [
        'SECTION: DBS REGISTER', '', '', '', '', '', '',
      ]
      const dbsColHeader = [
        'Name', 'Group', 'Department', 'Employee No.',
        'DBS Number', 'Issue Date', 'Expiry Date', 'Status', 'Days Until Expiry',
      ]
      const dbsRows = (dbsRes.data ?? []).map((d: any) => {
        const expiry      = d.expiry_date ? new Date(d.expiry_date) : null
        const daysLeft    = expiry ? Math.round((expiry.getTime() - today_d.getTime()) / 86_400_000) : ''
        return [
          d.person?.full_name ?? '',
          d.person?.group?.replace(/_/g, ' ') ?? '',
          d.person?.department ?? '',
          d.person?.employee_number ?? '',
          d.dbs_number ?? '',
          d.issue_date  ? format(new Date(d.issue_date),  'dd/MM/yyyy') : '',
          d.expiry_date ? format(new Date(d.expiry_date), 'dd/MM/yyyy') : '',
          d.status ?? '',
          daysLeft,
        ]
      })

      // Section 2 — Watchlist
      const watchHeader = ['SECTION: WATCHLIST', '', '', '', '']
      const watchColHeader = ['Name', 'Aliases', 'Severity', 'Reason', 'Date Added']
      const watchRows = (watchlistRes.data ?? []).map((w: any) => [
        w.full_name,
        (w.aliases ?? []).join(', '),
        w.severity,
        w.reason ?? '',
        w.created_at ? format(new Date(w.created_at), 'dd/MM/yyyy') : '',
      ])

      const generated = [`Generated: ${format(today_d, 'dd/MM/yyyy HH:mm')}`, `Site: ${site.name}`]

      downloadCSV(
        `ventra-safeguarding-SCR-${isoDate(today_d)}.csv`,
        [
          generated,
          [],
          dbsHeader,
          dbsColHeader,
          ...dbsRows,
          [],
          watchHeader,
          watchColHeader,
          ...watchRows,
        ],
      )
      toast.success(`SCR exported — ${dbsRes.data?.length ?? 0} DBS records, ${watchlistRes.data?.length ?? 0} watchlist entries`)
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Evacuation Report CSV ───────────────────────────────────────────────────
  async function exportEvacuation() {
    if (!site) return
    setLoadingId('evacuation')
    try {
      const { data: events, error } = await supabase
        .from('evacuation_events')
        .select('*, roll_calls:evacuation_roll_calls(*)')
        .eq('site_id', site.id)
        .gte('triggered_at', `${evacFrom}T00:00:00`)
        .lte('triggered_at', `${evacTo}T23:59:59`)
        .order('triggered_at', { ascending: false })

      if (error) throw error
      if (!events?.length) { toast('No evacuation events in that date range', { icon: '📋' }); return }

      const rows: string[][] = []

      for (const ev of events) {
        const triggered  = new Date(ev.triggered_at)
        const resolved   = ev.resolved_at ? new Date(ev.resolved_at) : null
        const durationMins = resolved ? differenceInMinutes(resolved, triggered) : ''
        const missing    = ev.total_on_site != null && ev.total_accounted != null
          ? ev.total_on_site - ev.total_accounted : ''

        // Event summary row
        rows.push([
          `EVENT: ${format(triggered, 'dd/MM/yyyy HH:mm')}`,
          `Resolved: ${resolved ? format(resolved, 'HH:mm') : 'Ongoing'}`,
          `Duration: ${durationMins ? `${durationMins} min` : '—'}`,
          `On site: ${ev.total_on_site ?? '—'}`,
          `Accounted: ${ev.total_accounted ?? '—'}`,
          `Missing: ${missing !== '' ? missing : '—'}`,
          `Muster: ${ev.muster_point ?? '—'}`,
          ev.notes ?? '',
        ])

        // Roll call sub-rows
        if (ev.roll_calls?.length) {
          rows.push(['', 'Name', 'Group', 'Accounted', 'Time Accounted'])
          for (const rc of ev.roll_calls as any[]) {
            rows.push([
              '',
              rc.name ?? '',
              rc.group ?? '',
              rc.accounted ? 'Yes' : 'No',
              rc.accounted_at ? format(new Date(rc.accounted_at), 'HH:mm') : '',
            ])
          }
        }
        rows.push([]) // blank separator between events
      }

      const header = ['Event', 'Resolved', 'Duration', 'On Site', 'Accounted', 'Missing', 'Muster Point', 'Notes']
      downloadCSV(`ventra-evacuation-${evacFrom}-to-${evacTo}.csv`, [header, ...rows])
      toast.success(`Exported ${events.length} evacuation event${events.length !== 1 ? 's' : ''}`)
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Quick date presets ──────────────────────────────────────────────────────
  function setLastNDays(n: number, setFrom: (v: string) => void, setTo: (v: string) => void) {
    setFrom(isoDate(subDays(new Date(), n - 1)))
    setTo(today)
  }

  const reportBusy = (id: string) => loadingId === id

  return (
    <div>
      <TopBar title="Reports" subtitle="Generate and export reports" />

      <div className="p-6 space-y-6">

        {/* ── Visitor Log ── */}
        <div className="card p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Visitor Log</p>
              <p className="text-sm text-gray-500">All visitor activity for a date range</p>
            </div>
            <span className="badge-gray text-xs ml-auto">CSV</span>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label text-xs">From</label>
              <input type="date" className="input py-1.5 text-sm" value={visitorFrom} onChange={e => setVisitorFrom(e.target.value)} max={today} />
            </div>
            <div>
              <label className="label text-xs">To</label>
              <input type="date" className="input py-1.5 text-sm" value={visitorTo}   onChange={e => setVisitorTo(e.target.value)}   max={today} />
            </div>
            <div className="flex gap-1.5">
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => { setVisitorFrom(today); setVisitorTo(today) }}>Today</button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setLastNDays(7, setVisitorFrom, setVisitorTo)}>Last 7d</button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setLastNDays(30, setVisitorFrom, setVisitorTo)}>Last 30d</button>
            </div>
            <button
              onClick={exportVisitorLog}
              disabled={reportBusy('visitor_log')}
              className="btn-primary py-1.5 text-sm ml-auto"
            >
              {reportBusy('visitor_log') ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export CSV
            </button>
          </div>
        </div>

        {/* ── Attendance Report ── */}
        <div className="card p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
              <FileText size={20} className="text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Attendance Report</p>
              <p className="text-sm text-gray-500">Staff and student attendance records for a date range</p>
            </div>
            <span className="badge-gray text-xs ml-auto">CSV</span>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label text-xs">From</label>
              <input type="date" className="input py-1.5 text-sm" value={attendanceFrom} onChange={e => setAttendanceFrom(e.target.value)} max={today} />
            </div>
            <div>
              <label className="label text-xs">To</label>
              <input type="date" className="input py-1.5 text-sm" value={attendanceTo}   onChange={e => setAttendanceTo(e.target.value)}   max={today} />
            </div>
            <div className="flex gap-1.5">
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => { setAttendanceFrom(today); setAttendanceTo(today) }}>Today</button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => { setAttendanceFrom(weekStart); setAttendanceTo(weekEnd) }}>This week</button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setLastNDays(30, setAttendanceFrom, setAttendanceTo)}>Last 30d</button>
            </div>
            <button
              onClick={exportAttendance}
              disabled={reportBusy('weekly_attendance')}
              className="btn-primary py-1.5 text-sm ml-auto"
            >
              {reportBusy('weekly_attendance') ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export CSV
            </button>
          </div>
        </div>

        {/* ── People Export ── */}
        <div className="card p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-2 bg-brand-50 rounded-lg flex-shrink-0">
              <FileText size={20} className="text-brand-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">People Export</p>
              <p className="text-sm text-gray-500">All staff and student records — name, email, group, department, year group</p>
            </div>
            <span className="badge-gray text-xs">CSV</span>
          </div>
          <div className="flex justify-end">
            <button
              onClick={exportPeople}
              disabled={reportBusy('people')}
              className="btn-primary py-1.5 text-sm"
            >
              {reportBusy('people') ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export All People
            </button>
          </div>
        </div>

        {/* ── Absence Summary ── */}
        <div className="card p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-2 bg-amber-50 rounded-lg flex-shrink-0">
              <UserX size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Absence Summary</p>
              <p className="text-sm text-gray-500">Authorised, unauthorised and holiday absences for a date range</p>
            </div>
            <span className="badge-gray text-xs ml-auto">CSV</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label text-xs">From</label>
              <input type="date" className="input py-1.5 text-sm" value={absenceFrom} onChange={e => setAbsenceFrom(e.target.value)} max={today} />
            </div>
            <div>
              <label className="label text-xs">To</label>
              <input type="date" className="input py-1.5 text-sm" value={absenceTo} onChange={e => setAbsenceTo(e.target.value)} max={today} />
            </div>
            <div className="flex gap-1.5">
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => { setAbsenceFrom(weekStart); setAbsenceTo(weekEnd) }}>This week</button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setLastNDays(30, setAbsenceFrom, setAbsenceTo)}>Last 30d</button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setLastNDays(90, setAbsenceFrom, setAbsenceTo)}>Last 90d</button>
            </div>
            <button
              onClick={exportAbsenceSummary}
              disabled={reportBusy('absence')}
              className="btn-primary py-1.5 text-sm ml-auto"
            >
              {reportBusy('absence') ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export CSV
            </button>
          </div>
        </div>

        {/* ── Safeguarding / SCR ── */}
        <div className="card p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-2 bg-red-50 rounded-lg flex-shrink-0">
              <Shield size={20} className="text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Safeguarding Report (SCR)</p>
              <p className="text-sm text-gray-500">Single Central Register — DBS records and active watchlist in one export</p>
            </div>
            <span className="badge-gray text-xs ml-auto">CSV</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Exports current DBS register + active watchlist entries as of today.
            </p>
            <button
              onClick={exportSafeguarding}
              disabled={reportBusy('safeguarding')}
              className="btn-primary py-1.5 text-sm"
            >
              {reportBusy('safeguarding') ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export SCR
            </button>
          </div>
        </div>

        {/* ── Evacuation Report ── */}
        <div className="card p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-2 bg-orange-50 rounded-lg flex-shrink-0">
              <Flame size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Evacuation Report</p>
              <p className="text-sm text-gray-500">Emergency events with roll call results and accountability details</p>
            </div>
            <span className="badge-gray text-xs ml-auto">CSV</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label text-xs">From</label>
              <input type="date" className="input py-1.5 text-sm" value={evacFrom} onChange={e => setEvacFrom(e.target.value)} max={today} />
            </div>
            <div>
              <label className="label text-xs">To</label>
              <input type="date" className="input py-1.5 text-sm" value={evacTo} onChange={e => setEvacTo(e.target.value)} max={today} />
            </div>
            <div className="flex gap-1.5">
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setLastNDays(90,  setEvacFrom, setEvacTo)}>Last 90d</button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setLastNDays(365, setEvacFrom, setEvacTo)}>Last year</button>
            </div>
            <button
              onClick={exportEvacuation}
              disabled={reportBusy('evacuation')}
              className="btn-primary py-1.5 text-sm ml-auto"
            >
              {reportBusy('evacuation') ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export CSV
            </button>
          </div>
        </div>

        {/* Scheduled reports placeholder */}
        <div className="card p-6">
          <p className="font-semibold text-gray-900 mb-1">Scheduled Reports</p>
          <p className="text-sm text-gray-500 mb-4">
            Automatic report delivery via email — configure in Settings &rarr; Notifications.
          </p>
          <div className="text-center py-8 text-gray-400">
            <Calendar size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No scheduled reports configured yet</p>
          </div>
        </div>
      </div>
    </div>
  )
}
