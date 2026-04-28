import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthContext'

// Layouts
import AppShell from '@/components/layout/AppShell'
import KioskLayout from '@/components/layout/KioskLayout'

// Auth
import LoginPage from '@/pages/auth/LoginPage'

// Kiosk
import KioskHome from '@/pages/kiosk/KioskHome'
import KioskSignIn from '@/pages/kiosk/KioskSignIn'
import KioskSignOut from '@/pages/kiosk/KioskSignOut'
import StaffCheckin from '@/pages/kiosk/flows/StaffCheckin'
import StudentCheckin from '@/pages/kiosk/flows/StudentCheckin'
import VisitorCheckin from '@/pages/kiosk/flows/VisitorCheckin'
import DBSCheckin from '@/pages/kiosk/flows/DBSCheckin'
import StaffCheckout from '@/pages/kiosk/flows/StaffCheckout'
import StudentCheckout from '@/pages/kiosk/flows/StudentCheckout'
import VisitorCheckout from '@/pages/kiosk/flows/VisitorCheckout'

// Reception
import ReceptionDashboard from '@/pages/reception/ReceptionDashboard'
import VisitorQueue from '@/pages/reception/VisitorQueue'

// Admin
import AdminDashboard from '@/pages/admin/AdminDashboard'
import PeopleManagement from '@/pages/admin/PeopleManagement'
import SafeguardingPage from '@/pages/admin/SafeguardingPage'
import ReportsPage from '@/pages/admin/ReportsPage'
import AuditLogPage from '@/pages/admin/AuditLogPage'
import SettingsPage from '@/pages/admin/SettingsPage'
import EvacuationPage from '@/pages/admin/EvacuationPage'
import CustomersPage from '@/pages/admin/CustomersPage'

// Attendance
import AttendanceDashboard from '@/pages/attendance/AttendanceDashboard'
import RegisterView from '@/pages/attendance/RegisterView'
import AbsenceManager from '@/pages/attendance/AbsenceManager'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// After Microsoft 365 OAuth, Supabase redirects back to the site root.
// This component checks whether the user is authenticated and routes accordingly,
// so we don't need to whitelist /admin in Supabase's redirect URLs list.
function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  return <Navigate to={user ? '/admin' : '/kiosk'} replace />
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading Ventra...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Root → kiosk for guests, /admin for authenticated users (handles OAuth redirect) */}
      <Route path="/" element={<RootRedirect />} />

      {/* Admin login — subtle, not linked from homepage */}
      <Route path="/login" element={<LoginPage />} />

      {/* Kiosk — public facing, no auth required */}
      <Route path="/kiosk" element={<KioskLayout />}>
        <Route index element={<KioskHome />} />

        {/* Sign In type selector + flows */}
        <Route path="signin" element={<KioskSignIn />} />
        <Route path="signin/staff" element={<StaffCheckin />} />
        <Route path="signin/student" element={<StudentCheckin />} />
        <Route path="signin/visitor" element={<VisitorCheckin />} />
        <Route path="signin/dbs" element={<DBSCheckin />} />

        {/* Sign Out type selector + flows */}
        <Route path="signout" element={<KioskSignOut />} />
        <Route path="signout/staff" element={<StaffCheckout />} />
        <Route path="signout/student" element={<StudentCheckout />} />
        <Route path="signout/visitor" element={<VisitorCheckout />} />
      </Route>

      {/* Authenticated app shell */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="people" element={<PeopleManagement />} />
        <Route path="safeguarding" element={<SafeguardingPage />} />
        <Route path="evacuation" element={<EvacuationPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="customers" element={<CustomersPage />} />
      </Route>

      <Route
        path="/reception/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<ReceptionDashboard />} />
        <Route path="visitors" element={<VisitorQueue />} />
      </Route>

      <Route
        path="/attendance/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AttendanceDashboard />} />
        <Route path="register" element={<RegisterView />} />
        <Route path="absences" element={<AbsenceManager />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/kiosk" replace />} />
    </Routes>
  )
}
