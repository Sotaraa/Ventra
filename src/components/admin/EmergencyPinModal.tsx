import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, ShieldAlert, Trash2, Check } from 'lucide-react'
import type { Person } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  person: Person
  onClose: () => void
  onSaved: () => void
}

export default function EmergencyPinModal({ person, onClose, onSaved }: Props) {
  const hasPin = !!person.emergency_pin
  const [pin, setPin]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving]   = useState(false)

  async function savePin() {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast.error('PIN must be exactly 4 digits')
      return
    }
    if (pin !== confirm) {
      toast.error('PINs do not match')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('persons')
      .update({ emergency_pin: pin })
      .eq('id', person.id)
    setSaving(false)
    if (error) { toast.error('Failed to save PIN'); return }
    toast.success(`Emergency PIN set for ${person.first_name}`)
    onSaved()
    onClose()
  }

  async function clearPin() {
    setSaving(true)
    const { error } = await supabase
      .from('persons')
      .update({ emergency_pin: null })
      .eq('id', person.id)
    setSaving(false)
    if (error) { toast.error('Failed to clear PIN'); return }
    toast.success(`Emergency PIN removed for ${person.first_name}`)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert size={18} className="text-red-600" />
            Emergency PIN
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          {person.full_name} &bull; {hasPin ? 'PIN is set — you can replace or remove it' : 'No PIN assigned yet'}
        </p>

        {/* PIN inputs */}
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New 4-digit PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="input w-full text-center text-2xl tracking-[0.5em] font-bold"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              value={confirm}
              onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="input w-full text-center text-2xl tracking-[0.5em] font-bold"
              onKeyDown={e => e.key === 'Enter' && pin.length === 4 && savePin()}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {hasPin && (
            <button
              onClick={clearPin}
              disabled={saving}
              className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1.5 text-sm"
            >
              <Trash2 size={14} /> Remove PIN
            </button>
          )}
          <button
            onClick={savePin}
            disabled={saving || pin.length !== 4 || confirm.length !== 4}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm"
          >
            <Check size={14} />
            {saving ? 'Saving...' : hasPin ? 'Update PIN' : 'Set PIN'}
          </button>
        </div>
      </div>
    </div>
  )
}
