import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import TopBar from '@/components/layout/TopBar'
import { format, subDays, startOfDay, endOfDay, isToday, isYesterday } from 'date-fns'
import {
  LogIn, LogOut, UserPlus, UserCheck,
  Calendar, ClipboardList, RefreshCw, ChevronDown,
  Eye, AlertTriangle, CheckCircle, Users,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EventKind =
  | 'sign_in'
  | 'sign_out'
  | 'visitor_in'
  | 'visitor_out'
  | 'absence_added'
  | 'absence_authorised'
  | 'person_added'

type FilterKind = 'all' | 'attendance' | 'visitors' | 'absences' | 'people'

interface AuditEvent {
  id: string
  kind: EventKind
  ts: string           // ISO timestamp for sorting
  label: string        // e.g. "John Smith signed in"
  meta: string         // e.g. "Year 9 · 09:14" or "Contractor · Visiting HR"
  group?: string       // person group badge
  source?: string      // 'kiosk' | 'manual' | 'register'
}

// ─── Config ───────────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<EventKind, {
  icon: React.ReactNode
  bg: string
  text: string
  label: string
}> = {
  sign_in:            { icon: <LogIn size={14} />,      bg: 'bg-green-100',  text: 'text-green-600',  label: 'Sign In' },
  sign_out:           { icon: <LogOut size={14} />,     bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Sign Out' },
  visitor_in:         { icon: <Eye size={14} />,        bg: 'bg-brand-100',  text: 'text-brand-600',  label: 'Visitor In' },
  visitor_out:        { icon: <LogOut size={14} />,     bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Visitor Out' },
  absence_added:      { icon: <AlertTriangle size={14}/>,bg: 'bg-amber-100', text: 'text-amber-600',  label: 'Absence' },
  absence_authorised: { icon: <CheckCircle size={14} />,bg: 'bg-blue-100',  text: 'text-blue-600',   label: 'Auth. Leave' },
  person_added:       { icon: <UserPlus size={14} />,   bg: 'bg-purple-100', text: 'text-purple-600', label: 'Person Added' },
}

const GROUP_BADGE: Record<string, { text: string; dot: string }> = {
  student:           { text: 'text-green-700',  dot: 'bg-green-500' },
  teaching_staff:    { text: 'text-blue-700',   dot: 'bg-blue-500' },
  non_teaching_staff:{ text: 'text-indigo-700', dot: 'bg-indigo-500' },
  contractor:        { text: 'text-orange-700', dot: 'bg-orange-500' },
  governor:          { text: 'text-purple-700', dot: 'bg-purple-500' },
}

const GROUP_LABEL: Record<string, string> = {
  student:           'Student',
  teaching_staff:    'Teaching',
  non_teaching_staff:'Non-Teaching',
  contractor:        'Contractor',
  governor:          'Governor',
}

const FILTER_KINDS: { label: string; value: FilterKind; icon: React.ReactNode }[] = [
  { label: 'All Activity',  value: 'all',        icon: <ClipboardList size={14} /> },
  { label: 'Attendance',    value: 'attendance',  icon: <UserCheck size={14} /> },
  { label: 'Visitors',      value: 'visitors',    icon: <Eye size={14} /> },
  { label: 'Absences',      value: 'absences',    icon: <Calendar size={14} /> },
  { label: 'People',        value: 'people',      icon: <Users size={14} /> },
]

const PRESETS = [
  { label: 'Today',        days: 0 },
  { label: 'Last 7 days',  days: 7 },
  { label: 'Last 30 days', days: 30 },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const { site } = useSite()

  const [events,    setEvents]    = useState<AuditEvent[]>([])
  const [loading,   setLoading]   = useState(false)
  const [kindFilter,setKindFilter]= useState<FilterKind>('all')
  const [dateFrom,  setDateFrom]  = useState(subDays(new Date(), 7).toISOString().slice(0, 10))
  const [dateTo,    setDateTo]    = useState(new Date().toISOString().slice(0, 10))
  const [limit,     setLimit]     = useState(100)

  const load = useCallback(async () => {
    if (!site) return
    setLoading(true)

    const from = startOfDay(new Date(dateFrom)).toISOString()
    const to   = endOfDay(new Date(dateTo)).toISOString()

    const collected: AuditEvent[] = []

    // ── 1. Attendance sign-ins ──────────────────────────────────────────────
    if (kindFilter === 'all' || kindFilter === 'attendance') {
      const { data: signIns } = await supabase
        .from('attendance_records')
        .select('id, signed_in_at, signed_out_at, sign_out_reason, status, person:persons(full_name, first_name, last_name, group, year_group, department)')
        .eq('site_id', site.id)
        .not('signed_in_at', 'is', null)
        .gte('signed_in_at', from)
        .lte('signed_in_at', to)
        .order('signed_in_at', { ascending: false })
        .limit(200)

      for (const r of signIns ?? []) {
        const p = r.person as any
        if (!p) continue
        const meta = [
          p.year_group ?? p.department ?? GROUP_LABEL[p.group] ?? '',
          format(new Date(r.signed_in_at), 'HH:mm'),
        ].filter(Boolean).join(' · ')

        collected.push({
          id: `si-${r.id}`,
          kind: 'sign_in',
          ts: r.signed_in_at,
          label: `${p.full_name} signed in`,
          meta,
          group: p.group,
          source: 'kiosk',
        })

        // sign-out event if present
        if (r.signed_out_at) {
          const outTime = new Date(r.signed_out_at)
          if (outTime >= new Date(from) && outTime <= new Date(to)) {
            collected.push({
              id: `so-${r.id}`,
              kind: 'sign_out',
              ts: r.signed_out_at,
              label: `${p.full_name} signed out`,
              meta: [
                p.year_group ?? p.department ?? GROUP_LABEL[p.group] ?? '',
                formatSignOutReason(r.sign_out_reason),
                format(outTime, 'HH:mm'),
              ].filter(Boolean).join(' · '),
              group: p.group,
              source: 'kiosk',
            })
          }
        }
      }

      // Also catch sign-outs that happened in range but sign-in was before range
      const { data: signOuts } = await supabase
        .from('attendance_records')
        .select('id, signed_in_at, signed_out_at, sign_out_reason, person:persons(full_name, first_name, last_name, group, year_group, department)')
        .eq('site_id', site.id)
        .not('signed_out_at', 'is', null)
        .gte('signed_out_at', from)
        .lte('signed_out_at', to)
        .lt('signed_in_at', from)   // sign-in was before our range window
        .order('signed_out_at', { ascending: false })
        .limit(100)

      for (const r of signOuts ?? []) {
        const p = r.person as any
        if (!p) continue
        // avoid duplicates (already captured above)
        if (collected.some(e => e.id === `so-${r.id}`)) continue
        collected.push({
          id: `so-${r.id}`,
          kind: 'sign_out',
          ts: r.signed_out_at,
          label: `${p.full_name} signed out`,
          meta: [
            p.year_group ?? p.department ?? GROUP_LABEL[p.group] ?? '',
            formatSignOutReason(r.sign_out_reason),
            format(new Date(r.signed_out_at), 'HH:mm'),
          ].filter(Boolean).join(' · '),
          group: p.group,
          source: 'kiosk',
        })
      }
    }

    // ── 2. Visitor arrivals / departures ────────────────────────────────────
    if (kindFilter === 'all' || kindFilter === 'visitors') {
      const { data: visits } = await supabase
        .from('visit_logs')
        .select('id, checked_in_at, checked_out_at, purpose, host_name, visitor:visitors(full_name, company)')
        .eq('site_id', site.id)
        .gte('checked_in_at', from)
        .lte('checked_in_at', to)
        .order('checked_in_at', { ascending: false })
        .limit(200)

      for (const v of visits ?? []) {
        const vis = v.visitor as any
        const name = vis?.full_name ?? 'Unknown visitor'
        const company = vis?.company ? ` (${vis.company})` : ''
        const host = v.host_name ? ` → ${v.host_name}` : ''
        const purpose = v.purpose ?? ''

        collected.push({
          id: `vi-${v.id}`,
          kind: 'visitor_in',
          ts: v.checked_in_at,
          label: `${name}${company} arrived`,
          meta: [purpose, `In at ${format(new Date(v.checked_in_at), 'HH:mm')}${host}`].filter(Boolean).join(' · '),
          group: 'visitor',
        })

        if (v.checked_out_at) {
          const outTime = new Date(v.checked_out_at)
          if (outTime >= new Date(from) && outTime <= new Date(to)) {
            collected.push({
              id: `vo-${v.id}`,
              kind: 'visitor_out',
              ts: v.checked_out_at,
              label: `${name}${company} departed`,
              meta: `Out at ${format(outTime, 'HH:mm')}`,
              group: 'visitor',
            })
          }
        }
      }
    }

    // ── 3. Absence records ──────────────────────────────────────────────────
    if (kindFilter === 'all' || kindFilter === 'absences') {
      const { data: absences } = await supabase
        .from('absence_records')
        .select('id, created_at, absence_type, start_date, end_date, reason, authorised, person:persons(full_name, group, year_group, department)')
        .eq('site_id', site.id)
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(100)

      for (const a of absences ?? []) {
        const p = a.person as any
        if (!p) continue
        const range = a.start_date === a.end_date
          ? format(new Date(a.start_date), 'd MMM')
          : `${format(new Date(a.start_date), 'd MMM')}–${format(new Date(a.end_date), 'd MMM')}`

        collected.push({
          id: `ab-${a.id}`,
          kind: a.authorised ? 'absence_authorised' : 'absence_added',
          ts: a.created_at,
          label: `${p.full_name}: ${formatAbsenceType(a.absence_type)} absence`,
          meta: [range, a.reason].filter(Boolean).join(' · '),
          group: p.group,
        })
      }
    }

    // ── 4. People added ─────────────────────────────────────────────────────
    if (kindFilter === 'all' || kindFilter === 'people') {
      const { data: newPeople } = await supabase
        .from('persons')
        .select('id, created_at, full_name, group, year_group, department')
        .eq('site_id', site.id)
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(100)

      for (const p of newPeople ?? []) {
        collected.push({
          id: `pa-${p.id}`,
          kind: 'person_added',
          ts: p.created_at,
          label: `${p.full_name} added to system`,
          meta: [
            GROUP_LABEL[p.group] ?? p.group,
            p.year_group ?? p.department,
          ].filter(Boolean).join(' · '),
          group: p.group,
        })
      }
    }

    // Sort all events newest-first and apply limit
    collected.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    setEvents(collected.slice(0, limit))
    setLoading(false)
  }, [site, kindFilter, dateFrom, dateTo, limit])

  useEffect(() => { load() }, [load])

  // Group events by day for the timeline display
  const grouped = groupByDay(events)

  return (
    <div>
      <TopBar
        title="Audit Log"
        subtitle="Full system activity trail"
        actions={
          <button onClick={load} className="btn-secondary py-2 text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      <div className="p-6 space-y-5">

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">

          {/* Date range */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              max={dateTo}
              className="text-sm text-gray-700 focus:outline-none"
            />
            <span className="text-gray-300 text-sm">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              min={dateFrom}
              max={new Date().toISOString().slice(0, 10)}
              className="text-sm text-gray-700 focus:outline-none"
            />
          </div>

          {/* Presets */}
          <div className="flex gap-1">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => {
                  setDateFrom(subDays(new Date(), p.days).toISOString().slice(0, 10))
                  setDateTo(new Date().toISOString().slice(0, 10))
                }}
                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Kind filter tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
          {FILTER_KINDS.map(f => (
            <button
              key={f.value}
              onClick={() => setKindFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                kindFilter === f.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        {/* Summary chips */}
        {!loading && events.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {countBy(events, 'sign_in')    > 0 && <SummaryChip colour="green"  label="Sign Ins"    count={countBy(events, 'sign_in')} />}
            {countBy(events, 'sign_out')   > 0 && <SummaryChip colour="gray"   label="Sign Outs"   count={countBy(events, 'sign_out')} />}
            {countBy(events, 'visitor_in') > 0 && <SummaryChip colour="brand"  label="Visitors In" count={countBy(events, 'visitor_in')} />}
            {countBy(events, 'absence_added') + countBy(events, 'absence_authorised') > 0 && (
              <SummaryChip colour="amber" label="Absences" count={countBy(events, 'absence_added') + countBy(events, 'absence_authorised')} />
            )}
            {countBy(events, 'person_added') > 0 && <SummaryChip colour="purple" label="People Added" count={countBy(events, 'person_added')} />}
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-6">
          {loading ? (
            <div className="card flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading activity…</p>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="card text-center py-16">
              <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-500">No activity found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting the date range or filter</p>
            </div>
          ) : (
            grouped.map(({ day, items }) => (
              <div key={day}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3 mt-2">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-widest whitespace-nowrap">
                    {formatDayLabel(day)}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
                </div>

                {/* Events card */}
                <div className="card overflow-hidden divide-y divide-gray-50">
                  {items.map(evt => {
                    const cfg = KIND_CONFIG[evt.kind]
                    return (
                      <div key={evt.id} className="flex items-start gap-4 px-5 py-3 hover:bg-gray-50">
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg} ${cfg.text}`}>
                          {cfg.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900">{evt.label}</p>
                            {evt.group && evt.group !== 'visitor' && (() => {
                              const gb = GROUP_BADGE[evt.group]
                              return (
                                <span className={`inline-flex items-center gap-1 text-xs font-medium ${gb?.text ?? 'text-gray-500'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${gb?.dot ?? 'bg-gray-400'}`} />
                                  {GROUP_LABEL[evt.group] ?? evt.group}
                                </span>
                              )
                            })()}
                            {evt.group === 'visitor' && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-brand-500" />
                                Visitor
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{evt.meta}</p>
                        </div>

                        {/* Time */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-medium text-gray-500">{format(new Date(evt.ts), 'HH:mm')}</p>
                          <p className={`text-xs mt-0.5 ${cfg.text}`}>{cfg.label}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load more */}
        {!loading && events.length >= limit && (
          <div className="text-center">
            <button
              onClick={() => setLimit(l => l + 100)}
              className="btn-secondary text-sm"
            >
              <ChevronDown size={15} /> Load more
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByDay(events: AuditEvent[]): { day: string; items: AuditEvent[] }[] {
  const map = new Map<string, AuditEvent[]>()
  for (const e of events) {
    const day = e.ts.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(e)
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }))
}

function formatDayLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  if (isToday(d))     return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, d MMMM yyyy')
}

function countBy(events: AuditEvent[], kind: EventKind) {
  return events.filter(e => e.kind === kind).length
}

function formatSignOutReason(key: string | null | undefined): string {
  if (!key) return ''
  const map: Record<string, string> = {
    finish_day:     'Finished for the day',
    lunch_break:    'Lunch break',
    short_break:    'Short break',
    medical:        'Medical appointment',
    field_trip:     'Field trip / Site visit',
    training:       'Training / CPD',
    changing_sites: 'Changing sites',
    personal:       'Personal',
    other:          'Other',
  }
  return map[key] ?? key
}

function formatAbsenceType(t: string) {
  const map: Record<string, string> = {
    sick: 'Sick',
    authorised: 'Authorised',
    unauthorised: 'Unauthorised',
    holiday: 'Holiday',
    medical: 'Medical',
    other: 'Other',
  }
  return map[t] ?? t
}

function SummaryChip({ colour, label, count }: { colour: string; label: string; count: number }) {
  const colours: Record<string, string> = {
    green:  'bg-green-100 text-green-700',
    gray:   'bg-gray-100 text-gray-600',
    brand:  'bg-brand-100 text-brand-700',
    amber:  'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${colours[colour] ?? colours.gray}`}>
      {count} {label}
    </span>
  )
}
