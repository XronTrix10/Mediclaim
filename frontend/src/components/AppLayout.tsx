import { Navigate } from 'react-router-dom'
import { Link, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Logo from './Logo'
import UserMenu from './UserMenu'
import HealthDataProvider from '../store/HealthDataProvider'
import { authApi } from '../api/auth'

function PatientLayout() {
  return (
    <HealthDataProvider>
      <div className="grid min-h-dvh grid-cols-1 bg-mist min-[901px]:grid-cols-[268px_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-w-0">
          {/* Small screens: the sidebar becomes a bottom tab bar, so identity and sign out live up here. */}
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/90 px-4 pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2.5 backdrop-blur-md min-[901px]:hidden">
            <Link to="/app" aria-label="Mediclaim overview">
              <Logo size={30} />
            </Link>
            <UserMenu />
          </div>
          <main className="px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 min-[901px]:px-10 min-[901px]:pt-9 min-[901px]:pb-16">
            <div className="mx-auto max-w-270">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </HealthDataProvider>
  )
}

/**
 * AppLayout — dispatches to PatientLayout, DoctorLayout, or HospitalLayout
 * based on the JWT role stored in localStorage.
 *
 * Doctor and Hospital layouts are rendered via their own nested route trees
 * in App.tsx, so AppLayout only needs to guard against mis-routed users.
 */
export default function AppLayout() {
  const user = authApi.getCurrentUser()

  // Not logged in → redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />
  }

  // Admin → redirect to admin portal
  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  // Patient (default)
  return <PatientLayout />
}
