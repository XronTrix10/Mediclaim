import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
import { button, card, avatar, emptyBox, label } from '../../lib/ui'
import { formatDate, formatWhen, initials } from '../../lib/format'
import {
  getPendingVerifications,
  getPatientVerificationDetail,
  approvePatientVerification,
  rejectPatientVerification,
} from '../../api/admin'
import type { PendingVerification, VerificationDetail } from '../../api/admin'

type Tab = 'pending' | 'verified' | 'all'

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 animate-pulse">
      <div className="size-10 rounded-full bg-line shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-36 rounded bg-line" />
        <div className="h-3 w-24 rounded bg-line" />
      </div>
      <div className="h-3 w-20 rounded bg-line" />
      <div className="h-8 w-20 rounded-full bg-line" />
    </div>
  )
}

function StatusBadge({ approved }: { approved: boolean }) {
  return approved ? (
    <span className="rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-xs font-semibold text-[#2e7d32]">Verified</span>
  ) : (
    <span className="rounded-full bg-[#fff7e6] px-2.5 py-0.5 text-xs font-semibold text-[#b45309]">Pending</span>
  )
}

interface DetailModalProps {
  open: boolean
  userId: string | null
  onClose: () => void
  onActionDone: () => void
}

function DetailModal({ open, userId, onClose, onActionDone }: DetailModalProps) {
  const [detail, setDetail] = useState<VerificationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [approvedResult, setApprovedResult] = useState<{ mediclaimId: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !userId) return
    setDetail(null)
    setLoading(true)
    setShowRejectForm(false)
    setRejectReason('')
    setApprovedResult(null)
    setErr(null)
    getPatientVerificationDetail(userId)
      .then(setDetail)
      .catch(() => setErr('Failed to load user details'))
      .finally(() => setLoading(false))
  }, [open, userId])

  const handleApprove = async () => {
    if (!userId) return
    setApproving(true)
    setErr(null)
    try {
      const res = await approvePatientVerification(userId)
      setApprovedResult({ mediclaimId: res.mediclaimId })
      onActionDone()
    } catch {
      setErr('Failed to approve user')
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!userId || !rejectReason.trim()) return
    setRejecting(true)
    setErr(null)
    try {
      await rejectPatientVerification(userId, rejectReason)
      onActionDone()
      onClose()
    } catch {
      setErr('Failed to reject user')
    } finally {
      setRejecting(false)
    }
  }

  const d = detail

  return (
    <Modal open={open} title="User Verification & Profile" icon="user" size="lg" onClose={onClose}>
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
      {approvedResult && (
        <div className="rounded-[18px] bg-[#e8f5e9] px-5 py-5 text-center">
          <div className="mb-2 grid size-12 place-items-center rounded-full bg-[#2e7d32]/10 text-[#2e7d32] mx-auto">
            <Icon name="check" size={24} />
          </div>
          <h3 className="text-[1.1rem] font-semibold text-ink">Account Approved!</h3>
          <p className="mt-1 text-[0.9rem] text-ink-soft">
            Mediclaim ID issued and dispatched to user.
          </p>
          <div className="mt-3 inline-block rounded-[12px] bg-white px-5 py-2.5 font-mono text-[1.1rem] font-bold tracking-wider text-brand shadow-soft">
            {approvedResult.mediclaimId}
          </div>
          <div className="mt-4">
            <button type="button" onClick={onClose} className={button('soft', 'sm')}>
              Close
            </button>
          </div>
        </div>
      )}
      {d && !approvedResult && (
        <div className="space-y-5">
          {/* Avatar + name + role */}
          <div className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-tint text-[1.1rem] font-semibold text-brand-deep">
              {initials(d.fullName)}
            </span>
            <div className="min-w-0">
              <strong className="block text-[1.1rem] font-semibold text-ink">{d.fullName}</strong>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge approved={d.adminVerified} />
                {d.role && d.role !== 'patient' && (
                  <span className="rounded-full bg-surface-tint px-2 py-0.5 text-xs font-medium text-ink-soft capitalize">
                    {d.role.replace('_', ' ')}
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

          {/* Details grid */}
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
            {d.registrationNumber && (
              <div>
                <span className={`${label} mb-1 block`}>Registration Number</span>
                <span className="font-mono text-ink">{d.registrationNumber}</span>
              </div>
            )}
            {d.specialization && (
              <div>
                <span className={`${label} mb-1 block`}>Specialization</span>
                <span className="text-ink">{d.specialization}</span>
              </div>
            )}
            {d.qualification && (
              <div>
                <span className={`${label} mb-1 block`}>Qualification</span>
                <span className="text-ink">{d.qualification}</span>
              </div>
            )}
            {d.organizationName && (
              <div className="sm:col-span-2">
                <span className={`${label} mb-1 block`}>Affiliated Hospital</span>
                <span className="text-ink font-medium">{d.organizationName}</span>
              </div>
            )}
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

          {/* Actions */}
          {!d.adminVerified && (
            <div className="space-y-3 border-t border-line pt-4">
              {!showRejectForm ? (
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={approving}
                    className={`${button('primary')} flex-1`}
                  >
                    {approving ? 'Approving…' : 'Approve & Issue Mediclaim ID'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    className={button('danger')}
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="reject-reason" className={`${label} mb-1.5 block`}>
                      Rejection Reason
                    </label>
                    <textarea
                      id="reject-reason"
                      rows={3}
                      placeholder="Explain why this registration is being rejected…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full rounded-[14px] border border-line-strong bg-white px-4 py-3 text-[0.95rem] resize-none placeholder:text-[#85999f] focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={rejecting || !rejectReason.trim()}
                      className={`${button('danger')} flex-1`}
                    >
                      {rejecting ? 'Rejecting…' : 'Confirm Rejection'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowRejectForm(false); setRejectReason('') }}
                      className={button('ghost')}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {err && <p className="text-sm text-allergy-ink">{err}</p>}
            </div>
          )}

          {d.adminVerified && (
            <div className="flex items-center justify-between border-t border-line pt-4">
              <span className="text-sm text-ink-soft">
                This account has been verified. No pending actions.
              </span>
              <button type="button" onClick={onClose} className={button('ghost', 'sm')}>
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function AdminVerifications() {
  const [tab, setTab] = useState<Tab>('pending')
  const [items, setItems] = useState<PendingVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPendingVerifications({
        query: debouncedSearch.trim() || undefined,
        status: tab,
      })
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, tab])

  useEffect(() => { load() }, [load])

  const openDetail = (id: string) => {
    setSelectedId(id)
    setModalOpen(true)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'verified', label: 'Verified' },
    { id: 'all', label: 'All' },
  ]

  return (
    <div>
      <PageHeader title="User Verifications" subtitle="Review and approve patient and practitioner registrations" />

      {/* Tabs + search */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-[14px] border border-line bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-[10px] px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t.id ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Icon
            name="search"
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="search"
            placeholder="Search by name, phone, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[14px] border border-line-strong bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-[#85999f] focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className={card}>
        {loading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className={emptyBox}>
            <Icon name="check" size={32} className="mx-auto mb-3 text-ink-faint" />
            <p className="font-semibold text-ink">
              {tab === 'pending'
                ? 'No pending verifications'
                : tab === 'verified'
                ? 'No verified users found'
                : 'No users found'}
            </p>
            <p className="mt-1 text-sm text-ink-faint">
              {tab === 'pending'
                ? 'All registrations have been processed.'
                : 'Try adjusting your search query.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => (
              <div
                key={item.userId}
                onClick={() => openDetail(item.userId)}
                className="flex items-center gap-4 py-3.5 px-3 rounded-2xl cursor-pointer hover:bg-surface-tint/60 transition-colors"
              >
                <span className={`${avatar} shrink-0`}>{initials(item.fullName)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="truncate text-[0.95rem] font-semibold text-ink">
                      {item.fullName}
                    </strong>
                    <StatusBadge approved={item.adminVerified} />
                    {item.mediclaimId && (
                      <span className="hidden sm:inline-block font-mono text-xs text-ink-soft bg-surface px-2 py-0.5 rounded-md border border-line">
                        {item.mediclaimId}
                      </span>
                    )}
                  </div>
                  <span className="block text-[0.82rem] text-ink-faint">
                    {item.phone} · Registered {formatWhen(item.registeredAt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openDetail(item.userId)
                  }}
                  className={button('soft', 'sm')}
                >
                  {item.adminVerified ? 'View Details' : 'Review'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <DetailModal
        open={modalOpen}
        userId={selectedId}
        onClose={() => setModalOpen(false)}
        onActionDone={load}
      />
    </div>
  )
}
