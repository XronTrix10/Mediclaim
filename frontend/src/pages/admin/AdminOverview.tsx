import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import Icon from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { getAdminStats } from '../../api/admin'
import type { AdminStats } from '../../api/admin'

interface StatTileProps {
  icon: IconName
  value: number | string
  label: string
  note: string
  tint: string
  iconColor: string
}

function StatTile({ icon, value, label, note, tint, iconColor }: StatTileProps) {
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

interface QuickLinkProps {
  to: string
  icon: IconName
  label: string
  description: string
}

function QuickLink({ to, icon, label, description }: QuickLinkProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-[18px] border border-line bg-white p-4 shadow-soft transition-shadow hover:shadow-md"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-brand-tint text-brand">
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0">
        <span className="block font-semibold text-ink">{label}</span>
        <span className="block text-[0.84rem] text-ink-faint">{description}</span>
      </div>
      <Icon name="chevron-right" size={18} className="ml-auto shrink-0 text-ink-faint" />
    </Link>
  )
}

function SkeletonTile() {
  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-mist p-4 sm:p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-16 rounded-lg bg-line" />
        <div className="size-9 rounded-[11px] bg-line" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3.5 w-24 rounded bg-line" />
        <div className="h-3 w-32 rounded bg-line" />
      </div>
    </div>
  )
}

export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => setError('Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Admin Overview" subtitle="System health at a glance" />

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-[18px] border border-allergy-tint bg-allergy-tint/60 px-4 py-3 text-allergy-ink">
          <Icon name="alert" size={18} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonTile key={i} />)
        ) : stats ? (
          <>
            <StatTile
              icon="users"
              value={stats.totalPatients}
              label="Total Patients"
              note="All registered users"
              tint="bg-brand-tint"
              iconColor="text-brand"
            />
            <StatTile
              icon="clock"
              value={stats.pendingApprovals}
              label="Pending Approvals"
              note="Awaiting verification"
              tint="bg-[#fff7e6]"
              iconColor="text-[#b45309]"
            />
            <StatTile
              icon="check"
              value={stats.approvedPatients}
              label="Approved"
              note="Verified patients"
              tint="bg-[#e8f5e9]"
              iconColor="text-[#2e7d32]"
            />
            <StatTile
              icon="stethoscope"
              value={stats.totalPractitioners}
              label="Practitioners"
              note="Onboarded doctors"
              tint="bg-[#ede7f6]"
              iconColor="text-[#5e35b1]"
            />
            <StatTile
              icon="heart"
              value={stats.totalOrganizations}
              label="Organizations"
              note="Registered hospitals"
              tint="bg-[#fce4ec]"
              iconColor="text-[#c62828]"
            />
            <StatTile
              icon="alert"
              value={stats.totalEmergencyEvents}
              label="Emergency Events"
              note="Break-glass accesses"
              tint="bg-[#fff3e0]"
              iconColor="text-[#e65100]"
            />
          </>
        ) : null}
      </div>

      {/* Quick navigation */}
      <h2 className="mb-4 text-[1.1rem] font-semibold text-ink">Quick Navigation</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink
          to="/admin/verifications"
          icon="check"
          label="Patient Verifications"
          description="Review and approve new registrations"
        />
        <QuickLink
          to="/admin/patients"
          icon="users"
          label="All Patients"
          description="Browse the patient directory"
        />
        <QuickLink
          to="/admin/organizations"
          icon="stethoscope"
          label="Organizations"
          description="Manage healthcare organizations"
        />
        <QuickLink
          to="/admin/practitioners"
          icon="user"
          label="Practitioners"
          description="Onboard and manage doctors"
        />
        <QuickLink
          to="/admin/emergency"
          icon="alert"
          label="Emergency Events"
          description="Audit log of break-glass accesses"
        />
      </div>
    </div>
  )
}
