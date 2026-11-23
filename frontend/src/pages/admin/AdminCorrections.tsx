import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { card, emptyBox, button, textarea } from '../../lib/ui'
import { formatWhen } from '../../lib/format'
import { correctionsApi } from '../../api/corrections'
import type { CorrectionRequest } from '../../types'

function SkeletonRow() {
  return (
    <div className="flex gap-4 py-4 animate-pulse">
      <div className="mt-1 size-8 rounded-[10px] bg-line shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-48 rounded bg-line" />
        <div className="h-3 w-64 rounded bg-line" />
        <div className="h-3 w-32 rounded bg-line" />
      </div>
      <div className="hidden sm:block h-3 w-24 rounded bg-line mt-1" />
    </div>
  )
}

export default function AdminCorrections() {
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'under_review' | 'approved' | 'rejected'>('all')

  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [activeCorrection, setActiveCorrection] = useState<CorrectionRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  function loadCorrections() {
    setLoading(true)
    correctionsApi
      .getCorrections(statusFilter !== 'all' ? { status: statusFilter } : undefined)
      .then(setCorrections)
      .catch(() => setError('Failed to load clinical correction requests'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCorrections()
  }, [statusFilter])

  async function handleReview(status: 'approved' | 'rejected') {
    if (!activeCorrection) return
    setSubmittingReview(true)
    try {
      await correctionsApi.reviewCorrection(activeCorrection.id, {
        status,
        reviewNotes: reviewNotes.trim() || undefined,
      })
      setReviewModalOpen(false)
      setActiveCorrection(null)
      setReviewNotes('')
      loadCorrections()
    } catch {
      alert('Failed to submit review decision. Please try again.')
    } finally {
      setSubmittingReview(false)
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Clinical Record Corrections"
        subtitle="Oversight and auditing of patient record amendment requests across the platform"
      />

      {error && (
        <div className="flex items-center gap-3 rounded-[18px] border border-allergy-tint bg-allergy-tint/60 px-4 py-3 text-allergy-ink text-sm">
          <Icon name="alert" size={18} />
          {error}
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'under_review', 'approved', 'rejected'] as const).map((tab) => {
          const labels = {
            all: 'All Requests',
            under_review: 'Under Review',
            approved: 'Approved',
            rejected: 'Rejected',
          }
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                statusFilter === tab
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-white border border-line text-ink-soft hover:bg-mist'
              }`}
            >
              {labels[tab]}
            </button>
          )
        })}
      </div>

      <div className={card}>
        {loading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : corrections.length === 0 ? (
          <div className={emptyBox}>
            <Icon name="file" size={32} className="mx-auto mb-3 text-ink-faint" />
            <p className="font-semibold text-ink">No correction requests found</p>
            <p className="mt-1 text-sm text-ink-faint">
              When patients request amendments to clinical records, they will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {corrections.map((corr) => {
              const isPending = corr.status === 'under_review'
              const statusColors = {
                under_review: 'bg-[#fff3cd] text-[#856404] border-[#ffeeba]',
                approved: 'bg-brand-tint text-brand-deep border-brand/20',
                rejected: 'bg-allergy-tint text-allergy-ink border-allergy-line',
              }
              return (
                <div key={corr.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 py-4">
                  <div className="flex gap-3.5 min-w-0">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[11px] bg-brand-tint text-brand">
                      <Icon name="file" size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm font-semibold text-ink truncate">
                          {corr.recordTitle}
                        </strong>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${
                            statusColors[corr.status] || 'bg-mist text-ink-soft'
                          }`}
                        >
                          {corr.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                        <span>Patient: <strong className="text-ink">{corr.patientName || 'Patient'}</strong></span>
                        {corr.patientMediclaimId && (
                          <span className="font-mono">{corr.patientMediclaimId}</span>
                        )}
                        <span>Submitted {formatWhen(corr.createdAt)}</span>
                      </div>

                      <p className="mt-2 text-xs text-ink leading-relaxed bg-mist/60 rounded-xl p-2.5">
                        <span className="font-semibold text-ink-soft block mb-0.5">Stated Reason:</span>
                        "{corr.reason}"
                      </p>

                      {corr.proposed && (
                        <p className="mt-1.5 text-xs text-brand-deep leading-relaxed bg-brand-tint/30 rounded-xl p-2.5 border border-brand/10">
                          <span className="font-semibold text-brand block mb-0.5">Proposed Correction:</span>
                          {corr.proposed}
                        </p>
                      )}

                      {corr.reviewNotes && (
                        <p className="mt-1.5 text-xs text-ink-soft leading-relaxed border-l-2 border-line pl-2.5 py-0.5">
                          <span className="font-semibold text-ink">Reviewer Notes:</span> {corr.reviewNotes}
                        </p>
                      )}
                    </div>
                  </div>

                  {isPending && (
                    <div className="shrink-0 sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCorrection(corr)
                          setReviewNotes('')
                          setReviewModalOpen(true)
                        }}
                        className={`${button('soft', 'sm')} gap-1.5 text-xs`}
                      >
                        <Icon name="check" size={14} />
                        Review Request
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModalOpen && activeCorrection && (
        <Modal
          open={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          title="Review Record Correction"
          description={`Clinical review for ${activeCorrection.recordTitle}`}
        >
          <div className="space-y-4 text-sm text-ink pt-2">
            <div>
              <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Patient</span>
              <p className="font-semibold">{activeCorrection.patientName} ({activeCorrection.patientMediclaimId})</p>
            </div>

            <div className="rounded-xl bg-mist p-3 text-xs">
              <span className="font-semibold text-ink-soft block mb-1">Patient Reason:</span>
              <p className="text-ink">{activeCorrection.reason}</p>
            </div>

            {activeCorrection.proposed && (
              <div className="rounded-xl bg-brand-tint/40 border border-brand/20 p-3 text-xs">
                <span className="font-semibold text-brand-deep block mb-1">Proposed Text:</span>
                <p className="text-brand-deep font-mono">{activeCorrection.proposed}</p>
              </div>
            )}

            <div>
              <label htmlFor="adm-rev-notes" className="text-xs font-semibold text-ink mb-1 block">
                Clinical Review Notes (Optional)
              </label>
              <textarea
                id="adm-rev-notes"
                className={textarea}
                rows={3}
                placeholder="Enter justification or medical record cross-reference notes..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2.5 pt-3 border-t border-line justify-end">
              <button
                type="button"
                onClick={() => handleReview('rejected')}
                disabled={submittingReview}
                className="rounded-xl border border-allergy-line bg-allergy-tint px-4 py-2 text-xs font-bold text-allergy-ink hover:bg-allergy-tint/80 transition cursor-pointer"
              >
                Reject Request
              </button>
              <button
                type="button"
                onClick={() => handleReview('approved')}
                disabled={submittingReview}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-deep transition shadow-xs cursor-pointer"
              >
                Approve & Version Record
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
