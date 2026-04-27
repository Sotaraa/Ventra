import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { supabase } from '@/lib/supabase'
import { findUserByEmail } from '@/lib/graphClient'
import { X, Search, Loader2, CheckCircle, AlertTriangle, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Person, PersonGroup } from '@/types'

interface Props {
  person?: Person
  siteId: string
  onClose: () => void
  onSaved: () => void
}

const GROUPS: { value: PersonGroup; label: string }[] = [
  { value: 'teaching_staff',     label: 'Teaching Staff' },
  { value: 'non_teaching_staff', label: 'Non-Teaching Staff' },
  { value: 'student',            label: 'Student' },
  { value: 'contractor',         label: 'Contractor' },
  { value: 'governor',           label: 'Governor' },
]

const UK_YEAR_GROUPS = [
  'Nursery', 'Reception',
  'Year 1','Year 2','Year 3','Year 4','Year 5','Year 6',
  'Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13',
]

const azureConfigured = !!(
  import.meta.env.VITE_AZURE_CLIENT_ID &&
  import.meta.env.VITE_AZURE_CLIENT_ID !== 'PLACEHOLDER_CLIENT_ID'
)

export default function AddPersonModal({ person, siteId, onClose, onSaved }: Props) {
  const { instance: msalInstance } = useMsal()
  const isEdit = !!person

  // Email lookup state
  const [emailInput, setEmailInput]   = useState(person?.email ?? '')
  const [lookupState, setLookupState] = useState<'idle' | 'searching' | 'found' | 'not_found' | 'no_azure' | 'error'>(
    isEdit ? 'found' : 'idle'
  )
  const [lookupError, setLookupError] = useState('')

  // Person fields — populated by lookup or typed manually
  const [firstName,      setFirstName]      = useState(person?.first_name ?? '')
  const [lastName,       setLastName]       = useState(person?.last_name ?? '')
  const [group,          setGroup]          = useState<PersonGroup>(person?.group ?? 'teaching_staff')
  const [department,     setDepartment]     = useState(person?.department ?? '')
  const [yearGroup,      setYearGroup]      = useState(person?.year_group ?? '')
  const [formGroup,      setFormGroup]      = useState(person?.form_group ?? '')
  const [employeeNumber, setEmployeeNumber] = useState(person?.employee_number ?? '')
  const [studentId,      setStudentId]      = useState(person?.student_id ?? '')
  const [azureOid,       setAzureOid]       = useState(person?.azure_oid ?? '')

  const [saving,       setSaving]       = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const isStaff   = ['teaching_staff', 'non_teaching_staff', 'contractor', 'governor'].includes(group)
  const isStudent = group === 'student'
  const canSave   = firstName.trim() && lastName.trim() && emailInput.trim()

  async function handleLookup() {
    if (!emailInput.trim()) return

    if (!azureConfigured) {
      setLookupState('no_azure')
      return
    }

    setLookupState('searching')
    setLookupError('')
    try {
      const user = await findUserByEmail(msalInstance, emailInput.trim())
      if (user) {
        setFirstName(user.givenName?.trim()  || user.displayName?.split(' ')[0] || '')
        setLastName(user.surname?.trim()     || user.displayName?.split(' ').slice(1).join(' ') || '')
        setDepartment(user.department ?? '')
        setAzureOid(user.id)
        setLookupState('found')
        toast.success('User found in Azure AD')
      } else {
        setLookupState('not_found')
      }
    } catch (err: any) {
      setLookupError(err?.message ?? 'Lookup failed')
      setLookupState('error')
    }
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)

    const payload = {
      site_id:         siteId,
      group,
      first_name:      firstName.trim(),
      last_name:       lastName.trim(),
      email:           emailInput.trim(),
      department:      isStaff   ? (department.trim()     || null) : null,
      year_group:      isStudent ? (yearGroup.trim()      || null) : null,
      form_group:      isStudent ? (formGroup.trim()      || null) : null,
      employee_number: isStaff   ? (employeeNumber.trim() || null) : null,
      student_id:      isStudent ? (studentId.trim()      || null) : null,
      azure_oid:       azureOid  || null,
      is_active:       true,
    }

    if (isEdit && person) {
      const { error } = await supabase.from('persons').update(payload).eq('id', person.id)
      if (error) { toast.error('Failed to update'); setSaving(false); return }
      toast.success(`${firstName} updated`)
    } else {
      const { error } = await supabase.from('persons').insert(payload)
      if (error) { toast.error('Failed to add person'); setSaving(false); return }
      toast.success(`${firstName} added`)
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  async function handleDeactivate() {
    if (!person) return
    setDeactivating(true)
    const { error } = await supabase.from('persons').update({ is_active: false }).eq('id', person.id)
    if (error) { toast.error('Failed to deactivate'); setDeactivating(false); return }
    toast.success(`${person.first_name} archived`)
    setDeactivating(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />

      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-brand-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Edit Person' : 'Add Person'}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-5">

          {/* ── Step 1: Email lookup ── */}
          <div>
            <label className="label">
              Email address <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="email"
                placeholder="john@gardenerschools.com"
                value={emailInput}
                onChange={e => {
                  setEmailInput(e.target.value)
                  if (lookupState !== 'idle') setLookupState('idle')
                }}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                autoFocus={!isEdit}
                disabled={isEdit}
              />
              {!isEdit && (
                <button
                  onClick={handleLookup}
                  disabled={!emailInput.trim() || lookupState === 'searching'}
                  className="btn-primary px-3 py-2 disabled:opacity-40 flex-shrink-0"
                  title="Look up in Azure AD"
                >
                  {lookupState === 'searching'
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Search size={16} />
                  }
                </button>
              )}
            </div>

            {/* Lookup feedback */}
            {lookupState === 'found' && !isEdit && (
              <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={12} /> Found in Azure AD — details filled automatically
              </p>
            )}
            {lookupState === 'not_found' && (
              <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle size={12} /> Not found in Azure AD — fill in details manually below
              </p>
            )}
            {lookupState === 'no_azure' && (
              <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                <AlertTriangle size={12} /> Azure AD not configured — fill in details manually
              </p>
            )}
            {lookupState === 'error' && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle size={12} /> {lookupError || 'Lookup failed — fill in manually'}
              </p>
            )}
            {isEdit && person?.azure_oid && (
              <p className="mt-1.5 text-xs text-blue-500 flex items-center gap-1">
                <AlertTriangle size={12} /> Synced from Azure AD — manual edits may be overwritten on next sync
              </p>
            )}
          </div>

          {/* ── Step 2: Name (auto-filled or manual) ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name <span className="text-red-400">*</span></label>
              <input
                className="input"
                placeholder="John"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Last name <span className="text-red-400">*</span></label>
              <input
                className="input"
                placeholder="Smith"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
          </div>

          {/* ── Step 3: Group (always manual) ── */}
          <div>
            <label className="label">Group <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-1 gap-1.5">
              {GROUPS.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGroup(g.value)}
                  className={`text-left px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    group === g.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Staff extras ── */}
          {isStaff && (
            <div className="space-y-3">
              <div>
                <label className="label">Department <span className="text-gray-400 font-normal">(optional)</span></label>
                <input className="input" placeholder="e.g. Mathematics, IT Support" value={department} onChange={e => setDepartment(e.target.value)} />
              </div>
              <div>
                <label className="label">Employee Number <span className="text-gray-400 font-normal">(optional)</span></label>
                <input className="input" placeholder="EMP001" value={employeeNumber} onChange={e => setEmployeeNumber(e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Student extras ── */}
          {isStudent && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Year Group</label>
                  <select className="input" value={yearGroup} onChange={e => setYearGroup(e.target.value)}>
                    <option value="">— Select —</option>
                    {UK_YEAR_GROUPS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Form / Class</label>
                  <input className="input" placeholder="7A, 10B…" value={formGroup} onChange={e => setFormGroup(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Student ID <span className="text-gray-400 font-normal">(optional)</span></label>
                <input className="input" placeholder="STU001" value={studentId} onChange={e => setStudentId(e.target.value)} />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-2 sticky bottom-0 bg-white">
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="btn-primary w-full justify-center"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Person'}
          </button>
          {isEdit && (
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              {deactivating && <Loader2 size={14} className="animate-spin" />}
              Deactivate &amp; Archive
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
