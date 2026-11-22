import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
import { button, card, emptyBox, input, select, label as labelCls, avatar } from '../../lib/ui'
import { formatDate, initials } from '../../lib/format'
import { getPractitioners, onboardPractitioner, getOrganizations, getPractitionerDetail } from '../../api/hospital'
import { removePractitioner } from '../../api/admin'
import type { PractitionerSummary, PractitionerCreateInput, OrganizationSummary } from '../../api/hospital'

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3.5 animate-pulse">
      <div className="size-10 rounded-full bg-line shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-36 rounded bg-line" />
        <div className="h-3 w-28 rounded bg-line" />
      </div>
      <div className="hidden sm:block h-3 w-32 rounded bg-line" />
      <div className="h-3 w-20 rounded bg-line" />
    </div>
  )
}

interface OnboardModalProps {
  open: boolean
  orgs: OrganizationSummary[]
  onClose: () => void
  onCreated: () => void
}

function OnboardModal({ open, orgs, onClose, onCreated }: OnboardModalProps) {
  const blank: PractitionerCreateInput = {
    fullName: '', phone: '', email: '', password: '',
    registrationNumber: '', specialization: '', qualification: '',
    organizationId: '', designation: '',
  }
  const [form, setForm] = useState<PractitionerCreateInput>(blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: keyof PractitionerCreateInput, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const payload = { ...form }
      if (!payload.organizationId) delete payload.organizationId
      if (!payload.email) delete payload.email
      await onboardPractitioner(payload)
      onCreated()
      onClose()
      setForm(blank)
    } catch (ex: any) {
      setErr(ex?.message ?? 'Failed to onboard practitioner')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Onboard Practitioner" icon="stethoscope" size="lg" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={`${labelCls} mb-1.5 block`} htmlFor="prac-name">Full Name *</label>
            <input
              id="prac-name"
              type="text"
              required
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              className={input}
              placeholder="Dr. Jane Doe"
              data-autofocus
            />
          </div>
          <div>
            <label className={`${labelCls} mb-1.5 block`} htmlFor="prac-reg">Reg. Number *</label>
            <input
              id="prac-reg"
              type="text"
              required
              value={form.registrationNumber}
              onChange={(e) => set('registrationNumber', e.target.value)}
              className={input}
              placeholder="MCI-2024-001"
            />
          </div>
          <div>
            <label className={`${labelCls} mb-1.5 block`} htmlFor="prac-phone">Phone *</label>
            <input
              id="prac-phone"
              type="tel"
              required
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={input}
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label className={`${labelCls} mb-1.5 block`} htmlFor="prac-email">Email</label>
            <input
              id="prac-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className={input}
              placeholder="doctor@hospital.com"
            />
          </div>
          <div>
            <label className={`${labelCls} mb-1.5 block`} htmlFor="prac-pwd">Password *</label>
            <input
              id="prac-pwd"
              type="password"
              required
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              className={input}
              placeholder="Temporary password"
            />
          </div>
          <div>
            <label className={`${labelCls} mb-1.5 block`} htmlFor="prac-spec">Specialization</label>
            <input
              id="prac-spec"
              type="text"
              value={form.specialization}
              onChange={(e) => set('specialization', e.target.value)}
              className={input}
              placeholder="e.g. Cardiology"
            />
          </div>
          <div>
            <label className={`${labelCls} mb-1.5 block`} htmlFor="prac-qual">Qualification</label>
            <input
              id="prac-qual"
              type="text"
              value={form.qualification}
              onChange={(e) => set('qualification', e.target.value)}
              className={input}
              placeholder="e.g. MBBS, MD"
            />
          </div>
          <div>
            <label className={`${labelCls} mb-1.5 block`} htmlFor="prac-designation">Designation</label>
            <input
              id="prac-designation"
              type="text"
              value={form.designation}
              onChange={(e) => set('designation', e.target.value)}
              className={input}
              placeholder="e.g. Senior Consultant"
            />
          </div>
        </div>
        <div>
          <label className={`${labelCls} mb-1.5 block`} htmlFor="prac-org">Organization</label>
          <select
            id="prac-org"
            value={form.organizationId}
            onChange={(e) => set('organizationId', e.target.value)}
            className={select}
          >
            <option value="">— No organization —</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.publicId}>{o.name}</option>
            ))}
          </select>
        </div>
        {err && <p className="text-sm text-allergy-ink">{err}</p>}
        <div className="flex gap-2.5 pt-1">
          <button type="submit" disabled={saving} className={`${button('primary')} flex-1`}>
            {saving ? 'Onboarding…' : 'Onboard Practitioner'}
          </button>
          <button type="button" onClick={onClose} className={button('ghost')}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface PractitionerDetailModalProps {
  open: boolean
  practitionerId: string | null
  onClose: () => void
  onRemove?: () => void
}

function PractitionerDetailModal({ open, practitionerId, onClose, onRemove }: PractitionerDetailModalProps) {
  const [practitioner, setPractitioner] = useState<PractitionerSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !practitionerId) return
    setPractitioner(null)
    setErr(null)
    setLoading(true)
    getPractitionerDetail(practitionerId)
      .then(setPractitioner)
      .catch(() => setErr('Failed to load practitioner profile'))
      .finally(() => setLoading(false))
  }, [open, practitionerId])

  const p = practitioner

  return (
    <Modal open={open} title="Practitioner Profile" icon="stethoscope" size="lg" onClose={onClose}>
      {loading && (
        <div className="space-y-3 py-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-[14px] bg-line" />
          ))}
        </div>
      )}
      {err && !loading && (
        <div className="rounded-[14px] bg-allergy-tint px-4 py-3 text-sm text-allergy-ink">{err}</div>
      )}
      {p && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-tint text-[1.1rem] font-semibold text-brand-deep">
              {initials(p.fullName)}
            </span>
            <div className="min-w-0">
              <strong className="block text-[1.1rem] font-semibold text-ink">{p.fullName}</strong>
              <div className="flex items-center gap-2 mt-1">
                <span className="rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-xs font-semibold text-[#2e7d32]">
                  Registered Practitioner
                </span>
                {p.doctorId && (
                  <span className="font-mono text-xs text-brand font-semibold bg-brand-tint/60 px-2 py-0.5 rounded-md border border-brand/20">
                    {p.doctorId}
                  </span>
                )}
                {p.specialization && (
                  <span className="rounded-full bg-surface-tint px-2 py-0.5 text-xs font-medium text-ink-soft">
                    {p.specialization}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            {p.doctorId && (
              <div>
                <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">
                  Doctor ID
                </span>
                <span className="font-mono text-brand font-semibold">{p.doctorId}</span>
              </div>
            )}
            <div>
              <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">
                Registration / License No.
              </span>
              <span className="font-mono text-ink font-medium">{p.registrationNumber}</span>
            </div>
            {p.specialization && (
              <div>
                <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">
                  Specialization
                </span>
                <span className="text-ink">{p.specialization}</span>
              </div>
            )}
            {p.qualification && (
              <div>
                <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">
                  Qualification
                </span>
                <span className="text-ink">{p.qualification}</span>
              </div>
            )}
            <div>
              <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">
                Phone
              </span>
              <span className="text-ink">{p.phone}</span>
            </div>
            {p.email && (
              <div>
                <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">
                  Email
                </span>
                <span className="text-ink">{p.email}</span>
              </div>
            )}
            <div>
              <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">
                Onboarded Date
              </span>
              <span className="text-ink">{formatDate(p.createdAt)}</span>
            </div>
            {p.organization && (
              <div className="sm:col-span-2">
                <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-0.5">
                  Affiliated Organization
                </span>
                <span className="text-ink font-medium">{p.organization.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <button
              type="button"
              onClick={() => {
                onClose()
                onRemove?.()
              }}
              className={button('danger', 'sm')}
            >
              <Icon name="trash" size={15} />
              Remove Doctor
            </button>
            <button type="button" onClick={onClose} className={button('ghost', 'sm')}>
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function AdminPractitioners() {
  const [practitioners, setPractitioners] = useState<PractitionerSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<PractitionerSummary | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeErr, setRemoveErr] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPractitioners({ q: debouncedSearch || undefined, page, limit })
      setPractitioners(res.practitioners)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page])

  useEffect(() => { load() }, [load])

  // Load orgs for the onboard form dropdown
  useEffect(() => {
    getOrganizations({ limit: 100 }).then((res) => setOrgs(res.organizations))
  }, [])

  const totalPages = Math.ceil(total / limit)

  const openPractitionerDetail = (id: string) => {
    setSelectedPractitionerId(id)
    setDetailOpen(true)
  }

  const handleRemoveConfirm = async () => {
    if (!removeTarget) return
    setRemoving(true)
    setRemoveErr(null)
    try {
      await removePractitioner(removeTarget.doctorId || removeTarget.id)
      setRemoveTarget(null)
      if (selectedPractitionerId === removeTarget.id) {
        setDetailOpen(false)
        setSelectedPractitionerId(null)
      }
      load()
    } catch (err: any) {
      setRemoveErr(err?.message || 'Failed to remove doctor')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Practitioners"
        subtitle={`${total} practitioner${total !== 1 ? 's' : ''} onboarded`}
      >
        <button type="button" onClick={() => setOnboardOpen(true)} className={button('primary', 'sm')}>
          <Icon name="plus" size={16} />
          Onboard Practitioner
        </button>
      </PageHeader>

      <div className="mb-5">
        <div className="relative max-w-sm">
          <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            placeholder="Search practitioners…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[14px] border border-line-strong bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-[#85999f] focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
          />
        </div>
      </div>

      <div className={card}>
        {loading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : practitioners.length === 0 ? (
          <div className={emptyBox}>
            <Icon name="user" size={32} className="mx-auto mb-3 text-ink-faint" />
            <p className="font-semibold text-ink">No practitioners found</p>
            <p className="mt-1 text-sm text-ink-faint">Onboard the first practitioner to get started.</p>
          </div>
        ) : (
          <>
            {/* Desktop header */}
            <div className="mb-2 hidden grid-cols-[2fr_1.3fr_1.3fr_1.5fr_1.5fr_1fr_auto] gap-4 px-3 text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint sm:grid">
              <span>Practitioner</span>
              <span>Doctor ID</span>
              <span>Reg. Number</span>
              <span>Specialization</span>
              <span>Organization</span>
              <span>Joined</span>
              <span className="sr-only">Actions</span>
            </div>
            <div className="divide-y divide-line">
              {practitioners.map((p) => (
                <div
                  key={p.id}
                  onClick={() => openPractitionerDetail(p.id)}
                  className="flex items-center gap-4 py-3.5 px-3 rounded-2xl cursor-pointer hover:bg-surface-tint/60 transition-colors sm:grid sm:grid-cols-[2fr_1.3fr_1.3fr_1.5fr_1.5fr_1fr_auto]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`${avatar} shrink-0`}>{initials(p.fullName)}</span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[0.95rem] font-semibold text-ink">{p.fullName}</strong>
                      <div className="flex items-center gap-1.5 mt-0.5 sm:hidden">
                        {p.doctorId && (
                          <span className="font-mono text-[0.72rem] text-brand font-semibold bg-brand-tint/60 px-1.5 py-0.5 rounded border border-brand/20">
                            {p.doctorId}
                          </span>
                        )}
                        <span className="text-[0.78rem] text-ink-faint">{p.phone}</span>
                      </div>
                    </div>
                  </div>
                  <span className="hidden font-mono text-[0.88rem] font-semibold text-brand sm:block">
                    {p.doctorId || '—'}
                  </span>
                  <span className="hidden font-mono text-[0.85rem] text-ink-soft sm:block">{p.registrationNumber}</span>
                  <span className="hidden text-[0.88rem] text-ink-soft sm:block">{p.specialization ?? '—'}</span>
                  <span className="hidden text-[0.88rem] text-ink-soft sm:block">{p.organization?.name ?? '—'}</span>
                  <span className="hidden text-[0.82rem] text-ink-soft sm:block">{formatDate(p.createdAt)}</span>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(p)}
                      className="p-1.5 text-ink-faint hover:text-allergy-ink hover:bg-allergy-tint/60 rounded-lg transition-colors cursor-pointer"
                      title="Remove Doctor"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                    <Icon name="chevron-right" size={16} className="text-ink-faint hidden sm:block" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-ink-faint">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={button('ghost', 'sm')}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={button('ghost', 'sm')}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <OnboardModal
        open={onboardOpen}
        orgs={orgs}
        onClose={() => setOnboardOpen(false)}
        onCreated={load}
      />

      <PractitionerDetailModal
        open={detailOpen}
        practitionerId={selectedPractitionerId}
        onClose={() => setDetailOpen(false)}
        onRemove={() => {
          const match = practitioners.find((p) => p.id === selectedPractitionerId)
          if (match) setRemoveTarget(match)
        }}
      />

      {/* Confirmation Modal */}
      <Modal
        open={Boolean(removeTarget)}
        title="Remove Doctor"
        icon="alert"
        size="md"
        onClose={() => !removing && setRemoveTarget(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Are you sure you want to remove <strong className="text-ink font-semibold">{removeTarget?.fullName}</strong>
            {removeTarget?.doctorId
              ? ` (${removeTarget.doctorId})`
              : removeTarget?.registrationNumber
              ? ` (Reg: ${removeTarget.registrationNumber})`
              : ''}?
          </p>
          <div className="rounded-[14px] bg-allergy-tint/50 border border-allergy/20 p-3 text-xs text-allergy-ink">
            This action cannot be undone. All clinical access grants and login credentials for this practitioner will be permanently revoked.
          </div>
          {removeErr && (
            <div className="rounded-[14px] bg-allergy-tint p-3 text-xs text-allergy-ink">
              {removeErr}
            </div>
          )}
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={removing}
              onClick={() => setRemoveTarget(null)}
              className={button('ghost', 'sm')}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={removing}
              onClick={handleRemoveConfirm}
              className={button('danger', 'sm')}
            >
              {removing ? 'Removing…' : 'Yes, Remove Doctor'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
