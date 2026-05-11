import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import { useAuth } from '@/store/AuthContext'
import TopBar from '@/components/layout/TopBar'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Flame, CheckCircle, Circle, RefreshCw, AlertTriangle,
  Users, MapPin, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Local types (DB column is visit_log_id, not visitor_log_id) ──────────────

interface EvacEvent {
  id: string
  site_id: string
  triggered_by: string | null
  triggered_at: string
  resolved_at: string | null
  total_on_site: number
  total_accounted: number
  muster_point: string | null
  notes: string | null
  created_at: string
}

interface RollCallItem {
  id: string
  evacuation_event_id: string
  person_id: string | null
  visit_log_id: string | null
  name: string
  person_group: string
  accounted: boolean
  accounted_at: string | null
  accounted_by: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EvacuationPage() {
  const { site } = useSite()
  const { user } = useAuth()

  const [activeEvent,      setActiveEvent]      = useState<EvacEvent | null>(null)
  const [rollCall,         setRollCall]          = useState<RollCallItem[]>([])
  const [pastEvents,       setPastEvents]        = useState<EvacEvent[]>([])
  const [loading,          setLoading]           = useState(true)
  const [showTriggerModal, setShowTriggerModal]  = useState(false)
  const [musterPoint,      setMusterPoint]       = useState('')
  const [triggering,       setTriggering]        = useState(false)
  const [resolving,        setResolving]         = useState(false)

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadRollCall = useCallback(async (eventId: string) => {
    const { data } = await supabase
      .from('evacuation_roll_calls')
      .select('*')
      .eq('evacuation_event_id', eventId)
      .order('group')
      .order('name')
    const items = (data ?? []) as RollCallItem[]
    setRollCall(items)
    const accounted = items.filter(r => r.accounted).length
    setActiveEvent(prev => prev ? { ...prev, total_accounted: accounted } : prev)
  }, [])

  const load = useCallback(async () => {
    if (!site) return
    setLoading(true)

    const { data: active } = await supabase
      .from('evacuation_events')
      .select('*')
      .eq('site_id', site.id)
      .is('resolved_at', null)
      .order('triggered_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const ev = active as EvacEvent | null
    setActiveEvent(ev)

    if (ev) {
      await loadRollCall(ev.id)
    } else {
      setRollCall([])
    }

    const { data: past } = await supabase
      .from('evacuation_events')
      .select('*')
      .eq('site_id', site.id)
      .not('resolved_at', 'is', null)
      .order('triggered_at', { ascending: false })
      .limit(10)
    setPastEvents((past ?? []) as EvacEvent[])

    setLoading(false)
  }, [site, loadRollCall])

  useEffect(() => { load() }, [load])

  // ── Realtime subscription ────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeEvent) return
    const channel = supabase
      .channel(`evacuation-${activeEvent.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'evacuation_roll_calls',
        filter: `evacuation_event_id=eq.${activeEvent.id}`,
      }, () => {
        loadRollCall(activeEvent.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeEvent?.id, loadRollCall])

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function triggerEvacuation() {
    if (!site || !user) return
    setTriggering(true)
    const today = new Date().toISOString().slice(0, 10)

    // Snapshot all on-site persons (attendance present, not yet signed out)
    const { data: attendance, error: attErr } = await supabase
      .from('attendance_records')
      .select('person_id, person:persons(full_name, group)')
      .eq('site_id', site.id)
      .eq('date', today)
      .eq('status', 'present')
      .is('signed_out_at', null)

    if (attErr) {
      console.error('[Ventra] Attendance fetch failed:', attErr)
      toast.error('Could not fetch attendance records')
      setTriggering(false)
      return
    }

    // Snapshot all checked-in visitors
    const { data: visitors, error: visErr } = await supabase
      .from('visit_logs')
      .select('id, visitor:visitors(full_name, visitor_type)')
      .eq('site_id', site.id)
      .eq('status', 'checked_in')
      .gte('checked_in_at', `${today}T00:00:00`)

    if (visErr) {
      console.error('[Ventra] Visitor fetch failed:', visErr)
      // Non-fatal — proceed without visitors rather than blocking the evacuation
      console.warn('[Ventra] Proceeding without visitor snapshot')
    }

    const totalOnSite = (attendance?.length ?? 0) + (visitors?.length ?? 0)

    // Create evacuation event
    const { data: event, error } = await supabase
      .from('evacuation_events')
      .insert({
        site_id: site.id,
        triggered_by: user.id,
        total_on_site: totalOnSite,
        muster_point: musterPoint.trim() || null,
      })
      .select()
      .single()

    if (error || !event) {
      toast.error('Failed to trigger evacuation')
      setTriggering(false)
      return
    }

    // Build roll call rows
    const personRows = (attendance ?? []).map((r: any) => ({
      evacuation_event_id: event.id,
      person_id: r.person_id,
      name: r.person?.full_name ?? 'Unknown',
      person_group: r.person?.group ?? 'staff',
      accounted: false,
    }))

    const visitorRows = (visitors ?? []).map((r: any) => ({
      evacuation_event_id: event.id,
      visit_log_id: r.id,
      name: r.visitor?.full_name ?? 'Unknown Visitor',
      person_group: 'visitor',
      accounted: false,
    }))

    const allRows = [...personRows, ...visitorRows]
    if (allRows.length > 0) {
      const { error: insertErr } = await supabase
        .from('evacuation_roll_calls')
        .insert(allRows)

      if (insertErr) {
        console.error('[Ventra] Roll call insert failed:', insertErr)
        toast.error(`Roll call failed: ${insertErr.message}`)
        // Clean up the orphaned event so it doesn't block future evacuations
        await supabase.from('evacuation_events').delete().eq('id', event.id)
        setTriggering(false)
        return
      }
    }

    toast.success('Evacuation triggered — roll call started')
    setShowTriggerModal(false)
    setMusterPoint('')
    setTriggering(false)
    load()
  }

  async function toggleAccounted(item: RollCallItem) {
    if (!activeEvent) return
    const newVal = !item.accounted
    const updatedItems = rollCall.map(r =>
      r.id === item.id ? { ...r, accounted: newVal, accounted_at: newVal ? new Date().toISOString() : null } : r
    )
    const accountedCount = updatedItems.filter(r => r.accounted).length

    // Optimistic update
    setRollCall(updatedItems)
    setActiveEvent(prev => prev ? { ...prev, total_accounted: accountedCount } : prev)

    await supabase
      .from('evacuation_roll_calls')
      .update({
        accounted: newVal,
        accounted_at: newVal ? new Date().toISOString() : null,
        accounted_by: newVal ? user?.id : null,
      })
      .eq('id', item.id)

    await supabase
      .from('evacuation_events')
      .update({ total_accounted: accountedCount })
      .eq('id', activeEvent.id)
  }

  async function resolveEvacuation() {
    if (!activeEvent) return
    setResolving(true)
    const { error } = await supabase
      .from('evacuation_events')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', activeEvent.id)
    if (error) {
      toast.error('Failed to resolve evacuation')
    } else {
      toast.success('Evacuation resolved — all clear')
      load()
    }
    setResolving(false)
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const grouped = rollCall.reduce<Record<string, RollCallItem[]>>((acc, item) => {
    const key = item.person_group ?? 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const accountedCount = activeEvent?.total_accounted ?? 0
  const totalCount     = activeEvent?.total_on_site    ?? rollCall.length
  const allAccounted   = rollCall.length > 0 && rollCall.every(r => r.accounted)
  const pct            = totalCount > 0 ? Math.round((accountedCount / totalCount) * 100) : 0

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <TopBar title="Emergency Evacuation" subtitle="Fire & evacuation roll call" />
        <div className="p-6 flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar
        title="Emergency Evacuation"
        subtitle={
          activeEvent
            ? `Active since ${format(new Date(activeEvent.triggered_at), 'HH:mm')} · ${accountedCount}/${totalCount} accounted`
            : 'Fire & evacuation roll call'
        }
        actions={
          <button onClick={load} className="btn-secondary py-2 text-sm">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      <div className="p-6 space-y-6">

        {/* ── ACTIVE EVENT ─────────────────────────────────────────────────── */}
        {activeEvent ? (
          <>
            {/* Red banner */}
            <div className="bg-red-600 text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Flame size={32} className="flex-shrink-0 animate-pulse" />
                <div>
                  <p className="text-xl font-bold">EVACUATION IN PROGRESS</p>
                  <p className="text-sm text-red-200">
                    Started {formatDistanceToNow(new Date(activeEvent.triggered_at), { addSuffix: true })}
                    {activeEvent.muster_point && ` · Muster point: ${activeEvent.muster_point}`}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-5xl font-bold leading-none">
                  {accountedCount}
                  <span className="text-2xl text-red-200">/{totalCount}</span>
                </p>
                <p className="text-sm text-red-200 mt-1">accounted for</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Roll Call Progress</span>
                <span className="text-sm text-gray-500">{pct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${allAccounted ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {allAccounted && (
                <p className="text-sm text-green-600 font-medium mt-2 flex items-center gap-1">
                  <CheckCircle size={14} /> All persons accounted for
                </p>
              )}
            </div>

            {/* Roll call groups */}
            {Object.keys(grouped).length === 0 ? (
              <div className="card p-10 text-center text-gray-500">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No one was recorded on site when evacuation was triggered.</p>
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => {
                const groupAccounted = items.filter(i => i.accounted).length
                return (
                  <div key={group} className="card overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800 capitalize">
                        {group.replace(/_/g, ' ')}
                      </h3>
                      <span className={`badge ${groupAccounted === items.length ? 'badge-green' : 'badge-amber'}`}>
                        {groupAccounted}/{items.length}
                      </span>
                    </div>
                    <div className="divide-y">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors
                            ${item.accounted ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                          onClick={() => toggleAccounted(item)}
                        >
                          {item.accounted
                            ? <CheckCircle size={22} className="text-green-500 flex-shrink-0" />
                            : <Circle     size={22} className="text-gray-300 flex-shrink-0" />
                          }
                          <span className={`flex-1 font-medium ${item.accounted ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                            {item.name}
                          </span>
                          {item.accounted && item.accounted_at && (
                            <span className="text-xs text-green-600 flex-shrink-0">
                              {format(new Date(item.accounted_at), 'HH:mm')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}

            {/* Resolve button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={resolveEvacuation}
                disabled={resolving}
                className={`btn-primary px-6 py-3 text-base ${allAccounted ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600'}`}
              >
                {resolving
                  ? <RefreshCw size={18} className="animate-spin" />
                  : <CheckCircle size={18} />
                }
                {allAccounted ? 'All Clear — Resolve Evacuation' : 'Resolve Evacuation (Partial)'}
              </button>
            </div>
          </>

        ) : (

          /* ── NO ACTIVE EVENT ─────────────────────────────────────────────── */
          <>
            <div className="card p-10 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Flame size={32} className="text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No Active Evacuation</h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Trigger an evacuation to start a live roll call. All currently signed-in staff, students, contractors, and visitors will be included automatically.
              </p>
              <button
                onClick={() => setShowTriggerModal(true)}
                className="btn-primary bg-red-600 hover:bg-red-700 px-8 py-3 text-base"
              >
                <Flame size={20} /> Trigger Emergency Evacuation
              </button>
            </div>

            {/* Past events */}
            {pastEvents.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Past Evacuations</h2>
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b text-left">
                        <th className="px-4 py-3 font-semibold text-gray-600">Date & Time</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">Duration</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">Muster Point</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Accounted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pastEvents.map(ev => {
                        const durMin = ev.resolved_at
                          ? Math.round((new Date(ev.resolved_at).getTime() - new Date(ev.triggered_at).getTime()) / 60000)
                          : null
                        const full = ev.total_on_site > 0 && ev.total_accounted >= ev.total_on_site
                        return (
                          <tr key={ev.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {format(new Date(ev.triggered_at), 'dd MMM yyyy · HH:mm')}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {durMin !== null ? `${durMin} min` : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{ev.muster_point ?? '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`badge ${full ? 'badge-green' : 'badge-amber'}`}>
                                {ev.total_accounted}/{ev.total_on_site}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── TRIGGER MODAL ──────────────────────────────────────────────────────── */}
      {showTriggerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle size={22} /> Confirm Evacuation
              </h2>
              <button onClick={() => setShowTriggerModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-5">
              This will immediately start a live roll call for all on-site staff, students, contractors, and visitors. This action cannot be undone without resolving the evacuation.
            </p>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin size={14} className="inline mr-1" />
                Muster Point <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                className="input w-full"
                placeholder="e.g. Main Car Park, Football Field"
                value={musterPoint}
                onChange={e => setMusterPoint(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !triggering && triggerEvacuation()}
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowTriggerModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={triggerEvacuation}
                disabled={triggering}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                {triggering
                  ? <RefreshCw size={16} className="animate-spin" />
                  : <Flame size={16} />
                }
                {triggering ? 'Triggering...' : 'Trigger Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
