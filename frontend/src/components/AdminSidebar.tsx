import { NavLink, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import type { IconName } from './Icon'
import Logo from './Logo'
import { avatar } from '../lib/ui'
import { authApi } from '../api/auth'

interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: 'home', end: true },
  { to: '/admin/verifications', label: 'Verifications', icon: 'check' },
  { to: '/admin/patients', label: 'Patients', icon: 'users' },
  { to: '/admin/organizations', label: 'Organizations', icon: 'stethoscope' },
  { to: '/admin/practitioners', label: 'Practitioners', icon: 'user' },
  { to: '/admin/emergency', label: 'Emergency Events', icon: 'alert' },
]

export default function AdminSidebar() {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await authApi.logout()
    navigate('/auth')
  }

  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] min-[901px]:sticky min-[901px]:top-0 min-[901px]:flex min-[901px]:h-dvh min-[901px]:flex-col min-[901px]:gap-7 min-[901px]:border-t-0 min-[901px]:border-r min-[901px]:px-4.5 min-[901px]:py-6">
      <div className="hidden min-[901px]:block min-[901px]:px-2">
        <Logo />
        <span className="mt-1 block text-[0.72rem] font-semibold uppercase tracking-widest text-ink-faint">
          Admin Portal
        </span>
      </div>

      <nav className="flex min-[901px]:grid min-[901px]:gap-1.5" aria-label="Admin navigation">
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
        <span className={avatar}>A</span>
        <div className="min-w-0">
          <strong className="block truncate text-[0.92rem] font-semibold leading-tight">Admin</strong>
          <small className="block truncate text-[0.78rem] text-ink-faint">System Administrator</small>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        className="hidden items-center gap-2.5 rounded-[14px] px-4 py-2.5 text-[0.9rem] text-ink-faint transition-colors hover:bg-mist hover:text-ink min-[901px]:flex text-left cursor-pointer"
      >
        <Icon name="logout" size={18} />
        Sign out
      </button>
    </aside>
  )
}
