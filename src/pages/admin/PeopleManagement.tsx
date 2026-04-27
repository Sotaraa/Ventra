import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/hooks/useSite'
import TopBar from '@/components/layout/TopBar'
import AddPersonModal from '@/components/admin/AddPersonModal'
import AzureSyncModal from '@/components/admin/AzureSyncModal'
import { Search, Plus, RefreshCw, Users, Download } from 'lucide-react'
import type { Person, PersonGroup } from '@/types'

const GROUP_TABS: { label: string; value: PersonGroup | 'all' }[] = [
  { label: 'All',          value: 'all' },
  { label: 'Teaching',     value: 'teaching_staff' },
  { label: 'Non-Teaching', value: 'non_teaching_staff' },
  { label: 'Students',     value: 'student' },
  { label: 'Contractors',  value: 'contractor' },
  { label: 'Governors',    value: 'governor' },
]

const GROUP_LABEL: Record<PersonGroup, string> = {
  teaching_staff:     'Teaching',
  non_teaching_staff: 'Non-Teaching',
  student:            'Student',
  contractor:         'Contractor',
  governor:           'Governor',
}

export default function PeopleManagement() {
  const { site, loading: siteLoading, error: siteError } = useSite()
  const [people, setPeople]             = useState<Person[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [groupFilter, setGroupFilter]   = useState<PersonGroup | 'all'>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editPerson, setEditPerson]     = useState<Person | null>(null)
  const [showSyncModal, setShowSyncModal] = useState(false)

  async function load() {
    if (!site) return
    setLoading(true)
    let q = supabase
      .from('persons')
      .select('*')
      .eq('site_id', site.id)
      .eq('is_active', !showInactive)
      .order('last_name')
    if (groupFilter !== 'all') q = q.eq('group', groupFilter)
    const { data } = await q
    setPeople((data as Person[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [site, groupFilter, showInactive])

  const filtered = search
    ? people.filter(p =>
        p.full_name.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase()) ||
        p.department?.toLowerCase().includes(search.toLowerCase())
      )
    : people

  if (!siteLoading && siteError) {
    return (
      <div className="p-8 text-center text-red-500">
        <p className="font-semibold">Could not load site configuration</p>
        <p className="text-sm text-gray-400 mt-1">{siteError}</p>
      </div>
    )
  }

  async function exportCSV() {
    const header = 'Name,Group,Email,Department,Year Group,Form,Status'
    const rows = filtered.map(p =>
      [p.full_name, GROUP_LABEL[p.group], p.email ?? '', p.department ?? '', p.year_group ?? '', p.form_group ?? '', p.is_active ? 'Active' : 'Inactive'].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'ventra-people.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <TopBar
        title="People Management"
        subtitle="Staff, students and contractors"
        actions={
          <div className="flex gap-2">
            <button onClick={exportCSV} className="btn-secondary py-2 text-sm">
              <Download size={15} /> Export CSV
            </button>
            <button onClick={() => setShowSyncModal(true)} className="btn-secondary py-2 text-sm">
              <RefreshCw size={15} /> Sync Azure AD
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn-primary py-2 text-sm">
              <Plus size={15} /> Add Person
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 py-2"
              placeholder="Search by name, email or department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 flex-shrink-0 flex-wrap">
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

          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show archived
          </label>
        </div>

        {/* Count */}
        {!loading && (
          <p className="text-xs text-gray-400">
            {filtered.length} {filtered.length === 1 ? 'person' : 'people'} shown
            {people.some(p => p.azure_oid) && (
              <span className="ml-2 inline-flex items-center gap-1 text-brand-500">
                <RefreshCw size={10} />
                {people.filter(p => p.azure_oid).length} synced from Azure AD
              </span>
            )}
          </p>
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.07]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Group</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Dept / Year</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden xl:table-cell">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Loading people…</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <Users size={32} className="opacity-25" />
                        <div>
                          <p className="font-medium text-gray-500">No people found</p>
                          <p className="text-xs mt-1">Add people manually or sync from Azure AD</p>
                        </div>
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => setShowSyncModal(true)} className="btn-secondary py-1.5 text-xs">
                            <RefreshCw size={12} /> Sync Azure AD
                          </button>
                          <button onClick={() => setShowAddModal(true)} className="btn-primary py-1.5 text-xs">
                            <Plus size={12} /> Add Manually
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => (
                    <tr
                      key={p.id}
                      onClick={() => setEditPerson(p)}
                      className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      {/* Name + avatar */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {p.first_name[0]}{p.last_name[0]}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{p.full_name}</span>
                        </div>
                      </td>

                      {/* Group — plain text, no badge */}
                      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {GROUP_LABEL[p.group]}
                      </td>

                      {/* Dept / Year */}
                      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                        {p.department ?? p.year_group ?? '—'}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3.5 text-sm text-gray-400 hidden sm:table-cell">
                        {p.email ?? '—'}
                      </td>

                      {/* Source — plain text */}
                      <td className="px-4 py-3.5 text-xs text-gray-400 hidden xl:table-cell">
                        {p.azure_oid ? 'Azure AD' : 'Manual'}
                      </td>

                      {/* Status — dot + text */}
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.is_active ? 'bg-brand-500' : 'bg-gray-300'}`} />
                          <span className="text-gray-600 dark:text-gray-400">{p.is_active ? 'Active' : 'Archived'}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(showAddModal || editPerson) && site && (
        <AddPersonModal
          person={editPerson ?? undefined}
          siteId={site.id}
          onClose={() => { setShowAddModal(false); setEditPerson(null) }}
          onSaved={load}
        />
      )}

      {showSyncModal && site && (
        <AzureSyncModal
          siteId={site.id}
          onClose={() => setShowSyncModal(false)}
          onSynced={load}
        />
      )}
    </div>
  )
}
