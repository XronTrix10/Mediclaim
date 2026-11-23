import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import AuthenticatedFilePreview from '../../components/AuthenticatedFilePreview'
import { card, button, chip, emptyBox, textarea } from '../../lib/ui'
import { getAuthorizedRecords, type PatientDocument } from '../../api/doctor'
import { correctionsApi } from '../../api/corrections'
import type { HealthEvent, CorrectionRequest } from '../../types'
import AddPatientRecordModal from '../../components/doctor/AddPatientRecordModal'

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isBirthCertificate(title?: string, fileName?: string, docType?: string): boolean {
  const t = (title || '').toLowerCase().trim()
  const fn = (fileName || '').toLowerCase().trim()
  const dt = (docType || '').toLowerCase().trim()
  if (dt.includes('birth') && (dt.includes('cert') || dt.includes('record') || dt === 'birth')) return true
  if (t.includes('birth') && (t.includes('cert') || t.includes('record') || t === 'birth')) return true
  if (fn.includes('birth') && (fn.includes('cert') || fn.includes('certificate'))) return true
  return false
}

type RecordKind = 'all' | 'documents' | 'vaccination' | 'condition' | 'medication' | 'allergy' | 'report' | 'corrections'

const KIND_LABELS: Record<string, string> = {
  all: 'All Records',
  documents: 'Documents & Files',
  vaccination: 'Vaccinations',
  condition: 'Conditions',
  medication: 'Medications',
  allergy: 'Allergies',
  report: 'Reports',
  corrections: 'Corrections',
}

const KIND_ICON: Record<string, string> = {
  documents: 'file',
  vaccination: 'syringe',
  condition: 'heart',
  medication: 'pill',
  allergy: 'alert',
  report: 'file',
  corrections: 'check',
}

interface PreviewItem {
  title: string
  fileName?: string
  fileUrl?: string
  fileType?: string
  date?: string
  provider?: string
  detail?: string
  event?: HealthEvent
}

function RecordChip({ kind, selected, count, onClick }: { kind: RecordKind; selected: boolean; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${chip} ${selected ? 'bg-brand text-white' : ''}`}
    >
      <span>{KIND_LABELS[kind]}</span>
      {typeof count === 'number' && count > 0 && (
        <span className={`ml-1.5 rounded-full px-1.5 py-0.2 text-[0.72rem] font-semibold ${selected ? 'bg-white/20 text-white' : 'bg-mist-2 text-ink-soft'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function RecordRow({ event, onPreview }: { event: HealthEvent; onPreview: (item: PreviewItem) => void }) {
  const iconName = (KIND_ICON[event.kind] ?? 'file') as any
  const isBirth = isBirthCertificate(event.title, event.fileName, event.kind)
  const hasDoc = !!event.fileUrl && !isBirth

  return (
    <li
      onClick={() => onPreview({
        title: event.title,
        fileName: isBirth ? undefined : event.fileName,
        fileUrl: isBirth ? undefined : event.fileUrl,
        fileType: isBirth ? undefined : event.fileType,
        date: event.date,
        provider: event.provider,
        detail: event.detail,
        event: event,
      })}
      className="flex items-start gap-4 py-4 first:pt-0 last:pb-0 cursor-pointer hover:bg-mist/40 px-2 rounded-xl transition-colors"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-mist text-ink-soft">
        <Icon name={iconName} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-ink truncate">{event.title}</p>
          {hasDoc && (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-deep">
              <Icon name="file" size={12} />
              Attached Document
            </span>
          )}
        </div>
        {event.detail && <p className="mt-0.5 text-sm text-ink-soft line-clamp-2">{event.detail}</p>}
        {event.provider && <p className="mt-1 text-xs text-ink-faint">Provider: {event.provider}</p>}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="text-xs text-ink-faint">{formatDate(event.date)}</span>
        {hasDoc && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPreview({
                title: event.title,
                fileName: event.fileName,
                fileUrl: event.fileUrl,
                fileType: event.fileType,
                date: event.date,
                provider: event.provider,
                detail: event.detail,
                event: event,
              })
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-brand/20 bg-brand-tint/60 px-2.5 py-1 text-xs font-semibold text-brand-deep hover:bg-brand-tint transition-colors"
          >
            <Icon name="file" size={12} />
            View Document
          </button>
        )}
      </div>
    </li>
  )
}

function DocumentCard({ doc, onPreview }: { doc: PatientDocument; onPreview: (item: PreviewItem) => void }) {
  const isPdf = doc.fileType === 'pdf' || (doc.fileName || '').toLowerCase().endsWith('.pdf')

  return (
    <div
      onClick={() => onPreview({
        title: doc.title,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        fileType: doc.fileType,
        date: doc.date,
        detail: `Type: ${doc.documentType || 'Medical Document'} · Status: ${doc.ocrStatus || 'Verified'}`,
      })}
      className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-white p-4 hover:border-brand/40 hover:shadow-xs transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
          <Icon name={isPdf ? 'file' : 'image'} size={22} />
        </span>
        <div className="min-w-0">
          <strong className="block text-[0.95rem] font-semibold text-ink truncate">
            {doc.title || doc.fileName}
          </strong>
          <p className="text-xs text-ink-soft truncate mt-0.5">
            {doc.fileName} {doc.fileSizeBytes ? `· ${formatBytes(doc.fileSizeBytes)}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="rounded-md bg-mist px-2 py-0.5 text-xs font-medium text-ink-soft uppercase tracking-wide">
              {doc.documentType || 'Document'}
            </span>
            <span className="text-xs text-ink-faint">
              {formatDate(doc.date)}
            </span>
          </div>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onPreview({
              title: doc.title,
              fileName: doc.fileName,
              fileUrl: doc.fileUrl,
              fileType: doc.fileType,
              date: doc.date,
              detail: `Type: ${doc.documentType || 'Medical Document'} · Status: ${doc.ocrStatus || 'Verified'}`,
            })
          }}
          className={`${button('primary', 'sm')} gap-1.5`}
        >
          <Icon name="file" size={14} />
          <span>Preview</span>
        </button>
        <span className="inline-flex items-center gap-1 text-[0.72rem] text-ink-faint bg-mist px-2 py-0.5 rounded font-medium">
          <Icon name="shield" size={11} />
          Preview Only
        </span>
      </div>
    </div>
  )
}

export default function DoctorPatientDetail() {
  const { mediclaimId } = useParams<{ mediclaimId: string }>()
  const [data, setData] = useState<{
    patient: any
    approvedScopes: string[]
    expiresAt: string
    records: HealthEvent[]
    documents?: PatientDocument[]
  } | null>(null)
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterKind, setFilterKind] = useState<RecordKind>('all')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addKind, setAddKind] = useState<RecordKind>('vaccination')
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null)

  const [reviewingCorrection, setReviewingCorrection] = useState<CorrectionRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  function load() {
    if (!mediclaimId) return
    setLoading(true)
    Promise.all([
      getAuthorizedRecords(mediclaimId),
      correctionsApi.getCorrections({ patientMediclaimId: mediclaimId }).catch(() => [] as CorrectionRequest[]),
    ])
      .then(([resData, corrData]) => {
        setData(resData)
        setCorrections(corrData)
      })
      .catch(() => setError('Failed to load patient records. You may not have access.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [mediclaimId])

  async function handleReviewCorrection(status: 'approved' | 'rejected') {
    if (!reviewingCorrection) return
    setSubmittingReview(true)
    try {
      await correctionsApi.reviewCorrection(reviewingCorrection.id, {
        status,
        reviewNotes: reviewNotes.trim() || undefined,
      })
      setReviewingCorrection(null)
      setReviewNotes('')
      load()
    } catch {
      alert('Failed to submit review. Please try again.')
    } finally {
      setSubmittingReview(false)
    }
  }

  const approvedScopes = (data?.approvedScopes ?? []).map((s) => s.toLowerCase())
  const hasDocumentScope = approvedScopes.includes('all') || approvedScopes.includes('document') || approvedScopes.includes('documents')

  // Enforce document scope and filter out birth certificates
  const rawDocuments = data?.documents ?? []
  const safeDocuments = rawDocuments.filter((d) => !isBirthCertificate(d.title, d.fileName, d.documentType))
  const documents = hasDocumentScope ? safeDocuments : []

  const rawRecords = data?.records ?? []
  const records = rawRecords.map((r) => {
    if (!hasDocumentScope || isBirthCertificate(r.title, r.fileName, r.kind)) {
      return { ...r, fileUrl: undefined, documentId: undefined }
    }
    return r
  })

  const recordsWithDocs = hasDocumentScope ? records.filter((r) => r.fileUrl) : []
  const totalDocsCount = hasDocumentScope
    ? documents.length + recordsWithDocs.filter((r) => !documents.some((d) => d.fileUrl === r.fileUrl)).length
    : 0

  const availableChips: RecordKind[] = hasDocumentScope
    ? ['all', 'documents', 'vaccination', 'condition', 'medication', 'allergy', 'report', 'corrections']
    : ['all', 'vaccination', 'condition', 'medication', 'allergy', 'report', 'corrections']

  const pendingCorrections = corrections.filter((c) => c.status === 'under_review')

  const filteredRecords = filterKind === 'all'
    ? records
    : filterKind === 'documents' || filterKind === 'corrections'
    ? []
    : records.filter((r) => r.kind === filterKind)

  function openAdd(kind: RecordKind) {
    setAddKind(kind === 'all' || kind === 'documents' || kind === 'corrections' ? 'vaccination' : kind)
    setAddModalOpen(true)
  }

  return (
    <div className="grid gap-7">
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Link to="/app/doctor/patients" className="hover:text-brand">My Patients</Link>
        <Icon name="chevron-right" size={14} />
        <span className="text-ink font-medium">{mediclaimId}</span>
      </div>

      {loading ? (
        <div className="grid gap-6">
          <div className="h-32 rounded-[26px] bg-white animate-pulse border border-line" />
          <div className="h-64 rounded-[26px] bg-white animate-pulse border border-line" />
        </div>
      ) : error ? (
        <div className={`${emptyBox} text-allergy-ink`}>
          <Icon name="lock" size={32} className="mx-auto" />
          <p className="mt-3 font-medium">{error}</p>
          <p className="mt-1 text-sm text-ink-soft">Request access from the patient first.</p>
          <Link to="/app/doctor/request-access" className={`${button('soft', 'sm')} mt-4`}>Request Access</Link>
        </div>
      ) : data ? (
        <>
          {/* Patient card */}
          <PageHeader
            title={data.patient?.fullName ?? mediclaimId}
            subtitle={`Mediclaim ID: ${mediclaimId} · Access expires ${formatDate(data.expiresAt)}`}
          >
            <button onClick={() => openAdd('all')} className={`${button('primary', 'md')} gap-2`}>
              <Icon name="plus" size={16} />
              Add record
            </button>
          </PageHeader>

          <div className={card}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-sm">
              <div>
                <p className="text-xs text-ink-faint">Gender</p>
                <p className="font-medium text-ink capitalize">{data.patient?.gender ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Date of birth</p>
                <p className="font-medium text-ink">{formatDate(data.patient?.dateOfBirth)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Blood group</p>
                <p className="font-medium text-ink">{data.patient?.bloodGroup ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Document Access</p>
                <p className={`font-semibold ${hasDocumentScope ? 'text-brand' : 'text-ink-soft'}`}>
                  {hasDocumentScope ? `${totalDocsCount} ${totalDocsCount === 1 ? 'file' : 'files'}` : 'Not Granted'}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Consent scope</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.approvedScopes?.map((s) => (
                    <span key={s} className="text-xs font-medium text-brand-deep bg-brand-tint rounded-full px-2 py-0.5 capitalize">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pending Corrections Banner */}
          {pendingCorrections.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-amber-600 text-white shrink-0">
                  <Icon name="alert" size={16} />
                </span>
                <div>
                  <strong className="block text-sm font-semibold">
                    {pendingCorrections.length} Correction Request{pendingCorrections.length > 1 ? 's' : ''} Pending Review
                  </strong>
                  <span className="text-xs text-amber-900">
                    The patient requested clinical amendments to their medical history.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilterKind('corrections')}
                className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition cursor-pointer"
              >
                Review Requests ({pendingCorrections.length})
              </button>
            </div>
          )}

          {/* Quick Documents Banner if files exist and document scope was granted */}
          {hasDocumentScope && documents.length > 0 && filterKind !== 'documents' && (
            <div className="rounded-[20px] border border-brand/20 bg-brand-tint/30 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon name="file" size={18} className="text-brand" />
                  <h3 className="font-semibold text-ink text-sm sm:text-base">
                    Patient Medical Documents ({documents.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterKind('documents')}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  View all documents →
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {documents.slice(0, 3).map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setPreviewItem({
                      title: doc.title,
                      fileName: doc.fileName,
                      fileUrl: doc.fileUrl,
                      fileType: doc.fileType,
                      date: doc.date,
                      detail: `Type: ${doc.documentType || 'Medical Document'} · Status: ${doc.ocrStatus || 'Verified'}`,
                    })}
                    className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 cursor-pointer hover:border-brand/40 transition-colors"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand">
                      <Icon name="file" size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink">{doc.title || doc.fileName}</p>
                      <span className="text-[0.72rem] text-ink-faint">{formatDate(doc.date)}</span>
                    </div>
                    <span className="text-xs font-semibold text-brand">View</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Records & Documents container */}
          <div className={card}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[1.1rem] font-semibold text-ink">
                {filterKind === 'documents' ? 'Medical Documents & Scans' : filterKind === 'corrections' ? 'Patient Correction Requests' : 'Clinical Records'}
              </h2>
              <div className="flex flex-wrap gap-2">
                {availableChips.map((k) => (
                  <RecordChip
                    key={k}
                    kind={k}
                    selected={filterKind === k}
                    count={k === 'documents' ? totalDocsCount : k === 'corrections' ? corrections.length : undefined}
                    onClick={() => setFilterKind(k)}
                  />
                ))}
              </div>
            </div>

            {/* If corrections filter is active */}
            {filterKind === 'corrections' ? (
              corrections.length === 0 ? (
                <div className={emptyBox}>
                  <Icon name="check" size={28} className="mx-auto text-ink-faint" />
                  <p className="mt-2 text-sm text-ink-soft">No correction requests submitted for this patient.</p>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {corrections.map((corr) => {
                    const isPending = corr.status === 'under_review'
                    return (
                      <div key={corr.id} className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex gap-3.5 min-w-0">
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
                            <Icon name="file" size={18} />
                          </span>
                          <div className="min-w-0 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="text-sm font-semibold text-ink">{corr.recordTitle}</strong>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                corr.status === 'under_review' ? 'bg-[#fff3cd] text-[#856404]' : corr.status === 'approved' ? 'bg-brand-tint text-brand-deep' : 'bg-allergy-tint text-allergy-ink'
                              }`}>
                                {corr.status.replace('_', ' ')}
                              </span>
                              <span className="text-ink-faint">Submitted {formatDate(corr.createdAt)}</span>
                            </div>
                            <p className="mt-1.5 text-ink bg-mist/60 rounded-xl p-2.5">
                              <strong className="text-ink-soft block mb-0.5">Patient Reason:</strong>
                              "{corr.reason}"
                            </p>
                            {corr.proposed && (
                              <p className="mt-1 text-brand-deep bg-brand-tint/30 rounded-xl p-2.5 border border-brand/10">
                                <strong className="text-brand block mb-0.5">Proposed Correction:</strong>
                                {corr.proposed}
                              </p>
                            )}
                            {corr.reviewNotes && (
                              <p className="mt-1 text-ink-soft italic">
                                Reviewer notes: {corr.reviewNotes}
                              </p>
                            )}
                          </div>
                        </div>
                        {isPending && (
                          <div className="shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewingCorrection(corr)
                                setReviewNotes('')
                              }}
                              className={`${button('soft', 'sm')} gap-1.5 text-xs cursor-pointer`}
                            >
                              <Icon name="check" size={14} />
                              Review & Decide
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            ) : filterKind === 'documents' ? (
              !hasDocumentScope ? (
                <div className={emptyBox}>
                  <Icon name="lock" size={32} className="mx-auto text-ink-faint" />
                  <p className="mt-3 text-sm font-semibold text-ink">Document Access Not Granted</p>
                  <p className="mt-1 text-xs text-ink-soft max-w-md mx-auto">
                    The patient has not granted consent to view medical documents & scans. You can only view clinical records within your approved consent scopes.
                  </p>
                </div>
              ) : documents.length === 0 && recordsWithDocs.length === 0 ? (
                <div className={emptyBox}>
                  <Icon name="file" size={32} className="mx-auto text-ink-faint" />
                  <p className="mt-3 text-sm font-medium text-ink">No documents found for this patient.</p>
                  <p className="mt-1 text-xs text-ink-soft">Patient has not uploaded any prescription or diagnostic documents yet.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {documents.map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} onPreview={setPreviewItem} />
                  ))}
                  {recordsWithDocs
                    .filter((r) => !documents.some((d) => d.fileUrl === r.fileUrl))
                    .map((r) => (
                      <DocumentCard
                        key={r.id}
                        doc={{
                          id: r.documentId || r.id,
                          documentId: r.documentId || r.id,
                          title: r.title,
                          fileName: r.fileName || `${r.title}.pdf`,
                          fileType: r.fileType || 'pdf',
                          fileSizeBytes: r.fileSizeBytes,
                          fileUrl: r.fileUrl || '',
                          documentType: r.kind,
                          date: r.date,
                        }}
                        onPreview={setPreviewItem}
                      />
                    ))}
                </div>
              )
            ) : filteredRecords.length === 0 ? (
              <div className={emptyBox}>
                <Icon name="file" size={28} className="mx-auto text-ink-faint" />
                <p className="mt-2 text-sm text-ink-soft">
                  {filterKind === 'all' ? 'No records found.' : `No ${KIND_LABELS[filterKind].toLowerCase()} records.`}
                </p>
                <button onClick={() => openAdd(filterKind)} className={`${button('soft', 'sm')} mt-3 gap-2`}>
                  <Icon name="plus" size={14} />
                  Add {filterKind === 'all' ? 'record' : KIND_LABELS[filterKind].toLowerCase().replace(/s$/, '')}
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {filteredRecords.map((r) => (
                  <RecordRow key={r.id} event={r} onPreview={setPreviewItem} />
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}

      {/* Document & Record Details Modal */}
      {previewItem && (
        <Modal
          open={!!previewItem}
          onClose={() => setPreviewItem(null)}
          title={previewItem.title}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 text-sm">
              <div>
                <span className="text-xs text-ink-faint block">Document / Record</span>
                <strong className="text-ink font-semibold">{previewItem.fileName || previewItem.title}</strong>
              </div>
              {previewItem.date && (
                <div>
                  <span className="text-xs text-ink-faint block">Date</span>
                  <span className="text-ink font-medium">{formatDate(previewItem.date)}</span>
                </div>
              )}
              {previewItem.provider && (
                <div>
                  <span className="text-xs text-ink-faint block">Provider</span>
                  <span className="text-ink font-medium">{previewItem.provider}</span>
                </div>
              )}
            </div>

            {previewItem.detail && (
              <div className="rounded-xl bg-mist p-3.5 text-sm text-ink-soft leading-relaxed">
                {previewItem.detail}
              </div>
            )}

            {/* Embedded Document Preview */}
            {isBirthCertificate(previewItem.title, previewItem.fileName) ? (
              <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
                <Icon name="shield" size={24} className="mx-auto mb-2 text-amber-600" />
                <strong className="block font-semibold">Access Restricted</strong>
                Access to official birth certificate documents is restricted. Practitioners are not permitted to preview or view birth certificates.
              </div>
            ) : previewItem.fileUrl ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase font-semibold tracking-wider text-ink-faint">
                    Attached Medical Document
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink-soft">
                    <Icon name="shield" size={13} className="text-brand-deep" />
                    Preview Only (Downloads Restricted)
                  </span>
                </div>
                <AuthenticatedFilePreview
                  fileUrl={previewItem.fileUrl}
                  fileName={previewItem.fileName}
                  fileType={previewItem.fileType}
                  readOnly={true}
                />
              </div>
            ) : (
              <div className="rounded-[16px] border border-line bg-mist p-6 text-center text-sm text-ink-soft">
                No electronic file attachment linked with this record.
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className={button('ghost', 'sm')}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Review Correction Modal */}
      {reviewingCorrection && (
        <Modal
          open={!!reviewingCorrection}
          onClose={() => setReviewingCorrection(null)}
          title="Review Patient Correction"
          description={`Clinical review for ${reviewingCorrection.recordTitle}`}
        >
          <div className="space-y-4 text-sm text-ink pt-2">
            <div className="rounded-xl bg-mist p-3 text-xs">
              <span className="font-semibold text-ink-soft block mb-1">Patient Reason:</span>
              <p className="text-ink">{reviewingCorrection.reason}</p>
            </div>

            {reviewingCorrection.proposed && (
              <div className="rounded-xl bg-brand-tint/40 border border-brand/20 p-3 text-xs">
                <span className="font-semibold text-brand-deep block mb-1">Proposed Correction:</span>
                <p className="text-brand-deep font-mono">{reviewingCorrection.proposed}</p>
              </div>
            )}

            <div>
              <label htmlFor="doc-rev-notes" className="text-xs font-semibold text-ink mb-1 block">
                Clinical Review Notes (Optional)
              </label>
              <textarea
                id="doc-rev-notes"
                className={textarea}
                rows={3}
                placeholder="Enter justification or medical documentation reference..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2.5 pt-3 border-t border-line justify-end">
              <button
                type="button"
                onClick={() => handleReviewCorrection('rejected')}
                disabled={submittingReview}
                className="rounded-xl border border-allergy-line bg-allergy-tint px-4 py-2 text-xs font-bold text-allergy-ink hover:bg-allergy-tint/80 transition cursor-pointer"
              >
                Reject Request
              </button>
              <button
                type="button"
                onClick={() => handleReviewCorrection('approved')}
                disabled={submittingReview}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-deep transition shadow-xs cursor-pointer"
              >
                Approve & Update Record
              </button>
            </div>
          </div>
        </Modal>
      )}

      {addModalOpen && mediclaimId && (
        <AddPatientRecordModal
          mediclaimId={mediclaimId}
          initialKind={addKind === 'all' || addKind === 'documents' || addKind === 'corrections' ? 'vaccination' : (addKind as any)}
          onClose={() => setAddModalOpen(false)}
          onAdded={() => { setAddModalOpen(false); load() }}
        />
      )}
    </div>
  )
}

