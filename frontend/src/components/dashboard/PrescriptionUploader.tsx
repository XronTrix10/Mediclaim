import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { FormEvent, Ref } from 'react'
import Icon from '../Icon'
import Modal from '../Modal'
import AuthenticatedFilePreview from '../AuthenticatedFilePreview'
import { button, input, label } from '../../lib/ui'
import { formatFileSize, todayISO } from '../../lib/format'
import { useHealthData } from '../../store/healthData'
import { authApi } from '../../api/auth'
import { recordsApi } from '../../api/records'
import type { ParsedDocumentPayload } from '../../api/records'
import type { Kind, RecordStatus } from '../../types'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp'

export interface UploaderHandle {
  openPicker: () => void
}

interface PendingFile {
  file: File
  fileType: 'pdf' | 'image'
  localPreviewUrl: string
}

type ModalPhase = 'idle' | 'parsing' | 'verify' | 'failed'

function emptyPayload(): ParsedDocumentPayload {
  return {
    documentType: 'other',
    confidence: 0,
    prescriptions: [],
    vaccinations: [],
    allergies: [],
    conditions: [],
    medications: [],
    reports: [],
    warnings: [],
  }
}

function countRecords(p: ParsedDocumentPayload): number {
  return (
    p.conditions.length +
    p.vaccinations.length +
    p.prescriptions.length +
    p.medications.length +
    p.allergies.length +
    p.reports.length
  )
}

/**
 * Hidden file picker + mandatory Gemini document extraction flow:
 * - On success: displays full editable verification forms + live document preview before saving.
 * - On failure: displays "Failed to extract data, upload anyway" + live document preview + manual upload form.
 */
export default function PrescriptionUploader({ ref }: { ref?: Ref<UploaderHandle> }) {
  const { actions } = useHealthData()
  const inputRef = useRef<HTMLInputElement>(null)

  const [pending, setPending] = useState<PendingFile | null>(null)
  const [phase, setPhase] = useState<ModalPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [documentId, setDocumentId] = useState<string | null>(null)
  const [remoteFileUrl, setRemoteFileUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [failureBanner, setFailureBanner] = useState<string>('Failed to extract data, upload anyway')

  // Editable structured payload when Gemini extraction succeeds
  const [payload, setPayload] = useState<ParsedDocumentPayload>(emptyPayload())

  // Manual fallback fields when Gemini extraction fails ("upload anyway")
  const [fallbackKind, setFallbackKind] = useState<Kind>('report')
  const [fallbackTitle, setFallbackTitle] = useState('')
  const [fallbackDate, setFallbackDate] = useState(todayISO())
  const [fallbackStatus, setFallbackStatus] = useState<RecordStatus>('completed')
  const [fallbackProvider, setFallbackProvider] = useState('')
  const [fallbackDetail, setFallbackDetail] = useState('')

  useImperativeHandle(ref, () => ({ openPicker: () => inputRef.current?.click() }), [])

  useEffect(() => {
    return () => {
      if (pending?.localPreviewUrl) URL.revokeObjectURL(pending.localPreviewUrl)
    }
  }, [pending])

  const resetState = () => {
    if (pending?.localPreviewUrl) URL.revokeObjectURL(pending.localPreviewUrl)
    setPending(null)
    setPhase('idle')
    setSaveError(null)
    setSaving(false)
    setDocumentId(null)
    setRemoteFileUrl(null)
    setShowPreview(true)
    setPayload(emptyPayload())
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const isPdf = file.type === 'application/pdf'
    const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    if (!isPdf && !isImage) return setError('Please choose a PDF, PNG, JPEG or WEBP file.')
    if (file.size > MAX_BYTES) return setError(`That file is ${formatFileSize(file.size)}. The limit is 10 MB.`)

    const defaultTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Uploaded medical document'
    const localPreviewUrl = URL.createObjectURL(file)
    setPending({ file, fileType: isPdf ? 'pdf' : 'image', localPreviewUrl })
    setFallbackTitle(defaultTitle)
    setFallbackDate(todayISO())
    setFallbackProvider('')
    setFallbackDetail('')
    setFallbackKind('report')
    setFallbackStatus('completed')
    setSaveError(null)
    setShowPreview(true)

    if (!authApi.isAuthenticated()) {
      setFailureBanner('Failed to extract data, upload anyway')
      setPhase('failed')
      return
    }

    setPhase('parsing')
    try {
      const res = await recordsApi.uploadAndParseDocument(file, { title: defaultTitle })
      setDocumentId(res.documentId)
      setRemoteFileUrl(res.fileUrl)

      if (res.ocrStatus === 'needs_review' && res.extractedData && countRecords(res.extractedData) > 0) {
        setPayload(res.extractedData)
        setPhase('verify')
      } else {
        setFailureBanner(res.failureMessage || 'Failed to extract data, upload anyway')
        setPhase('failed')
      }
    } catch {
      setFailureBanner('Failed to extract data, upload anyway')
      setPhase('failed')
    }
  }

  // Commit verified Gemini-extracted forms
  const saveVerified = async (e: FormEvent) => {
    e.preventDefault()
    if (!pending) return
    if (countRecords(payload) === 0) {
      setSaveError('Add at least one record before saving.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      if (authApi.isAuthenticated() && documentId) {
        await recordsApi.commitParsedDocument(documentId, payload)
        await actions.refreshData()
      }
      resetState()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save verified records.')
      setSaving(false)
    }
  }

  // Commit manual fallback record ("Upload anyway") while preserving file preview
  const saveFallbackUploadAnyway = async (e: FormEvent) => {
    e.preventDefault()
    if (!pending) return

    const cleanTitle = fallbackTitle.trim() || pending.file.name
    const cleanProvider = fallbackProvider.trim() || 'Uploaded document'
    const cleanDetail = fallbackDetail.trim() || `Attached file: ${pending.file.name}`
    const cleanDate = fallbackDate || todayISO()

    const manualPayload = emptyPayload()
    manualPayload.title = cleanTitle
    manualPayload.documentDate = cleanDate
    manualPayload.provider = cleanProvider

    if (fallbackKind === 'condition') {
      manualPayload.documentType = 'discharge_summary'
      manualPayload.conditions.push({
        conditionName: cleanTitle,
        status: fallbackStatus,
        onsetDate: cleanDate,
        provider: cleanProvider,
        notes: cleanDetail,
      })
    } else if (fallbackKind === 'vaccination') {
      manualPayload.documentType = 'vaccination'
      manualPayload.vaccinations.push({
        vaccineName: cleanTitle,
        doseNumber: 1,
        administeredDate: cleanDate,
        provider: cleanProvider,
        notes: cleanDetail,
      })
    } else if (fallbackKind === 'allergy') {
      manualPayload.documentType = 'allergy_note'
      manualPayload.allergies.push({
        allergen: cleanTitle,
        category: 'medication',
        severity: 'moderate',
        criticality: 'low',
        reaction: cleanDetail,
        identifiedDate: cleanDate,
        provider: cleanProvider,
      })
    } else if (fallbackKind === 'medication') {
      manualPayload.documentType = 'prescription'
      manualPayload.prescriptions.push({
        title: cleanTitle,
        doctor: cleanProvider,
        date: cleanDate,
        instructions: cleanDetail,
        medications: [],
      })
    } else {
      manualPayload.documentType = 'lab_report'
      manualPayload.reports.push({
        reportName: cleanTitle,
        reportType: 'lab',
        reportDate: cleanDate,
        conclusion: cleanDetail,
        provider: cleanProvider,
        labResults: [],
      })
    }

    setSaving(true)
    setSaveError(null)
    try {
      if (authApi.isAuthenticated() && documentId) {
        await recordsApi.commitParsedDocument(documentId, manualPayload)
        await actions.refreshData()
        resetState()
        return
      }

      // Offline / unauthenticated fallback
      actions.addPrescription({
        kind: 'medication',
        title: cleanTitle,
        doctor: cleanProvider,
        date: cleanDate,
        status: 'active',
        fileType: pending.fileType,
        fileName: pending.file.name,
        fileSize: formatFileSize(pending.file.size),
        fileUrl: pending.localPreviewUrl,
      })
      resetState()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save uploaded document.')
      setSaving(false)
    }
  }

  // Helpers to mutate individual extracted record cards in the verification form
  const addBlankRecord = (kind: 'condition' | 'vaccination' | 'prescription' | 'medication' | 'allergy' | 'report') => {
    const defaultDate = payload.documentDate || todayISO()
    const defaultProvider = payload.organization || payload.provider || ''
    setPayload((prev) => {
      if (kind === 'condition') {
        return {
          ...prev,
          conditions: [...prev.conditions, { conditionName: '', status: 'resolved', onsetDate: defaultDate, provider: defaultProvider, notes: '' }],
        }
      }
      if (kind === 'vaccination') {
        return {
          ...prev,
          vaccinations: [...prev.vaccinations, { vaccineName: '', doseNumber: 1, administeredDate: defaultDate, provider: defaultProvider, notes: '' }],
        }
      }
      if (kind === 'prescription') {
        return {
          ...prev,
          prescriptions: [...prev.prescriptions, { title: '', doctor: defaultProvider, date: defaultDate, instructions: '', medications: [] }],
        }
      }
      if (kind === 'medication') {
        return {
          ...prev,
          medications: [...prev.medications, { medicationName: '', dosage: '', startDate: defaultDate, status: 'active', provider: defaultProvider, instructions: '' }],
        }
      }
      if (kind === 'allergy') {
        return {
          ...prev,
          allergies: [...prev.allergies, { allergen: '', category: 'medication', severity: 'moderate', criticality: 'low', reaction: '', identifiedDate: defaultDate, provider: defaultProvider }],
        }
      }
      return {
        ...prev,
        reports: [...prev.reports, { reportName: '', reportType: 'lab', reportDate: defaultDate, provider: defaultProvider, conclusion: '', labResults: [] }],
      }
    })
  }

  const previewUrl = pending?.localPreviewUrl || remoteFileUrl || undefined

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onFile}
        aria-label="Choose a medical document file"
        tabIndex={-1}
      />

      <Modal open={!!error} onClose={() => setError(null)} title="That file can't be used" size="md">
        <p role="alert" className="text-[0.95rem] text-ink-soft">
          {error}
        </p>
        <div className="mt-5 flex justify-end">
          <button type="button" className={button('primary', 'sm')} onClick={() => setError(null)}>
            OK
          </button>
        </div>
      </Modal>

      <Modal
        open={!!pending}
        onClose={resetState}
        size="lg"
        title={
          phase === 'parsing'
            ? 'Extracting medical record...'
            : phase === 'verify'
              ? 'Verify extracted records'
              : 'Upload document'
        }
        description={
          phase === 'parsing'
            ? 'Gemini is reading your document and structuring clinical details for your timeline.'
            : phase === 'verify'
              ? 'Review and edit the extracted fields below before saving to your timeline.'
              : 'You can still save and preview this file on your timeline.'
        }
      >
        {pending && (
          <div className="grid gap-4">
            {/* File bar + preview toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-brand-tint/70 p-3 text-xs text-brand-deep">
              <div className="flex min-w-0 items-center gap-2">
                <Icon name={pending.fileType === 'pdf' ? 'file' : 'image'} size={16} />
                <span className="min-w-0 truncate">
                  <strong>{pending.file.name}</strong> ({formatFileSize(pending.file.size)})
                </span>
              </div>
              <button
                type="button"
                className="rounded-full bg-white/85 px-3 py-1 font-semibold text-brand-deep hover:bg-white"
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? 'Hide preview' : 'Preview file'}
              </button>
            </div>

            {showPreview && (
              <AuthenticatedFilePreview
                fileUrl={previewUrl}
                fileName={pending.file.name}
                fileType={pending.fileType}
                compact
              />
            )}

            {/* PHASE 1: PARSING */}
            {phase === 'parsing' && (
              <div className="flex flex-col items-center justify-center rounded-[20px] border border-line bg-mist/60 px-6 py-9 text-center text-sm text-ink-soft shadow-inner">
                <div className="relative mb-3 flex size-12 items-center justify-center">
                  <div className="size-12 animate-spin rounded-full border-[3px] border-brand-tint border-t-brand" />
                  <div className="absolute size-2.5 rounded-full bg-brand animate-ping" />
                </div>
                <p className="font-semibold text-ink text-[1rem]">Analyzing document with Gemini...</p>
                <p className="mt-1 max-w-sm text-xs text-ink-faint">
                  Reading medical text, prescriptions, doses, diagnoses, and lab results into structured timeline records.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-tint/80 px-3.5 py-1 text-[11px] font-semibold text-brand-deep">
                  <span className="size-2 rounded-full bg-brand animate-pulse" />
                  Multimodal clinical extraction in progress
                </div>
              </div>
            )}

            {/* PHASE 2A: FAILED -> "Failed to extract data, upload anyway" */}
            {phase === 'failed' && (
              <form onSubmit={saveFallbackUploadAnyway} className="grid gap-4">
                <div role="alert" className="rounded-[14px] border border-allergy-ink/25 bg-allergy-tint/70 px-4 py-3 text-sm font-semibold text-allergy-ink">
                  {failureBanner}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label htmlFor="fb-kind" className={label}>Record type</label>
                    <select
                      id="fb-kind"
                      className={input}
                      value={fallbackKind}
                      onChange={(e) => {
                        const k = e.target.value as Kind
                        setFallbackKind(k)
                        setFallbackStatus(k === 'condition' ? 'resolved' : k === 'vaccination' || k === 'report' ? 'completed' : 'active')
                      }}
                    >
                      <option value="report">Report</option>
                      <option value="condition">Condition</option>
                      <option value="vaccination">Vaccination</option>
                      <option value="medication">Prescription / Medication</option>
                      <option value="allergy">Allergy</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="fb-date" className={label}>Event date</label>
                    <input id="fb-date" type="date" max={todayISO()} className={input} value={fallbackDate} onChange={(e) => setFallbackDate(e.target.value)} required />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="fb-title" className={label}>Title</label>
                  <input id="fb-title" className={input} value={fallbackTitle} onChange={(e) => setFallbackTitle(e.target.value)} required />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label htmlFor="fb-provider" className={label}>Hospital, clinic or doctor</label>
                    <input id="fb-provider" className={input} placeholder="e.g., Sion Government Hospital" value={fallbackProvider} onChange={(e) => setFallbackProvider(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="fb-status" className={label}>Status</label>
                    <select id="fb-status" className={input} value={fallbackStatus} onChange={(e) => setFallbackStatus(e.target.value as RecordStatus)}>
                      <option value="completed">Completed</option>
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="fb-detail" className={label}>Summary / Notes</label>
                  <textarea id="fb-detail" rows={2} className={input} placeholder="Short summary shown on your timeline" value={fallbackDetail} onChange={(e) => setFallbackDetail(e.target.value)} />
                </div>

                {saveError && <p role="alert" className="text-xs font-medium text-allergy-ink">{saveError}</p>}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" className={button('ghost', 'sm')} onClick={resetState} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className={button('primary', 'sm')} disabled={saving}>
                    {saving ? 'Uploading...' : 'Upload anyway'}
                  </button>
                </div>
              </form>
            )}

            {/* PHASE 2B: VERIFY EXTRACTED FORMS */}
            {phase === 'verify' && (
              <form onSubmit={saveVerified} className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line bg-mist/60 px-3.5 py-2.5 text-xs">
                  <span className="font-semibold text-ink">
                    Extracted {countRecords(payload)} record(s) via Gemini ({Math.round((payload.confidence || 0) * 100)}% confidence)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(['condition', 'vaccination', 'report', 'prescription', 'allergy'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => addBlankRecord(k)}
                        className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[11px] font-semibold capitalize text-ink-soft hover:border-brand hover:text-brand"
                      >
                        + {k}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid max-h-[48vh] gap-3 overflow-y-auto pr-1">
                  {/* CONDITIONS */}
                  {payload.conditions.map((c, idx) => (
                    <div key={`cond-${idx}`} className="grid gap-3 rounded-[16px] border border-line bg-white p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-condition-tint px-2.5 py-0.5 text-xs font-semibold text-condition-ink">Condition</span>
                        <button
                          type="button"
                          className="text-xs text-ink-faint hover:text-allergy-ink"
                          onClick={() => setPayload((p) => ({ ...p, conditions: p.conditions.filter((_, i) => i !== idx) }))}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <label className={label}>Condition name</label>
                          <input
                            className={input}
                            required
                            value={c.conditionName}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                conditions: p.conditions.map((item, i) => (i === idx ? { ...item, conditionName: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Status</label>
                          <select
                            className={input}
                            value={c.status || 'active'}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                conditions: p.conditions.map((item, i) => (i === idx ? { ...item, status: e.target.value } : item)),
                              }))
                            }
                          >
                            <option value="active">Active</option>
                            <option value="resolved">Resolved</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <label className={label}>Date</label>
                          <input
                            type="date"
                            className={input}
                            value={c.onsetDate || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                conditions: p.conditions.map((item, i) => (i === idx ? { ...item, onsetDate: e.target.value || undefined } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Hospital / Doctor</label>
                          <input
                            className={input}
                            value={c.provider || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                conditions: p.conditions.map((item, i) => (i === idx ? { ...item, provider: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <label className={label}>Clinical summary</label>
                        <textarea
                          rows={2}
                          className={input}
                          value={c.notes || ''}
                          onChange={(e) =>
                            setPayload((p) => ({
                              ...p,
                              conditions: p.conditions.map((item, i) => (i === idx ? { ...item, notes: e.target.value } : item)),
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}

                  {/* VACCINATIONS */}
                  {payload.vaccinations.map((v, idx) => (
                    <div key={`vac-${idx}`} className="grid gap-3 rounded-[16px] border border-line bg-white p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-vaccination-tint px-2.5 py-0.5 text-xs font-semibold text-vaccination-ink">Vaccination</span>
                        <button
                          type="button"
                          className="text-xs text-ink-faint hover:text-allergy-ink"
                          onClick={() => setPayload((p) => ({ ...p, vaccinations: p.vaccinations.filter((_, i) => i !== idx) }))}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <label className={label}>Vaccine name</label>
                          <input
                            className={input}
                            required
                            value={v.vaccineName}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                vaccinations: p.vaccinations.map((item, i) => (i === idx ? { ...item, vaccineName: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Administered date</label>
                          <input
                            type="date"
                            className={input}
                            value={v.administeredDate || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                vaccinations: p.vaccinations.map((item, i) => (i === idx ? { ...item, administeredDate: e.target.value || undefined } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="grid gap-1">
                          <label className={label}>Dose #</label>
                          <input
                            type="number"
                            min={1}
                            className={input}
                            value={v.doseNumber ?? 1}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                vaccinations: p.vaccinations.map((item, i) => (i === idx ? { ...item, doseNumber: Number(e.target.value) || 1 } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Batch no.</label>
                          <input
                            className={input}
                            value={v.batchNumber || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                vaccinations: p.vaccinations.map((item, i) => (i === idx ? { ...item, batchNumber: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Clinic / Hospital</label>
                          <input
                            className={input}
                            value={v.provider || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                vaccinations: p.vaccinations.map((item, i) => (i === idx ? { ...item, provider: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <label className={label}>Notes</label>
                        <input
                          className={input}
                          value={v.notes || ''}
                          onChange={(e) =>
                            setPayload((p) => ({
                              ...p,
                              vaccinations: p.vaccinations.map((item, i) => (i === idx ? { ...item, notes: e.target.value } : item)),
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}

                  {/* DIAGNOSTIC / BIRTH / LAB REPORTS */}
                  {payload.reports.map((r, idx) => (
                    <div key={`rep-${idx}`} className="grid gap-3 rounded-[16px] border border-line bg-white p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-report-tint px-2.5 py-0.5 text-xs font-semibold text-report-ink">Report</span>
                        <button
                          type="button"
                          className="text-xs text-ink-faint hover:text-allergy-ink"
                          onClick={() => setPayload((p) => ({ ...p, reports: p.reports.filter((_, i) => i !== idx) }))}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <label className={label}>Report title</label>
                          <input
                            className={input}
                            required
                            value={r.reportName}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                reports: p.reports.map((item, i) => (i === idx ? { ...item, reportName: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Report date</label>
                          <input
                            type="date"
                            className={input}
                            value={r.reportDate || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                reports: p.reports.map((item, i) => (i === idx ? { ...item, reportDate: e.target.value || undefined } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <label className={label}>Hospital / Lab</label>
                          <input
                            className={input}
                            value={r.provider || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                reports: p.reports.map((item, i) => (i === idx ? { ...item, provider: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Report type</label>
                          <input
                            className={input}
                            value={r.reportType || 'lab'}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                reports: p.reports.map((item, i) => (i === idx ? { ...item, reportType: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <label className={label}>Conclusion / Summary</label>
                        <textarea
                          rows={2}
                          className={input}
                          value={r.conclusion || ''}
                          onChange={(e) =>
                            setPayload((p) => ({
                              ...p,
                              reports: p.reports.map((item, i) => (i === idx ? { ...item, conclusion: e.target.value } : item)),
                            }))
                          }
                        />
                      </div>
                      {r.labResults && r.labResults.length > 0 && (
                        <div className="grid gap-2 rounded-[12px] bg-mist/60 p-2.5 text-xs">
                          <span className="font-semibold text-ink">Lab values ({r.labResults.length})</span>
                          {r.labResults.map((lr, lIdx) => (
                            <div key={lIdx} className="grid grid-cols-3 gap-2">
                              <input
                                className={input}
                                placeholder="Test"
                                value={lr.testName}
                                onChange={(e) =>
                                  setPayload((p) => ({
                                    ...p,
                                    reports: p.reports.map((rep, i) =>
                                      i === idx
                                        ? {
                                            ...rep,
                                            labResults: rep.labResults.map((row, j) =>
                                              j === lIdx ? { ...row, testName: e.target.value } : row,
                                            ),
                                          }
                                        : rep,
                                    ),
                                  }))
                                }
                              />
                              <input
                                className={input}
                                placeholder="Value"
                                value={lr.resultValue || ''}
                                onChange={(e) =>
                                  setPayload((p) => ({
                                    ...p,
                                    reports: p.reports.map((rep, i) =>
                                      i === idx
                                        ? {
                                            ...rep,
                                            labResults: rep.labResults.map((row, j) =>
                                              j === lIdx ? { ...row, resultValue: e.target.value } : row,
                                            ),
                                          }
                                        : rep,
                                    ),
                                  }))
                                }
                              />
                              <input
                                className={input}
                                placeholder="Unit / Range"
                                value={lr.unit || ''}
                                onChange={(e) =>
                                  setPayload((p) => ({
                                    ...p,
                                    reports: p.reports.map((rep, i) =>
                                      i === idx
                                        ? {
                                            ...rep,
                                            labResults: rep.labResults.map((row, j) =>
                                              j === lIdx ? { ...row, unit: e.target.value } : row,
                                            ),
                                          }
                                        : rep,
                                    ),
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* PRESCRIPTIONS */}
                  {payload.prescriptions.map((rx, idx) => (
                    <div key={`rx-${idx}`} className="grid gap-3 rounded-[16px] border border-line bg-white p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-deep">Prescription</span>
                        <button
                          type="button"
                          className="text-xs text-ink-faint hover:text-allergy-ink"
                          onClick={() => setPayload((p) => ({ ...p, prescriptions: p.prescriptions.filter((_, i) => i !== idx) }))}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <label className={label}>Title</label>
                          <input
                            className={input}
                            required
                            value={rx.title}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                prescriptions: p.prescriptions.map((item, i) => (i === idx ? { ...item, title: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Date</label>
                          <input
                            type="date"
                            className={input}
                            value={rx.date || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                prescriptions: p.prescriptions.map((item, i) => (i === idx ? { ...item, date: e.target.value || undefined } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <label className={label}>Doctor</label>
                          <input
                            className={input}
                            required
                            value={rx.doctor}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                prescriptions: p.prescriptions.map((item, i) => (i === idx ? { ...item, doctor: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Hospital / Clinic</label>
                          <input
                            className={input}
                            value={rx.organization || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                prescriptions: p.prescriptions.map((item, i) => (i === idx ? { ...item, organization: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <label className={label}>Instructions</label>
                        <input
                          className={input}
                          value={rx.instructions || ''}
                          onChange={(e) =>
                            setPayload((p) => ({
                              ...p,
                              prescriptions: p.prescriptions.map((item, i) => (i === idx ? { ...item, instructions: e.target.value } : item)),
                            }))
                          }
                        />
                      </div>
                      {rx.medications.length > 0 && (
                        <div className="grid gap-2 rounded-[12px] bg-mist/60 p-2.5 text-xs">
                          <span className="font-semibold text-ink">Medications ({rx.medications.length})</span>
                          {rx.medications.map((m, mIdx) => (
                            <div key={mIdx} className="grid grid-cols-3 gap-2">
                              <input
                                className={input}
                                placeholder="Medicine"
                                value={m.name}
                                onChange={(e) =>
                                  setPayload((p) => ({
                                    ...p,
                                    prescriptions: p.prescriptions.map((item, i) =>
                                      i === idx
                                        ? {
                                            ...item,
                                            medications: item.medications.map((row, j) =>
                                              j === mIdx ? { ...row, name: e.target.value } : row,
                                            ),
                                          }
                                        : item,
                                    ),
                                  }))
                                }
                              />
                              <input
                                className={input}
                                placeholder="Dosage"
                                value={m.dosage || ''}
                                onChange={(e) =>
                                  setPayload((p) => ({
                                    ...p,
                                    prescriptions: p.prescriptions.map((item, i) =>
                                      i === idx
                                        ? {
                                            ...item,
                                            medications: item.medications.map((row, j) =>
                                              j === mIdx ? { ...row, dosage: e.target.value } : row,
                                            ),
                                          }
                                        : item,
                                    ),
                                  }))
                                }
                              />
                              <input
                                className={input}
                                placeholder="Frequency / Duration"
                                value={m.frequency || ''}
                                onChange={(e) =>
                                  setPayload((p) => ({
                                    ...p,
                                    prescriptions: p.prescriptions.map((item, i) =>
                                      i === idx
                                        ? {
                                            ...item,
                                            medications: item.medications.map((row, j) =>
                                              j === mIdx ? { ...row, frequency: e.target.value } : row,
                                            ),
                                          }
                                        : item,
                                    ),
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* STANDALONE MEDICATIONS */}
                  {payload.medications.map((m, idx) => (
                    <div key={`med-${idx}`} className="grid gap-3 rounded-[16px] border border-line bg-white p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-deep">Medication</span>
                        <button
                          type="button"
                          className="text-xs text-ink-faint hover:text-allergy-ink"
                          onClick={() => setPayload((p) => ({ ...p, medications: p.medications.filter((_, i) => i !== idx) }))}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <label className={label}>Medication name</label>
                          <input
                            className={input}
                            required
                            value={m.medicationName}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                medications: p.medications.map((item, i) => (i === idx ? { ...item, medicationName: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Dosage</label>
                          <input
                            className={input}
                            value={m.dosage || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                medications: p.medications.map((item, i) => (i === idx ? { ...item, dosage: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <label className={label}>Start date</label>
                          <input
                            type="date"
                            className={input}
                            value={m.startDate || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                medications: p.medications.map((item, i) => (i === idx ? { ...item, startDate: e.target.value || undefined } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Provider</label>
                          <input
                            className={input}
                            value={m.provider || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                medications: p.medications.map((item, i) => (i === idx ? { ...item, provider: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* ALLERGIES */}
                  {payload.allergies.map((a, idx) => (
                    <div key={`alg-${idx}`} className="grid gap-3 rounded-[16px] border border-line bg-white p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-allergy-tint px-2.5 py-0.5 text-xs font-semibold text-allergy-ink">Allergy</span>
                        <button
                          type="button"
                          className="text-xs text-ink-faint hover:text-allergy-ink"
                          onClick={() => setPayload((p) => ({ ...p, allergies: p.allergies.filter((_, i) => i !== idx) }))}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <label className={label}>Allergen</label>
                          <input
                            className={input}
                            required
                            value={a.allergen}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                allergies: p.allergies.map((item, i) => (i === idx ? { ...item, allergen: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Reaction</label>
                          <input
                            className={input}
                            required
                            value={a.reaction}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                allergies: p.allergies.map((item, i) => (i === idx ? { ...item, reaction: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="grid gap-1">
                          <label className={label}>Severity</label>
                          <select
                            className={input}
                            value={a.severity || 'moderate'}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                allergies: p.allergies.map((item, i) => (i === idx ? { ...item, severity: e.target.value } : item)),
                              }))
                            }
                          >
                            <option value="mild">Mild</option>
                            <option value="moderate">Moderate</option>
                            <option value="severe">Severe</option>
                            <option value="life-threatening">Life-threatening</option>
                          </select>
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Date</label>
                          <input
                            type="date"
                            className={input}
                            value={a.identifiedDate || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                allergies: p.allergies.map((item, i) => (i === idx ? { ...item, identifiedDate: e.target.value || undefined } : item)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className={label}>Provider</label>
                          <input
                            className={input}
                            value={a.provider || ''}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                allergies: p.allergies.map((item, i) => (i === idx ? { ...item, provider: e.target.value } : item)),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {saveError && <p role="alert" className="text-xs font-medium text-allergy-ink">{saveError}</p>}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" className={button('ghost', 'sm')} onClick={resetState} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className={button('primary', 'sm')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save verified records'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
