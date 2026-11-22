import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { card, button } from '../../lib/ui'
import { authApi } from '../../api/auth'
import {
  getAuthorizedPatients,
  getDoctorAccessRequests,
  type DoctorPatientSummary,
  type DoctorAccessRequestItem,
} from '../../api/doctor'

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

export default function DoctorDashboard() {
  const user = authApi.getCurrentUser()
  const [patients, setPatients] = useState<DoctorPatientSummary[]>([])
  const [requests, setRequests] = useState<DoctorAccessRequestItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getAuthorizedPatients().catch(() => [] as DoctorPatientSummary[]),
      getDoctorAccessRequests('all').catch(() => [] as DoctorAccessRequestItem[]),
    ]).then(([p, r]) => {
      setPatients(p)
      setRequests(r)
    }).finally(() => setLoading(false))
  }, [])

  const pending = requests.filter((r) => r.status === 'pending')
  const recentPatients = patients.slice(0, 5)

  return (
    <div className="grid gap-7">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[1.9rem] font-semibold leading-tight text-ink">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            Dr. {user?.fullName?.split(' ')[0] ?? 'Doctor'} 👋
          </h1>
          {user?.doctorId && (
            <span className="font-mono text-sm font-semibold text-brand bg-brand-tint px-3 py-1 rounded-xl">
              Dr ID: {user.doctorId}
            </span>
          )}
        </div>
        <p className="mt-1 text-[0.95rem] text-ink-soft">Here's an overview of your practitioner dashboard.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="users" value={loading ? '—' : patients.length} label="Active Patients" note="Patients with active consent" tint="bg-brand-tint" iconColor="text-brand" />
        <StatCard icon="clock" value={loading ? '—' : pending.length} label="Pending Requests" note="Awaiting patient approval" tint="bg-[#fff3cd]" iconColor="text-[#856404]" />
        <StatCard icon="shield" value={loading ? '—' : requests.filter((r) => r.status === 'approved' || r.status === 'active').length} label="Approved Grants" note="Total active access grants" tint="bg-mist" iconColor="text-brand-deep" />
        <StatCard icon="stethoscope" value={loading ? '—' : requests.length} label="Total Requests" note="All access requests sent" tint="bg-mist" iconColor="text-ink-soft" />
      </div>

      {/* Quick actions */}
      <div className={card}>
        <h2 className="mb-4 text-[1.1rem] font-semibold text-ink">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/app/doctor/request-access" className={`${button('soft', 'md')} justify-start gap-3 rounded-2xl px-4 py-3`}>
            <Icon name="search" size={18} />
            Search & Request Patient Access
          </Link>
          <Link to="/app/doctor/patients" className={`${button('ghost', 'md')} justify-start gap-3 rounded-2xl px-4 py-3`}>
            <Icon name="users" size={18} />
            View My Patients
          </Link>
          <Link to="/app/doctor/access-history" className={`${button('ghost', 'md')} justify-start gap-3 rounded-2xl px-4 py-3`}>
            <Icon name="clock" size={18} />
            Access History
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent patients */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[1.1rem] font-semibold text-ink">Recent Patients</h2>
            <Link to="/app/doctor/patients" className="text-sm font-semibold text-brand hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-2xl bg-mist animate-pulse" />)}
            </div>
          ) : recentPatients.length === 0 ? (
            <div className="rounded-[18px] border-2 border-dashed border-line-strong px-5 py-8 text-center">
              <Icon name="users" size={28} className="mx-auto text-ink-faint" />
              <p className="mt-2 text-sm text-ink-soft">No patients yet. Request access to get started.</p>
              <Link to="/app/doctor/request-access" className={`${button('soft', 'sm')} mt-3`}>Request Access</Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recentPatients.map((p) => (
                <li key={p.patientProfileId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{p.fullName}</p>
                    <p className="text-xs text-ink-faint">ID {p.mediclaimId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-ink-faint">Expires {formatDate(p.expiresAt)}</span>
                    <Link to={`/app/doctor/patients/${p.mediclaimId}`} className={`${button('soft', 'sm')}`}>View</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending requests */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[1.1rem] font-semibold text-ink">Recent Access Requests</h2>
            <Link to="/app/doctor/access-history" className="text-sm font-semibold text-brand hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-mist animate-pulse" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-[18px] border-2 border-dashed border-line-strong px-5 py-8 text-center">
              <Icon name="shield" size={28} className="mx-auto text-ink-faint" />
              <p className="mt-2 text-sm text-ink-soft">No access requests yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {requests.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      Patient {r.patientMediclaimId}
                    </p>
                    <p className="text-xs text-ink-faint">{r.purpose ?? 'General consultation'}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

