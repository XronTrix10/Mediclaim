import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { card, button } from '../../lib/ui'
import { authApi } from '../../api/auth'
import { getAuthorizedPatients } from '../../api/doctor'
import { getPractitioners } from '../../api/hospital'
import type { DoctorPatientSummary } from '../../api/doctor'
import type { PractitionerSummary } from '../../api/hospital'

interface StatCardProps {
  icon: IconName
  value: number | string
  label: string
  note: string
  tint: string
  iconColor: string
}

function StatCard({ icon, value, label, note, tint, iconColor }: StatCardProps) {
  return (
    <div className={`flex flex-col gap-2.5 rounded-[20px] p-4 sm:p-5 ${tint}`}>
      <div className="flex items-center justify-between gap-2">
        <strong className="font-display text-[2rem] leading-none font-medium">{value}</strong>
        <span className={`grid size-9 shrink-0 place-items-center rounded-[11px] bg-white shadow-xs ${iconColor}`}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div>
        <span className="block text-[0.84rem] font-semibold leading-tight text-ink">{label}</span>
        <small className="mt-0.5 block text-[0.76rem] leading-snug text-ink-soft">{note}</small>
      </div>
    </div>
  )
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HospitalDashboard() {
  const user = authApi.getCurrentUser()
  const [patients, setPatients] = useState<DoctorPatientSummary[]>([])
  const [practitioners, setPractitioners] = useState<PractitionerSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getAuthorizedPatients().catch(() => [] as DoctorPatientSummary[]),
      getPractitioners().then((r) => r.practitioners).catch(() => [] as PractitionerSummary[]),
    ]).then(([p, pr]) => {
      setPatients(p)
      setPractitioners(pr)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="grid gap-7">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[1.9rem] font-semibold leading-tight text-ink">
            {user?.fullName ?? 'Organization'} Dashboard
          </h1>
          {user?.hospitalId && (
            <span className="font-mono text-sm font-semibold text-brand bg-brand-tint px-3 py-1 rounded-xl">
              Hospital ID: {user.hospitalId}
            </span>
          )}
        </div>
        <p className="mt-1 text-[0.95rem] text-ink-soft">Manage your patients and practitioner network.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon="users" value={loading ? '—' : patients.length} label="Active Patients" note="Patients with active consent" tint="bg-brand-tint" iconColor="text-brand" />
        <StatCard icon="stethoscope" value={loading ? '—' : practitioners.length} label="Practitioners" note="Registered doctors" tint="bg-mist" iconColor="text-brand-deep" />
        <StatCard icon="shield" value={loading ? '—' : patients.length} label="Consent Grants" note="Active access grants" tint="bg-mist" iconColor="text-ink-soft" />
      </div>

      {/* Quick actions */}
      <div className={card}>
        <h2 className="mb-4 text-[1.1rem] font-semibold text-ink">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/app/hospital/patients" className={`${button('soft', 'md')} justify-start gap-3 rounded-2xl px-4 py-3`}>
            <Icon name="users" size={18} />
            View All Patients
          </Link>
          <Link to="/app/hospital/practitioners" className={`${button('ghost', 'md')} justify-start gap-3 rounded-2xl px-4 py-3`}>
            <Icon name="stethoscope" size={18} />
            Manage Practitioners
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent patients */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[1.1rem] font-semibold text-ink">Recent Patients</h2>
            <Link to="/app/hospital/patients" className="text-sm font-semibold text-brand hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-14 rounded-2xl bg-mist animate-pulse" />)}</div>
          ) : patients.length === 0 ? (
            <div className="rounded-[18px] border-2 border-dashed border-line-strong px-5 py-8 text-center">
              <Icon name="users" size={28} className="mx-auto text-ink-faint" />
              <p className="mt-2 text-sm text-ink-soft">No active patient consents yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {patients.slice(0, 5).map((p) => (
                <li key={p.patientProfileId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{p.fullName}</p>
                    <p className="text-xs text-ink-faint">ID {p.mediclaimId}</p>
                  </div>
                  <span className="text-xs text-ink-faint shrink-0">Expires {formatDate(p.expiresAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Practitioners */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[1.1rem] font-semibold text-ink">Practitioners</h2>
            <Link to="/app/hospital/practitioners" className="text-sm font-semibold text-brand hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-14 rounded-2xl bg-mist animate-pulse" />)}</div>
          ) : practitioners.length === 0 ? (
            <div className="rounded-[18px] border-2 border-dashed border-line-strong px-5 py-8 text-center">
              <Icon name="stethoscope" size={28} className="mx-auto text-ink-faint" />
              <p className="mt-2 text-sm text-ink-soft">No practitioners registered yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {practitioners.slice(0, 5).map((pr) => (
                <li key={pr.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{pr.fullName}</p>
                    <p className="text-xs text-ink-faint">{pr.specialization ?? 'General'}</p>
                  </div>
                  <span className="text-xs text-ink-faint shrink-0 font-mono">{pr.registrationNumber}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

