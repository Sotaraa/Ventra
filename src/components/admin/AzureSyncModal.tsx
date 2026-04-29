import { useState, useEffect, useRef } from 'react'
import { useMsal } from '@azure/msal-react'
import { supabase } from '@/lib/supabase'
import { listGroups, getGroupMembers, searchUsers } from '@/lib/graphClient'
import type { GraphUser } from '@/lib/graphClient'
import {
  X, RefreshCw, Loader2, CheckCircle, AlertTriangle,
  CloudOff, Info, Search, Users, UserPlus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { PersonGroup } from '@/types'

interface Props {
  siteId: string
  onClose: () => void
  onSynced: () => void
}

interface AdGroup { id: string; displayName: string }

interface GroupMapping {
  ad_group_id: string
  ad_group_name: string
  person_group: PersonGroup | ''
}

interface SyncResult {
  group_name: string
  added: number
  updated: number
  skipped: number
  errors: number
}

const PERSON_GROUPS: { value: PersonGroup | ''; label: string; color: string }[] = [
  { value: '',                   label: '— Do not sync —',  color: 'text-gray-400' },
  { value: 'teaching_staff',     label: 'Teaching Staff',   color: 'text-green-700' },
  { value: 'non_teaching_staff', label: 'Non-Teaching',     color: 'text-gray-700' },
  { value: 'student',            label: 'Students',         color: 'text-blue-700' },
  { value: 'contractor',         label: 'Contractors',      color: 'text-amber-700' },
  { value: 'governor',           label: 'Governors',        color: 'text-purple-700' },
]

type Step = 'loading' | 'map' | 'syncing' | 'done' | 'error' | 'not_configured'
type Tab  = 'groups' | 'users'

const isConfigured = !!(
  import.meta.env.VITE_AZURE_CLIENT_ID &&
  import.meta.env.VITE_AZURE_CLIENT_ID !== 'PLACEHOLDER_CLIENT_ID'
)

export default function AzureSyncModal({ siteId, onClose, onSynced }: Props) {
  const { instance: msalInstance } = useMsal()
  const [tab,  setTab]  = useState<Tab>('groups')
  const [step, setStep] = useState<Step>(isConfigured ? 'loading' : 'not_configured')

  // ── Groups tab state ──────────────────────────────────────────────────────
  const [adGroups,    setAdGroups]    = useState<AdGroup[]>([])
  const [mappings,    setMappings]    = useState<GroupMapping[]>([])
  const [groupSearch, setGroupSearch] = useState('')
  const [syncResults, setSyncResults] = useState<SyncResult[]>([])
  const [syncProgress, setSyncProgress] = useState('')

  // ── Users tab state ───────────────────────────────────────────────────────
  const [userQuery,   setUserQuery]   = useState('')
  const [userResults, setUserResults] = useState<GraphUser[]>([])
  const [userSearching, setUserSearching] = useState(false)
  const [addingUser,  setAddingUser]  = useState<string | null>(null) // azure_oid being added
  const [addedUsers,  setAddedUsers]  = useState<Set<string>>(new Set())
  const [userGroups,  setUserGroups]  = useState<Record<string, PersonGroup>>({}) // per-user group choice
  const userSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!isConfigured) return
    loadAdGroups()
  }, [])

  // Debounced user search
  useEffect(() => {
    if (userQuery.length < 2) { setUserResults([]); return }
    if (userSearchTimeout.current) clearTimeout(userSearchTimeout.current)
    userSearchTimeout.current = setTimeout(async () => {
      setUserSearching(true)
      try {
        const results = await searchUsers(msalInstance, userQuery)
        setUserResults(results)
      } catch (err: any) {
        toast.error('Search failed: ' + (err?.message ?? 'Unknown error'))
      }
      setUserSearching(false)
    }, 400)
  }, [userQuery])

  async function loadAdGroups() {
    setStep('loading')
    try {
      const { data: siteData } = await supabase
        .from('sites').select('ad_sync_config').eq('id', siteId).single()
      const savedMappings: GroupMapping[] = siteData?.ad_sync_config?.mappings ?? []

      const groups = await listGroups(msalInstance)
      setAdGroups(groups)
      setMappings(groups.map(g => {
        const saved = savedMappings.find(m => m.ad_group_id === g.id)
        return { ad_group_id: g.id, ad_group_name: g.displayName, person_group: saved?.person_group ?? '' }
      }))
      setStep('map')
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (msg.includes('403') || msg.includes('Forbidden')) {
        setErrorMessage('Permission denied. Grant "Group.Read.All" admin consent in Azure Portal → Enterprise Apps → Ventra → Permissions.')
      } else {
        setErrorMessage(msg || 'Failed to load Azure AD groups.')
      }
      setStep('error')
    }
  }

  function updateMapping(id: string, person_group: PersonGroup | '') {
    setMappings(prev => prev.map(m => m.ad_group_id === id ? { ...m, person_group } : m))
  }

  async function handleSync() {
    const active = mappings.filter(m => m.person_group !== '')
    if (!active.length) { toast.error('Map at least one group first'); return }

    await supabase.from('sites').update({
      ad_sync_config: { mappings, last_synced_at: new Date().toISOString() }
    }).eq('id', siteId)

    setStep('syncing')
    const results: SyncResult[] = []

    for (const mapping of active) {
      setSyncProgress(`Syncing ${mapping.ad_group_name}…`)
      const result: SyncResult = { group_name: mapping.ad_group_name, added: 0, updated: 0, skipped: 0, errors: 0 }
      try {
        const members = await getGroupMembers(msalInstance, mapping.ad_group_id)
        for (const member of members) {
          await upsertPerson(member, mapping.person_group as PersonGroup, result)
        }
      } catch (err) {
        console.error('Sync error for', mapping.ad_group_name, err)
        result.errors++
      }
      results.push(result)
    }

    setSyncResults(results)
    setStep('done')
    onSynced()
  }

  async function upsertPerson(member: GraphUser, group: PersonGroup, result: SyncResult) {
    const firstName = member.givenName?.trim()  || member.displayName?.split(' ')[0] || 'Unknown'
    const lastName  = member.surname?.trim()    || member.displayName?.split(' ').slice(1).join(' ') || ''

    const { data: existing } = await supabase
      .from('persons').select('id,first_name,last_name,email,department,group')
      .eq('site_id', siteId)
      .eq('azure_oid', member.id).maybeSingle()

    // Prefer mail, fall back to userPrincipalName (always set in Azure AD)
    const resolvedEmail = member.mail || member.userPrincipalName || null

    if (existing) {
      const changed = existing.first_name !== firstName || existing.last_name !== lastName ||
        existing.email !== resolvedEmail || existing.department !== (member.department ?? null) ||
        existing.group !== group
      if (changed) {
        await supabase.from('persons').update({ first_name: firstName, last_name: lastName,
          email: resolvedEmail, department: member.department ?? null, group, is_active: true })
          .eq('id', existing.id)
        result.updated++
      } else { result.skipped++ }
    } else {
      const { error } = await supabase.from('persons').insert({
        site_id: siteId, azure_oid: member.id, group,
        first_name: firstName, last_name: lastName,
        email: resolvedEmail, department: member.department ?? null, is_active: true,
      })
      if (error) result.errors++; else result.added++
    }
  }

  async function handleAddUser(user: GraphUser) {
    const group = userGroups[user.id]
    if (!group) { toast.error('Select a group for this user first'); return }

    setAddingUser(user.id)
    const result: SyncResult = { group_name: user.displayName, added: 0, updated: 0, skipped: 0, errors: 0 }
    await upsertPerson(user, group, result)

    if (result.errors) {
      toast.error(`Failed to add ${user.displayName}`)
    } else {
      toast.success(result.added ? `${user.displayName} added` : `${user.displayName} updated`)
      setAddedUsers(prev => new Set([...prev, user.id]))
      onSynced()
    }
    setAddingUser(null)
  }

  const filteredGroups = groupSearch
    ? mappings.filter(m => m.ad_group_name.toLowerCase().includes(groupSearch.toLowerCase()))
    : mappings

  const activeMappingCount = mappings.filter(m => m.person_group !== '').length
  const totalAdded   = syncResults.reduce((s, r) => s + r.added,   0)
  const totalUpdated = syncResults.reduce((s, r) => s + r.updated, 0)
  const totalErrors  = syncResults.reduce((s, r) => s + r.errors,  0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={step !== 'syncing' ? onClose : undefined} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <RefreshCw size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Sync from Azure AD</h2>
              <p className="text-xs text-gray-400">Import your Microsoft 365 users into Ventra</p>
            </div>
          </div>
          {step !== 'syncing' && (
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
              <X size={18} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Tabs — only show when map step is active */}
        {step === 'map' && (
          <div className="flex border-b border-gray-100 flex-shrink-0">
            <button
              onClick={() => setTab('groups')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'groups' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={15} /> Sync by Group
              {activeMappingCount > 0 && (
                <span className="ml-1 bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5">{activeMappingCount}</span>
              )}
            </button>
            <button
              onClick={() => setTab('users')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'users' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserPlus size={15} /> Find & Add User
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Not configured */}
          {step === 'not_configured' && (
            <div className="p-8 flex flex-col items-center gap-4 text-center">
              <CloudOff size={32} className="text-gray-300" />
              <div>
                <h3 className="font-bold text-gray-900">Azure AD not configured</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm">
                  Add <code className="bg-gray-100 px-1 rounded text-xs">VITE_AZURE_CLIENT_ID</code> and{' '}
                  <code className="bg-gray-100 px-1 rounded text-xs">VITE_AZURE_TENANT_ID</code> as GitHub secrets then redeploy.
                </p>
              </div>
              <button onClick={onClose} className="btn-secondary">Close</button>
            </div>
          )}

          {/* Loading */}
          {step === 'loading' && (
            <div className="flex items-center justify-center gap-3 py-16 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
              <span>Connecting to Azure AD…</span>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="p-8 flex flex-col items-center gap-4 text-center">
              <AlertTriangle size={32} className="text-red-400" />
              <div>
                <h3 className="font-bold text-gray-900">Could not connect</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm">{errorMessage}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary">Close</button>
                <button onClick={loadAdGroups} className="btn-primary">Try Again</button>
              </div>
            </div>
          )}

          {/* Syncing */}
          {step === 'syncing' && (
            <div className="p-12 flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center">
                <Loader2 size={32} className="text-brand-600 animate-spin" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Syncing…</h3>
                <p className="text-sm text-gray-500 mt-1">{syncProgress}</p>
              </div>
              <p className="text-xs text-gray-400">Please don't close this window</p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="p-6 space-y-4">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${totalErrors > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                  <CheckCircle size={28} className={totalErrors > 0 ? 'text-amber-600' : 'text-green-600'} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Sync Complete</h3>
                  <div className="flex gap-4 mt-2 justify-center text-sm">
                    <span className="text-green-700 font-semibold">{totalAdded} added</span>
                    <span className="text-blue-700 font-semibold">{totalUpdated} updated</span>
                    {totalErrors > 0 && <span className="text-red-600 font-semibold">{totalErrors} errors</span>}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {syncResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 text-sm">
                    <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-900 flex-1 truncate">{r.group_name}</span>
                    <span className="text-green-700 text-xs">+{r.added} added</span>
                    <span className="text-blue-700 text-xs">~{r.updated} updated</span>
                    {r.errors > 0 && <span className="text-red-600 text-xs">!{r.errors}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Groups tab ─────────────────────────────────────────────────── */}
          {step === 'map' && tab === 'groups' && (
            <div className="p-5 space-y-3">
              <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-blue-700">
                <Info size={15} className="flex-shrink-0 mt-0.5" />
                Map each Azure AD group to a Ventra group. Leave as "Do not sync" to skip.
              </div>

              {/* Group search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9 py-2 text-sm"
                  placeholder={`Search ${adGroups.length} groups…`}
                  value={groupSearch}
                  onChange={e => setGroupSearch(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                {filteredGroups.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-sm">No groups match "{groupSearch}"</p>
                ) : (
                  filteredGroups.map(m => (
                    <div key={m.ad_group_id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{m.ad_group_name}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">{m.ad_group_id}</p>
                      </div>
                      <select
                        value={m.person_group}
                        onChange={e => updateMapping(m.ad_group_id, e.target.value as PersonGroup | '')}
                        className={`text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 flex-shrink-0 ${
                          PERSON_GROUPS.find(g => g.value === m.person_group)?.color ?? ''
                        }`}
                      >
                        {PERSON_GROUPS.map(g => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Users tab ──────────────────────────────────────────────────── */}
          {step === 'map' && tab === 'users' && (
            <div className="p-5 space-y-3">
              <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-blue-700">
                <Info size={15} className="flex-shrink-0 mt-0.5" />
                Search for any user in your Microsoft 365 directory and add them individually.
              </div>

              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9 py-2 text-sm"
                  placeholder="Search by name or email…"
                  value={userQuery}
                  onChange={e => setUserQuery(e.target.value)}
                  autoFocus
                />
                {userSearching && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}
              </div>

              {userResults.length > 0 && (
                <div className="space-y-1.5">
                  {userResults.map(user => {
                    const alreadyAdded = addedUsers.has(user.id)
                    return (
                      <div key={user.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${alreadyAdded ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-transparent'}`}>
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">
                          {(user.givenName?.[0] ?? user.displayName?.[0] ?? '?').toUpperCase()}
                          {(user.surname?.[0] ?? '').toUpperCase()}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{user.displayName}</p>
                          <p className="text-xs text-gray-400 truncate">{user.mail ?? user.userPrincipalName}</p>
                          {user.department && <p className="text-xs text-gray-400">{user.department}</p>}
                        </div>
                        {/* Group picker + add */}
                        {alreadyAdded ? (
                          <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                        ) : (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <select
                              value={userGroups[user.id] ?? ''}
                              onChange={e => setUserGroups(prev => ({ ...prev, [user.id]: e.target.value as PersonGroup }))}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                            >
                              <option value="">Group…</option>
                              {PERSON_GROUPS.filter(g => g.value !== '').map(g => (
                                <option key={g.value} value={g.value}>{g.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAddUser(user)}
                              disabled={!userGroups[user.id] || addingUser === user.id}
                              className="btn-primary py-1.5 px-3 text-xs disabled:opacity-40"
                            >
                              {addingUser === user.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <UserPlus size={12} />
                              }
                              Add
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {userQuery.length >= 2 && !userSearching && userResults.length === 0 && (
                <p className="text-center py-8 text-gray-400 text-sm">No users found for "{userQuery}"</p>
              )}

              {userQuery.length < 2 && (
                <p className="text-center py-8 text-gray-400 text-sm">Type at least 2 characters to search</p>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        {(step === 'map' || step === 'done') && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
            <p className="text-xs text-gray-400">
              {step === 'map' && tab === 'groups' && `${adGroups.length} groups · ${activeMappingCount} mapped`}
              {step === 'map' && tab === 'users' && `Search your Microsoft 365 directory`}
              {step === 'done' && `${totalAdded} added · ${totalUpdated} updated`}
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary">
                {step === 'done' ? 'Close' : 'Cancel'}
              </button>
              {step === 'map' && tab === 'groups' && (
                <button
                  onClick={handleSync}
                  disabled={activeMappingCount === 0}
                  className="btn-primary disabled:opacity-40"
                >
                  <RefreshCw size={14} />
                  Sync {activeMappingCount > 0 ? `${activeMappingCount} group(s)` : 'groups'} Now
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
