import { useEffect, useRef, useState, useContext } from 'react'
import Icon from './Icon'
import { HealthDataContext } from '../store/healthData'
import { avatar } from '../lib/ui'
import { initials } from '../lib/format'
import { authApi } from '../api/auth'

/** Account menu for small screens, safe across Patient, Doctor, Hospital, and Admin layouts. */
export default function UserMenu() {
  const healthCtx = useContext(HealthDataContext)
  const currentUser = authApi.getCurrentUser()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fullName = healthCtx?.profile?.fullName || currentUser?.fullName || 'User'
  const displayId =
    currentUser?.doctorId ||
    currentUser?.hospitalId ||
    healthCtx?.profile?.mediclaimId ||
    currentUser?.mediclaimId
  const role = currentUser?.role ? currentUser.role.replace('_', ' ') : ''

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`${avatar} size-10`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        {initials(fullName)}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-[20px] border border-line bg-white p-2 shadow-soft">
          <div className="px-3 py-2">
            <strong className="block truncate text-[0.95rem] font-semibold">{fullName}</strong>
            {displayId ? (
              <small className="block text-[0.8rem] text-ink-faint">
                {currentUser?.doctorId ? 'Dr ID ' : currentUser?.hospitalId ? 'Hospital ID ' : 'ID '}
                {displayId}
              </small>
            ) : role ? (
              <small className="block text-[0.8rem] text-ink-faint capitalize">{role}</small>
            ) : null}
          </div>
          <button
            type="button"
            onClick={async () => {
              await authApi.logout()
              window.location.href = '/auth'
            }}
            className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-[0.92rem] text-ink-soft transition-colors hover:bg-mist hover:text-ink text-left cursor-pointer"
          >
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
