import { useNavigate } from 'react-router-dom'
import { Users, GraduationCap, UserCheck, ChevronLeft } from 'lucide-react'

const SIGN_OUT_OPTIONS = [
  {
    key: 'staff',
    label: 'Staff',
    subtitle: 'Teaching & non-teaching staff',
    icon: <Users size={32} />,
    color: 'bg-blue-500',
  },
  {
    key: 'student',
    label: 'Student',
    subtitle: 'Pupils & learners',
    icon: <GraduationCap size={32} />,
    color: 'bg-green-500',
  },
  {
    key: 'visitor',
    label: 'Visitor',
    subtitle: 'Parents, contractors & guests',
    icon: <UserCheck size={32} />,
    color: 'bg-amber-500',
  },
]

export default function KioskSignOut() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/kiosk')}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">Sign Out</h2>
          <p className="text-brand-200 text-sm">Who are you?</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {SIGN_OUT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => navigate(`/kiosk/signout/${opt.key}`)}
            className="bg-white rounded-2xl p-5 text-left hover:shadow-lg active:scale-95 transition-all flex items-center gap-4 min-h-[80px]"
          >
            <div className={`w-12 h-12 rounded-xl ${opt.color} flex items-center justify-center text-white flex-shrink-0`}>
              {opt.icon}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">{opt.label}</p>
              <p className="text-sm text-gray-400">{opt.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
