import { useNavigate } from 'react-router-dom'
import { UserPlus, LogOut } from 'lucide-react'

export default function KioskHome() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center gap-6 pt-6">
      <div className="text-center mb-2">
        <h2 className="text-4xl font-bold text-white">Welcome</h2>
        <p className="text-brand-200 text-lg mt-1">Please select an option below</p>
      </div>

      <div className="grid grid-cols-1 gap-4 w-full">
        <button
          onClick={() => navigate('/kiosk/signin')}
          className="btn-kiosk bg-white text-brand-600 hover:bg-brand-50 shadow-xl w-full"
        >
          <UserPlus size={36} />
          <div className="text-left">
            <p className="font-bold text-2xl">Sign In</p>
            <p className="text-sm font-normal text-brand-400">Start your visit or working day</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/kiosk/signout')}
          className="btn-kiosk bg-white/15 text-white border-2 border-white/30 hover:bg-white/20 w-full"
        >
          <LogOut size={36} />
          <div className="text-left">
            <p className="font-bold text-2xl">Sign Out</p>
            <p className="text-sm font-normal text-brand-200">End your visit or working day</p>
          </div>
        </button>
      </div>
    </div>
  )
}
