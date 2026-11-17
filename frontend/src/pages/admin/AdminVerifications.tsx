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

type Tab = 'pending' | 'all'

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
    <span className="rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-xs font-semibold text-[#2e7d32]">Approved</span>
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
      .catch(() => setErr('Failed to load patient details'))
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
      setErr('Failed to approve patient')
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
      setErr('Failed to reject patient')
    } finally {
      setRejecting(false)
    }
  }

  const d = detail

  return (
    <Modal open={open} title="Patient Verification" icon="user" size="lg" onClose={onClose}>
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
            Mediclaim ID issued and sent to patient via SMS/email.
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
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-tint text-[1.1rem] font-semibold text-brand-deep">
              {initials(d.fullName)}
            </span>
            <div>
              <strong className="block text-[1.1rem] font-semibold text-ink">{d.fullName}</strong>
              <StatusBadge approved={d.adminVerified} />
            </div>
          </div>

          {/* Details grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={`${label} mb-1 block`}>Date of Birth</span>
              <span className="text-[0.95rem] text-ink">{formatDate(d.dateOfBirth)}</span>
            </div>
            <div>
              <span className={`${label} mb-1 block`}>Gender</span>
              <span className="text-[0.95rem] text-ink capitalize">{d.gender || '—'}</span>
            </div>
            <div>
              <span className={`${label} mb-1 block`}>Blood Group</span>
              <span className="text-[0.95rem] text-ink">{d.bloodGroup || '—'}</span>
            </div>
            <div>
              <span className={`${label} mb-1 block`}>Phone</span>
              <span className="text-[0.95rem] text-ink">{d.phone}</span>
            </div>
            <div>
              <span className={`${label} mb-1 block`}>Aadhaar (masked)</span>
              <span className="font-mono text-[0.95rem] text-ink">{d.aadhaarMasked || '—'}</span>
            </div>
            <div>
              <span className={`${label} mb-1 block`}>Registered</span>
              <span className="text-[0.95rem] text-ink">{formatDate(d.registeredAt)}</span>
            </div>
          </div>

          {d.address && (
            <div>
              <span className={`${label} mb-1 block`}>Address</span>
              <span className="text-[0.95rem] text-ink">{d.address}</span>
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
            <div className="border-t border-line pt-4">
              <p className="text-sm text-ink-soft">
                This patient has already been verified. No further action needed.
              </p>
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPendingVerifications({ query: search || undefined })
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  const filtered = tab === 'pending' ? items.filter((i) => !i.adminVerified) : items

  const openDetail = (id: string) => {
    setSelectedId(id)
    setModalOpen(true)
  }

  return (
    <div>
      <PageHeader title="Patient Verifications" subtitle="Review and approve new patient registrations" />

      {/* Tabs + search */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-[14px] border border-line bg-white p-1">
          {(['pending', 'all'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-[10px] px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t === 'pending' ? 'Pending' : 'All'}
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
            placeholder="Search by name or phone…"
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
        ) : filtered.length === 0 ? (
          <div className={emptyBox}>
            <Icon name="check" size={32} className="mx-auto mb-3 text-ink-faint" />
            <p className="font-semibold text-ink">
              {tab === 'pending' ? 'No pending verifications' : 'No verifications found'}
            </p>
            <p className="mt-1 text-sm text-ink-faint">
              {tab === 'pending'
                ? 'All registrations have been processed.'
                : 'Try adjusting your search query.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((item) => (
              <div key={item.userId} className="flex items-center gap-4 py-3.5">
                <span className={`${avatar} shrink-0`}>{initials(item.fullName)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="truncate text-[0.95rem] font-semibold text-ink">
                      {item.fullName}
                    </strong>
                    <StatusBadge approved={item.adminVerified} />
                  </div>
                  <span className="block text-[0.82rem] text-ink-faint">
                    {item.phone} · Registered {formatWhen(item.registeredAt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openDetail(item.userId)}
                  className={button('soft', 'sm')}
                >
                  Review
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
