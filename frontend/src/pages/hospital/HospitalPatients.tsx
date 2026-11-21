import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { card, input, emptyBox } from '../../lib/ui'
import { getAuthorizedPatients, type DoctorPatientSummary } from '../../api/doctor'

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HospitalPatients() {
  const [patients, setPatients] = useState<DoctorPatientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getAuthorizedPatients()
      .then(setPatients)
      .catch(() => setError('Failed to load patients.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = patients.filter(
    (p) =>
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.mediclaimId.includes(search)
  )

  return (
    <div className="grid gap-7">
      <PageHeader
        title="Patients"
        subtitle="Patients who have granted this organization access to their records."
      />

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-faint">
          <Icon name="search" size={18} />
        </span>
        <input
          className={`${input} pl-11`}
          placeholder="Search by name or Mediclaim ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 rounded-[26px] bg-white animate-pulse border border-line" />)}
        </div>
      ) : error ? (
        <div className={`${emptyBox} text-allergy-ink`}>
          <Icon name="alert" size={28} className="mx-auto" />
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={emptyBox}>
          <Icon name="users" size={32} className="mx-auto text-ink-faint" />
          <p className="mt-3 text-sm font-medium text-ink">
            {search ? 'No patients match your search.' : 'No active patient consents.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((p) => (
            <div key={p.patientProfileId} className={card}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-tint text-[0.88rem] font-semibold text-brand-deep">
                    {p.fullName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{p.fullName}</p>
                    <p className="text-xs text-ink-faint">ID {p.mediclaimId}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-ink-faint">Blood group</p>
                  <p className="font-medium text-ink">{p.bloodGroup ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint">Access expires</p>
                  <p className="font-medium text-ink">{formatDate(p.expiresAt)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-ink-faint mb-1">Consent scope</p>
                  <div className="flex flex-wrap gap-1">
                    {p.approvedScopes?.map((s) => (
                      <span key={s} className="text-xs font-medium text-brand-deep bg-brand-tint rounded-full px-2 py-0.5 capitalize">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

