import { Link } from 'react-router-dom'
import Icon from '../Icon'
import { cardTitle } from '../../lib/ui'
import { initials } from '../../lib/format'
import type { AccessGrant } from '../../types'

interface ActiveAccessCardProps {
  grants: AccessGrant[]
  onRevoke?: (grantId: string) => void
}

export default function ActiveAccessCard({ grants, onRevoke }: ActiveAccessCardProps) {
  return (
    <section className="rounded-[26px] bg-brand-tint p-6" aria-labelledby="access-card-h">
      <div className={`${cardTitle} !text-[1.15rem] mb-3`}>
        <div className="flex items-center gap-2">
          <Icon name="shield" size={18} className="text-brand" />
          <h2 id="access-card-h">Doctor Access</h2>
        </div>
        <Link
          className="font-sans text-[0.85rem] font-semibold text-brand hover:underline hover:underline-offset-[3px]"
          to="/app/access"
        >
          Manage grants →
        </Link>
      </div>

      <p className="mb-3 text-xs text-ink-soft">
        Doctors see only relevant records for a few hours. Access automatically expires.
      </p>

      {grants.length === 0 ? (
        <div className="rounded-[16px] bg-white/70 p-4 text-center">
          <p className="text-xs font-semibold text-ink">No active doctor access</p>
          <p className="mt-0.5 text-[0.76rem] text-ink-faint">
            When you visit a clinic or hospital, approve time-bound access here.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {grants.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-2.5 rounded-[16px] bg-white p-3 shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-tint text-xs font-semibold text-brand-deep">
                  {initials(g.name)}
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-[0.86rem] font-semibold text-ink">{g.name}</strong>
                  <small className="block truncate text-[0.74rem] text-ink-faint">{g.role}</small>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-[0.72rem] font-semibold text-brand-deep whitespace-nowrap">
                  <Icon name="clock" size={12} />
                  {g.remaining}
                </span>
                {onRevoke && (
                  <button
                    type="button"
                    className="p-1 text-ink-faint hover:text-allergy text-xs font-medium"
                    title="Revoke access"
                    onClick={() => onRevoke(g.id)}
                  >
                    Revoke
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

