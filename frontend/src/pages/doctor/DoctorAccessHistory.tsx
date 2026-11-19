import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { card, button, emptyBox } from '../../lib/ui'
import { getDoctorAccessRequests, type DoctorAccessRequestItem } from '../../api/doctor'

type FilterStatus = 'all' | 'pending' | 'approved' | 'expired' | 'denied'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-[#fff3cd] text-[#856404]',
    approved: 'bg-brand-tint text-brand-deep',
    active: 'bg-brand-tint text-brand-deep',
    expired: 'bg-mist text-ink-faint',
    denied: 'bg-allergy-tint text-allergy-ink',
    rejected: 'bg-allergy-tint text-allergy-ink',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] ?? 'bg-mist text-ink-soft'}`}>
      {status}
    </span>
  )
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function DoctorAccessHistory() {
  const [requests, setRequests] = useState<DoctorAccessRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')

  useEffect(() => {
    getDoctorAccessRequests('all')
      .then(setRequests)
      .catch(() => setError('Failed to load access history.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all'
    ? requests
    : requests.filter((r) => r.status === filter || (filter === 'approved' && r.status === 'active'))

  const counts: Record<FilterStatus, number> = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved' || r.status === 'active').length,
    expired: requests.filter((r) => r.status === 'expired').length,
    denied: requests.filter((r) => r.status === 'denied' || r.status === 'rejected').length,
  }

  const filters: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'expired', label: 'Expired' },
    { value: 'denied', label: 'Denied' },
  ]

  return (
    <div className="grid gap-7">
      <PageHeader
        title="Access History"
        subtitle="All access requests you've sent to patients."
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              filter === f.value
                ? 'border-brand bg-brand-tint text-brand-deep font-semibold'
                : 'border-line-strong bg-white text-ink-soft hover:border-brand/50'
            }`}
          >
            {f.label}
            {counts[f.value] > 0 && (
              <span className="ml-2 rounded-full bg-white/60 px-1.5 text-xs">{counts[f.value]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-[20px] bg-white animate-pulse border border-line" />)}
        </div>
      ) : error ? (
        <div className={`${emptyBox} text-allergy-ink`}>
          <Icon name="alert" size={28} className="mx-auto" />
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={emptyBox}>
          <Icon name="clock" size={32} className="mx-auto text-ink-faint" />
          <p className="mt-3 text-sm font-medium text-ink">
            {filter === 'all' ? 'No access requests yet.' : `No ${filter} requests.`}
          </p>
        </div>
      ) : (
        <div className={card}>
          <ul className="divide-y divide-line">
            {filtered.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-ink">Patient {r.patientMediclaimId}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.purpose && <p className="mt-0.5 text-sm text-ink-soft">{r.purpose}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.scope?.map((s) => (
                      <span key={s} className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-medium text-ink-soft capitalize">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-ink-faint space-y-1">
                  <p>Requested: {formatDate(r.requestedAt)}</p>
                  {r.expiresAt && <p>Expires: {formatDate(r.expiresAt)}</p>}
                  <p>{r.durationHours}h access window</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

