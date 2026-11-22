import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { card, input, emptyBox, avatar } from '../../lib/ui'
import { getPractitioners, type PractitionerSummary } from '../../api/hospital'

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HospitalPractitioners() {
  const [practitioners, setPractitioners] = useState<PractitionerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getPractitioners()
      .then((r) => setPractitioners(r.practitioners))
      .catch(() => setError('Failed to load practitioners.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = practitioners.filter(
    (p) =>
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (p.specialization ?? '').toLowerCase().includes(search.toLowerCase()) ||
      p.registrationNumber.includes(search) ||
      (p.doctorId ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="grid gap-7">
      <PageHeader
        title="Practitioners"
        subtitle="Doctors and clinicians registered under your organization."
      />

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-faint">
          <Icon name="search" size={18} />
        </span>
        <input
          className={`${input} pl-11`}
          placeholder="Search by name, specialization or registration number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-[26px] bg-white animate-pulse border border-line" />)}
        </div>
      ) : error ? (
        <div className={`${emptyBox} text-allergy-ink`}>
          <Icon name="alert" size={28} className="mx-auto" />
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={emptyBox}>
          <Icon name="stethoscope" size={32} className="mx-auto text-ink-faint" />
          <p className="mt-3 text-sm font-medium text-ink">
            {search ? 'No practitioners match your search.' : 'No practitioners registered.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((pr) => (
            <div key={pr.id} className={card}>
              <div className="flex items-start gap-3">
                <span className={`${avatar} shrink-0`}>
                  {pr.fullName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-ink">{pr.fullName}</p>
                    {pr.doctorId && (
                      <span className="font-mono text-xs font-semibold text-brand bg-brand-tint px-2 py-0.5 rounded-md">
                        {pr.doctorId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-faint">{pr.specialization ?? 'General Physician'}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-ink-faint">License No.</p>
                  <p className="font-medium text-ink font-mono text-xs">{pr.registrationNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint">Joined</p>
                  <p className="font-medium text-ink">{formatDate(pr.createdAt)}</p>
                </div>
                {pr.phone && (
                  <div>
                    <p className="text-xs text-ink-faint">Phone</p>
                    <p className="font-medium text-ink">{pr.phone}</p>
                  </div>
                )}
                {pr.email && (
                  <div>
                    <p className="text-xs text-ink-faint">Email</p>
                    <p className="truncate font-medium text-ink">{pr.email}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

