import { Link } from 'react-router-dom'
import Icon from '../Icon'
import CardHeader from '../CardHeader'
import { kinds } from '../../data/mock'
import { formatRemaining, initials } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { button, textLink } from '../../lib/ui'
import type { AccessGrant } from '../../types'

interface ActiveAccessCardProps {
  grants: AccessGrant[]
  onRevoke: (grantId: string) => void
}

export default function ActiveAccessCard({ grants, onRevoke }: ActiveAccessCardProps) {
  const now = useNow()

  return (
    <section className="rounded-[26px] bg-brand-tint p-5 sm:p-6" aria-labelledby="access-card-h">
      <CardHeader
        id="access-card-h"
        title="Doctor access"
        actions={
          <Link className={textLink} to="/app/access">
            Manage access
          </Link>
        }
      />
      <p className="mb-4 text-[0.85rem] text-ink-soft">
        Doctors see only the records you share, for a few hours. Access ends on its own.
      </p>

      {grants.length === 0 ? (
        <div className="rounded-[16px] bg-white/70 p-4 text-center">
          <p className="text-[0.9rem] font-semibold text-ink">No doctor has access right now</p>
          <p className="mt-0.5 text-[0.8rem] text-ink-faint">
            When you visit a clinic, approve time-limited access from the Access page.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {grants.map((g) => (
            <li key={g.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2.5 rounded-[18px] bg-white p-3.5 shadow-xs">
              <span className="grid size-10 place-items-center rounded-full bg-brand-tint text-[0.8rem] font-semibold text-brand-deep">
                {initials(g.name)}
              </span>
              <div className="min-w-0">
                <strong className="block truncate text-[0.92rem] font-semibold text-ink">{g.name}</strong>
                <small className="block text-[0.78rem] leading-snug text-ink-faint">
                  {g.scope.map((k) => kinds[k].plural.toLowerCase()).join(', ')}
                </small>
              </div>
              <div className="col-span-full flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1 text-[0.78rem] font-semibold whitespace-nowrap text-brand-deep">
                  <Icon name="clock" size={13} />
                  {formatRemaining(g.expiresAt, now)}
                </span>
                <button type="button" className={button('danger', 'sm')} onClick={() => onRevoke(g.id)}>
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
