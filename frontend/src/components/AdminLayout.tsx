import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import Logo from './Logo'
import Icon from './Icon'
import { authApi } from '../api/auth'

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  const isAuth = authApi.isAuthenticated()
  const isAdmin = authApi.isAdmin()

  if (!isAuth || !isAdmin) {
    return <Navigate to="/auth/admin" state={{ from: location.pathname }} replace />
  }

  const handleMobileSignOut = async () => {
    await authApi.logout()
    navigate('/auth/admin')
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-mist min-[901px]:grid-cols-[268px_minmax(0,1fr)]">
      <AdminSidebar />
      <div className="min-w-0">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/90 px-4 pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2.5 backdrop-blur-md min-[901px]:hidden">
          <Link to="/admin" aria-label="Admin overview">
            <Logo size={30} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-tint px-3 py-1 text-[0.78rem] font-semibold text-brand-deep">
              Admin
            </span>
            <button
              type="button"
              onClick={handleMobileSignOut}
              className="p-1.5 text-ink-faint hover:text-ink cursor-pointer"
              aria-label="Sign out"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
        <main className="px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 min-[901px]:px-10 min-[901px]:pt-9 min-[901px]:pb-16">
          <div className="mx-auto max-w-270">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
