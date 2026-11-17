import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
import { button, card, emptyBox, input, select, label as labelCls } from '../../lib/ui'
import { formatDate } from '../../lib/format'
import {
  getOrganizations,
  registerOrganization,
  getOrganizationDetail,
} from '../../api/hospital'
import type { OrganizationSummary, OrganizationCreateInput } from '../../api/hospital'

const ORG_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'diagnostic_lab', label: 'Diagnostic Lab' },
]

function typeBadge(type: string) {
  const map: Record<string, string> = {
    hospital: 'bg-brand-tint text-brand-deep',
    clinic: 'bg-[#ede7f6] text-[#5e35b1]',
    pharmacy: 'bg-[#e8f5e9] text-[#2e7d32]',
    diagnostic_lab: 'bg-[#fff7e6] text-[#b45309]',
  }
  const labels: Record<string, string> = {
    hospital: 'Hospital',
    clinic: 'Clinic',
    pharmacy: 'Pharmacy',
    diagnostic_lab: 'Diagnostic Lab',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[type] ?? 'bg-mist text-ink-soft'}`}>
      {labels[type] ?? type}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-[20px] border border-line bg-white p-5 animate-pulse space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-line" />
          <div className="h-3 w-24 rounded bg-line" />
        </div>
        <div className="h-6 w-20 rounded-full bg-line" />
      </div>
      <div className="h-3 w-32 rounded bg-line" />
      <div className="h-3 w-20 rounded bg-line" />
    </div>
  )
}

interface RegisterOrgModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function RegisterOrgModal({ open, onClose, onCreated }: RegisterOrgModalProps) {
  const [form, setForm] = useState<OrganizationCreateInput>({
    name: '',
    organizationType: 'hospital',
    registrationNumber: '',
    address: '',
    phone: '',
    email: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: keyof OrganizationCreateInput, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      await registerOrganization(form)
      onCreated()
      onClose()
      setForm({ name: '', organizationType: 'hospital', registrationNumber: '', address: '', phone: '', email: '' })
    } catch (ex: any) {
      setErr(ex?.message ?? 'Failed to register organization')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Register Organization" icon="stethoscope" size="lg" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={`${labelCls} mb-1.5 block`} htmlFor="org-name">Organization Name *</label>
          <input
            id="org-name"
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={input}
            placeholder="e.g. City General Hospital"
            data-autofocus
          />
        </div>
        <div>
          <label className={`${labelCls} mb-1.5 block`} htmlFor="org-type">Type *</label>
          <select
            id="org-type"
            value={form.organizationType}
            onChange={(e) => set('organizationType', e.target.value as any)}
            className={select}
            required
          >
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={`${labelCls} mb-1.5 block`} htmlFor="org-reg">Registration Number *</label>
          <input
            id="org-reg"
            type="text"
            required
            value={form.registrationNumber}
            onChange={(e) => set('registrationNumber', e.target.value)}
            className={input}
            placeholder="e.g. HOS-2024-001"
          />
        </div>
        <div>
          <label className={`${labelCls} mb-1.5 block`} htmlFor="org-phone">Phone</label>
          <input
            id="org-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={input}
            placeholder="+91 98765 43210"
          />
        </div>
        <div>
          <label className={`${labelCls} mb-1.5 block`} htmlFor="org-email">Email</label>
          <input
            id="org-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={input}
            placeholder="contact@hospital.com"
          />
        </div>
        <div>
          <label className={`${labelCls} mb-1.5 block`} htmlFor="org-address">Address</label>
          <input
            id="org-address"
            type="text"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            className={input}
            placeholder="Street, City, State"
          />
        </div>
        {err && <p className="text-sm text-allergy-ink">{err}</p>}
        <div className="flex gap-2.5 pt-1">
          <button type="submit" disabled={saving} className={`${button('primary')} flex-1`}>
            {saving ? 'Registering…' : 'Register Organization'}
          </button>
          <button type="button" onClick={onClose} className={button('ghost')}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface OrgDetailModalProps {
  open: boolean
  orgId: string | null
  onClose: () => void
}

function OrgDetailModal({ open, orgId, onClose }: OrgDetailModalProps) {
  const [org, setOrg] = useState<OrganizationSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !orgId) return
    setOrg(null)
    setLoading(true)
    getOrganizationDetail(orgId)
      .then(setOrg)
      .finally(() => setLoading(false))
  }, [open, orgId])

  return (
    <Modal open={open} title="Organization Details" icon="stethoscope" size="lg" onClose={onClose}>
      {loading && (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 rounded-[14px] bg-line" />)}
        </div>
      )}
      {org && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[1.1rem] font-semibold text-ink">{org.name}</h3>
              <p className="mt-0.5 text-[0.88rem] text-ink-soft">{org.registrationNumber}</p>
            </div>
            {typeBadge(org.organizationType)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            {org.phone && (
              <div>
                <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">Phone</span>
                <span>{org.phone}</span>
              </div>
            )}
            {org.email && (
              <div>
                <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">Email</span>
                <span>{org.email}</span>
              </div>
            )}
            {org.address && (
              <div className="sm:col-span-2">
                <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">Address</span>
                <span>{org.address}</span>
              </div>
            )}
            <div>
              <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">Practitioners</span>
              <span>{org.practitionersCount}</span>
            </div>
            <div>
              <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">Registered</span>
              <span>{formatDate(org.createdAt)}</span>
            </div>
          </div>
          {org.practitioners && org.practitioners.length > 0 && (
            <div>
              <h4 className="mb-2 text-[0.88rem] font-semibold text-ink">Affiliated Practitioners</h4>
              <div className="divide-y divide-line rounded-[14px] border border-line overflow-hidden">
                {org.practitioners.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-tint text-[0.78rem] font-semibold text-brand-deep">
                      {p.fullName?.[0] ?? '?'}
                    </span>
                    <div>
                      <span className="block text-[0.9rem] font-medium text-ink">{p.fullName}</span>
                      <span className="block text-[0.78rem] text-ink-faint">{p.specialization ?? '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [detailOrgId, setDetailOrgId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getOrganizations({ q: debouncedSearch || undefined })
      setOrgs(res.organizations)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <PageHeader
        title="Healthcare Organizations"
        subtitle={`${total} organization${total !== 1 ? 's' : ''} registered`}
      >
        <button type="button" onClick={() => setRegisterOpen(true)} className={button('primary', 'sm')}>
          <Icon name="plus" size={16} />
          Register Organization
        </button>
      </PageHeader>

      <div className="mb-5">
        <div className="relative max-w-sm">
          <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            placeholder="Search organizations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[14px] border border-line-strong bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-[#85999f] focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : orgs.length === 0 ? (
        <div className={`${card} ${emptyBox}`}>
          <Icon name="stethoscope" size={32} className="mx-auto mb-3 text-ink-faint" />
          <p className="font-semibold text-ink">No organizations found</p>
          <p className="mt-1 text-sm text-ink-faint">Register the first organization to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => { setDetailOrgId(org.publicId); setDetailOpen(true) }}
              className="text-left rounded-[20px] border border-line bg-white p-5 shadow-soft transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <span className="block font-semibold text-ink">{org.name}</span>
                  {org.registrationNumber && (
                    <span className="block text-[0.78rem] text-ink-faint">{org.registrationNumber}</span>
                  )}
                </div>
                {typeBadge(org.organizationType)}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 text-[0.82rem] text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <Icon name="user" size={14} />
                  {org.practitionersCount} practitioner{org.practitionersCount !== 1 ? 's' : ''}
                </span>
                <span>{formatDate(org.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <RegisterOrgModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onCreated={load}
      />
      <OrgDetailModal
        open={detailOpen}
        orgId={detailOrgId}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  )
}
