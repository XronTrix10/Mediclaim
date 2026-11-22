import { Link, NavLink, Outlet, Navigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import Logo from '../../components/Logo'
import { authApi } from '../../api/auth'
import { avatar } from '../../lib/ui'
import UserMenu from '../../components/UserMenu'

interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/app/doctor', label: 'Overview', icon: 'home', end: true },
  { to: '/app/doctor/patients', label: 'My Patients', icon: 'users' },
  { to: '/app/doctor/request-access', label: 'Request Access', icon: 'shield' },
  { to: '/app/doctor/access-history', label: 'Access History', icon: 'clock' },
]

function DoctorSidebar() {
  const user = authApi.getCurrentUser()
  const initials = (name: string) =>
    name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] min-[901px]:sticky min-[901px]:top-0 min-[901px]:flex min-[901px]:h-dvh min-[901px]:flex-col min-[901px]:gap-7 min-[901px]:border-t-0 min-[901px]:border-r min-[901px]:px-4.5 min-[901px]:py-6">
      <Link to="/app/doctor" aria-label="Mediclaim doctor portal" className="hidden min-[901px]:block min-[901px]:px-2">
        <Logo />
      </Link>

      {/* Role badge */}
      <div className="hidden min-[901px]:block px-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-deep">
          <Icon name="stethoscope" size={12} />
          Practitioner Portal
        </span>
      </div>

      <nav className="flex min-[901px]:grid min-[901px]:gap-1.5" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[14px] px-2 py-2 text-[0.72rem] font-medium transition-colors hover:bg-mist min-[901px]:flex-none min-[901px]:flex-row min-[901px]:gap-3 min-[901px]:rounded-2xl min-[901px]:px-4 min-[901px]:py-3 min-[901px]:text-base ${
                isActive ? 'bg-brand-tint font-semibold text-brand-deep' : 'text-ink-soft'
              }`
            }
          >
            <Icon name={item.icon} size={20} />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto hidden items-center gap-3 rounded-[20px] bg-mist p-3 min-[901px]:flex">
        <span className={avatar}>{initials(user?.fullName ?? 'Dr')}</span>
        <div className="min-w-0">
          <strong className="block truncate text-[0.92rem] font-semibold leading-tight">{user?.fullName ?? 'Doctor'}</strong>
          <small className="block truncate text-[0.78rem] text-ink-faint">
            {user?.doctorId ? `ID: ${user.doctorId}` : 'Practitioner'}
          </small>
        </div>
      </div>
      <button
        type="button"
        onClick={async () => { await authApi.logout(); window.location.href = '/auth' }}
        className="hidden items-center gap-2.5 rounded-[14px] px-4 py-2.5 text-[0.9rem] text-ink-faint transition-colors hover:bg-mist hover:text-ink min-[901px]:flex text-left cursor-pointer"
      >
        <Icon name="logout" size={18} />
        Sign out
      </button>
    </aside>
  )
}

export default function DoctorLayout() {
  const user = authApi.getCurrentUser()

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (user.role !== 'practitioner' && (user as any).role !== 'doctor' && user.role !== 'admin') {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-mist min-[901px]:grid-cols-[268px_minmax(0,1fr)]">
      <DoctorSidebar />
      <div className="min-w-0">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/90 px-4 pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2.5 backdrop-blur-md min-[901px]:hidden">
          <Link to="/app/doctor" aria-label="Mediclaim doctor portal"><Logo size={30} /></Link>
          <UserMenu />
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
