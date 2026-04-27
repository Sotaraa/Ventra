import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseKiosk as supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Search, Check, ChevronLeft } from 'lucide-react'
import type { VisitLog } from '@/types'

export default function KioskCheckout() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<VisitLog[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [checkedOutName, setCheckedOutName] = useState('')

  async function searchVisitor() {
    if (!search.trim()) return
    setLoading(true)
    const { data } = await supabase
      .from('visit_logs')
      .select('*, visitor:visitors(*)')
      .eq('status', 'checked_in')
      .ilike('visitors.full_name', `%${search}%`)
      .order('checked_in_at', { ascending: false })
      .limit(5)

    setResults((data as VisitLog[]) ?? [])
    setLoading(false)
  }

  async function checkout(log: VisitLog) {
    const { error } = await supabase
      .from('visit_logs')
      .update({ status: 'checked_out', checked_out_at: new Date().toISOString() })
      .eq('id', log.id)

    if (error) {
      toast.error('Could not sign you out. Please ask reception.')
      return
    }
    setCheckedOutName(log.visitor?.full_name ?? 'Visitor')
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-6 pt-12 text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl">
          <Check size={48} className="text-green-500" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white">Goodbye, {checkedOutName.split(' ')[0]}!</h2>
          <p className="text-brand-200 text-lg mt-2">You've been signed out. Have a safe journey.</p>
        </div>
        <button onClick={() => navigate('/kiosk')} className="btn-kiosk bg-white text-brand-600 mt-4 px-12">
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign out</h2>

      <div className="flex gap-3">
        <input
          className="input text-lg flex-1"
          placeholder="Enter your name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchVisitor()}
        />
        <button onClick={searchVisitor} disabled={loading} className="btn-primary px-5">
          <Search size={20} />
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-500 font-medium">Select your name:</p>
          {results.map(log => (
            <button
              key={log.id}
              onClick={() => checkout(log)}
              className="w-full text-left border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 rounded-xl p-4 transition-all"
            >
              <p className="font-semibold text-gray-900 text-lg">{log.visitor?.full_name}</p>
              <p className="text-sm text-gray-500">
                {log.visitor?.company && `${log.visitor.company} · `}
                Signed in {log.checked_in_at ? new Date(log.checked_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
              </p>
            </button>
          ))}
        </div>
      )}

      {results.length === 0 && search && !loading && (
        <p className="mt-6 text-center text-gray-500">No active visitors found. Please ask reception.</p>
      )}

      <button onClick={() => navigate('/kiosk')} className="btn-secondary mt-8">
        <ChevronLeft size={18} /> Back
      </button>
    </div>
  )
}
