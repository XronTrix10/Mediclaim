import { Link, NavLink } from 'react-router-dom'
import Icon from './Icon'
import type { IconName } from './Icon'
import Logo from './Logo'
import { patient } from '../data/mock'
import { initials } from '../lib/format'
import { avatar } from '../lib/ui'

interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

const defaultNavItems: NavItem[] = [
  { to: '/app', label: 'Overview', icon: 'home', end: true },
  { to: '/app/timeline', label: 'Timeline', icon: 'timeline' },
  { to: '/app/records', label: 'Records', icon: 'file' },
  { to: '/app/access', label: 'Access', icon: 'shield' },
]

interface SidebarProps {
  navItems?: NavItem[]
  patientName?: string
  mediclaimId?: string
}

export default function Sidebar({
  navItems = defaultNavItems,
  patientName = patient.name,
  mediclaimId = patient.mediclaimId,
}: SidebarProps) {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 flex h-auto flex-row gap-0 border-t border-line bg-white px-2.5 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] min-[901px]:sticky min-[901px]:top-0 min-[901px]:h-screen min-[901px]:flex-col min-[901px]:gap-7 min-[901px]:border-r min-[901px]:border-t-0 min-[901px]:px-[18px] min-[901px]:py-6">
      <Link to="/app" aria-label="Mediclaim overview" className="hidden min-[901px]:block min-[901px]:px-2">
        <Logo />
      </Link>
      <nav className="flex w-full justify-around min-[901px]:grid min-[901px]:gap-1.5" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-[14px] px-3.5 py-2 text-[0.74rem] font-medium transition-colors hover:bg-mist min-[901px]:flex-row min-[901px]:gap-3 min-[901px]:rounded-2xl min-[901px]:px-4 min-[901px]:py-3 min-[901px]:text-base ${isActive ? 'bg-brand-tint font-semibold text-brand-deep' : 'text-ink-soft'
              }`
            }
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto hidden items-center gap-3 rounded-[20px] bg-mist p-3 min-[901px]:flex">
        <span className={avatar}>{initials(patientName)}</span>
        <div className="min-w-0">
          <strong className="block truncate text-[0.92rem] font-semibold leading-[1.25]">{patientName}</strong>
          <small className="block truncate text-[0.78rem] text-ink-faint">ID {mediclaimId}</small>
        </div>
      </div>
      <Link
        to="/auth"
        className="hidden items-center gap-2.5 rounded-[14px] px-4 py-2.5 text-[0.9rem] text-ink-faint transition-colors hover:bg-mist hover:text-ink min-[901px]:flex"
      >
        <Icon name="logout" size={18} />
        Sign out
      </Link>
    </aside>
  )
}