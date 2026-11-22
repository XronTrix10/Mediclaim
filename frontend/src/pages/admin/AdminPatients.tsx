import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
import { card, avatar, emptyBox, button, label } from '../../lib/ui'
import { formatDate, initials } from '../../lib/format'
import { getAllPatients, getPatientVerificationDetail, removePatient } from '../../api/admin'
import type { VerificationDetail } from '../../api/admin'

interface Patient {
  userId: string
  fullName: string
  phone: string
  mediclaimId?: string
  adminVerified: boolean
  registeredAt: string
  bloodGroup?: string
  gender?: string
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3.5 animate-pulse">
      <div className="size-10 rounded-full bg-line shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-40 rounded bg-line" />
        <div className="h-3 w-28 rounded bg-line" />
      </div>
      <div className="hidden sm:block h-3 w-24 rounded bg-line" />
      <div className="h-6 w-20 rounded-full bg-line" />
    </div>
  )
}

interface PatientDetailModalProps {
  open: boolean
  userId: string | null
  onClose: () => void
  onRemove?: () => void
}

function PatientDetailModal({ open, userId, onClose, onRemove }: PatientDetailModalProps) {
  const [detail, setDetail] = useState<VerificationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !userId) return
    setDetail(null)
    setErr(null)
    setLoading(true)
    getPatientVerificationDetail(userId)
      .then(setDetail)
      .catch(() => setErr('Failed to load patient profile details'))
      .finally(() => setLoading(false))
  }, [open, userId])

  const d = detail

  return (
    <Modal open={open} title="Patient Profile" icon="user" size="lg" onClose={onClose}>
      {loading && (
        <div className="space-y-3 py-2 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-[14px] bg-line" />
          ))}
        </div>
      )}
      {err && !loading && (
        <div className="rounded-[14px] bg-allergy-tint px-4 py-3 text-sm text-allergy-ink">{err}</div>
      )}
      {d && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-tint text-[1.1rem] font-semibold text-brand-deep">
              {initials(d.fullName)}
            </span>
            <div className="min-w-0">
              <strong className="block text-[1.1rem] font-semibold text-ink">{d.fullName}</strong>
              <div className="flex items-center gap-2 mt-1">
                {d.adminVerified ? (
                  <span className="rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-xs font-semibold text-[#2e7d32]">
                    Verified
                  </span>
                ) : (
                  <span className="rounded-full bg-[#fff7e6] px-2.5 py-0.5 text-xs font-semibold text-[#b45309]">
                    Pending Verification
                  </span>
                )}
                {d.mediclaimId && (
                  <span className="font-mono text-xs text-brand font-semibold bg-brand-tint/50 px-2 py-0.5 rounded-md">
                    {d.mediclaimId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            {d.mediclaimId && (
              <div>
                <span className={`${label} mb-1 block`}>Mediclaim ID</span>
                <span className="font-mono font-medium text-ink">{d.mediclaimId}</span>
              </div>
            )}
            <div>
              <span className={`${label} mb-1 block`}>Phone</span>
              <span className="text-ink">{d.phone}</span>
            </div>
            {d.dateOfBirth && (
              <div>
                <span className={`${label} mb-1 block`}>Date of Birth</span>
                <span className="text-ink">{formatDate(d.dateOfBirth)}</span>
              </div>
            )}
            {d.gender && (
              <div>
                <span className={`${label} mb-1 block`}>Gender</span>
                <span className="text-ink capitalize">{d.gender}</span>
              </div>
            )}
            {d.bloodGroup && (
              <div>
                <span className={`${label} mb-1 block`}>Blood Group</span>
                <span className="text-ink font-semibold">{d.bloodGroup}</span>
              </div>
            )}
            <div>
              <span className={`${label} mb-1 block`}>Aadhaar (masked)</span>
              <span className="font-mono text-ink">{d.aadhaarMasked || '—'}</span>
            </div>
            <div>
              <span className={`${label} mb-1 block`}>Registered</span>
              <span className="text-ink">{formatDate(d.registeredAt)}</span>
            </div>
            <div>
              <span className={`${label} mb-1 block`}>Account Status</span>
              <span className="capitalize text-ink">{d.accountStatus ? d.accountStatus.replace(/_/g, ' ') : 'Active'}</span>
            </div>
          </div>

          {d.address && (
            <div>
              <span className={`${label} mb-1 block`}>Address</span>
              <span className="text-sm text-ink">{d.address}</span>
            </div>
          )}

          {d.emergencyContact && d.emergencyContact.name && (
            <div className="rounded-[14px] border border-line bg-surface p-3.5">
              <span className="block text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint mb-1.5">
                Emergency Contact
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium text-ink">{d.emergencyContact.name}</span>
                <span className="text-ink-soft">({d.emergencyContact.relation || 'Relation'})</span>
                <span className="text-ink">{d.emergencyContact.phone}</span>
              </div>
            </div>
          )}

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
              Remove Patient
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

export default function AdminPatients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Patient | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeErr, setRemoveErr] = useState<string | null>(null)
  const limit = 20

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Reset page when search changes
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAllPatients({ page, limit, query: debouncedSearch || undefined })
      setPatients(res.patients as Patient[])
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / limit)

  const openPatientDetail = (userId: string) => {
    setSelectedUserId(userId)
    setDetailOpen(true)
  }

  const handleRemoveConfirm = async () => {
    if (!removeTarget) return
    setRemoving(true)
    setRemoveErr(null)
    try {
      await removePatient(removeTarget.userId)
      setRemoveTarget(null)
      if (selectedUserId === removeTarget.userId) {
        setDetailOpen(false)
        setSelectedUserId(null)
      }
      load()
    } catch (err: any) {
      setRemoveErr(err?.message || 'Failed to remove patient')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div>
      <PageHeader title="All Patients" subtitle={`${total} patient${total !== 1 ? 's' : ''} registered`} />

      {/* Search */}
      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            placeholder="Search by name, phone, or Mediclaim ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[14px] border border-line-strong bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-[#85999f] focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className={card}>
        {loading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : patients.length === 0 ? (
          <div className={emptyBox}>
            <Icon name="users" size={32} className="mx-auto mb-3 text-ink-faint" />
            <p className="font-semibold text-ink">No patients found</p>
            <p className="mt-1 text-sm text-ink-faint">Try a different search query.</p>
          </div>
        ) : (
          <>
            {/* Desktop header */}
            <div className="mb-2 hidden grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-4 px-3 text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint sm:grid">
              <span>Patient</span>
              <span>Mediclaim ID</span>
              <span>Phone</span>
              <span>Registered</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-line">
              {patients.map((p) => (
                <div
                  key={p.userId}
                  onClick={() => openPatientDetail(p.userId)}
                  className="flex items-center gap-4 py-3.5 px-3 rounded-2xl cursor-pointer hover:bg-surface-tint/60 transition-colors sm:grid sm:grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_auto]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`${avatar} shrink-0`}>{initials(p.fullName)}</span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[0.95rem] font-semibold text-ink">
                        {p.fullName}
                      </strong>
                      <span className="block text-[0.78rem] text-ink-faint sm:hidden">{p.phone}</span>
                    </div>
                  </div>
                  <span className="hidden font-mono text-[0.88rem] text-ink-soft sm:block">
                    {p.mediclaimId || '—'}
                  </span>
                  <span className="hidden text-[0.9rem] text-ink-soft sm:block">{p.phone}</span>
                  <span className="hidden text-[0.88rem] text-ink-soft sm:block">
                    {formatDate(p.registeredAt || (p as any).createdAt)}
                  </span>
                  <div className="flex items-center gap-2">
                    {p.adminVerified ? (
                      <span className="rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-xs font-semibold text-[#2e7d32]">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#fff7e6] px-2.5 py-0.5 text-xs font-semibold text-[#b45309]">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(p)}
                      className="p-1.5 text-ink-faint hover:text-allergy-ink hover:bg-allergy-tint/60 rounded-lg transition-colors cursor-pointer"
                      title="Remove Patient"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-ink-faint">
            Page {page} of {totalPages}
          </span>
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

      <PatientDetailModal
        open={detailOpen}
        userId={selectedUserId}
        onClose={() => setDetailOpen(false)}
        onRemove={() => {
          const match = patients.find((p) => p.userId === selectedUserId)
          if (match) setRemoveTarget(match)
        }}
      />

      {/* Confirmation Modal */}
      <Modal
        open={Boolean(removeTarget)}
        title="Remove Patient"
        icon="alert"
        size="md"
        onClose={() => !removing && setRemoveTarget(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Are you sure you want to permanently remove <strong className="text-ink font-semibold">{removeTarget?.fullName}</strong>
            {removeTarget?.mediclaimId ? ` (${removeTarget.mediclaimId})` : ''}?
          </p>
          <div className="rounded-[14px] bg-allergy-tint/50 border border-allergy/20 p-3 text-xs text-allergy-ink">
            This action cannot be undone. All personal records, prescriptions, and access grants associated with this patient will be permanently removed.
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
              {removing ? 'Removing…' : 'Yes, Remove Patient'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
