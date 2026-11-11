import { useRef, useState } from 'react'
import Icon from '../Icon'
import { card, cardTitle, button, input } from '../../lib/ui'
import { formatDate } from '../../lib/format'
import type { PrescriptionRecord } from '../../types'

interface PrescriptionsSectionProps {
  prescriptions: PrescriptionRecord[]
  onUploadPrescription?: (prescription: PrescriptionRecord) => void
  onDeletePrescription?: (id: string) => void
}

export default function PrescriptionsSection({
  prescriptions,
  onUploadPrescription,
  onDeletePrescription,
}: PrescriptionsSectionProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [pendingFile, setPendingFile] = useState<{
    file: File
    fileType: 'pdf' | 'image'
  } | null>(null)
  const [docName, setDocName] = useState('')
  const [title, setTitle] = useState('')
  const [rxDate, setRxDate] = useState(() => new Date().toISOString().split('T')[0])
  const [viewingRx, setViewingRx] = useState<PrescriptionRecord | null>(null)

  // Sort prescriptions ordered by time (newest first)
  const sortedPrescriptions = [...prescriptions].sort((a, b) => b.date.localeCompare(a.date))

  const handleFileSelected = (fileType: 'pdf' | 'image') => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPendingFile({ file, fileType })
    setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '))
    setDocName('')
    setRxDate(new Date().toISOString().split('T')[0])

    // reset input value so re-uploading the same file triggers change
    e.target.value = ''
  }

  const handleConfirmUpload = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingFile) return

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const newRx: PrescriptionRecord = {
      id: `rx-${Date.now()}`,
      kind: 'medication',
      title: title.trim() || 'Medical Prescription',
      doctor: docName.trim() || 'Consultant Physician',
      date: rxDate,
      status: 'active',
      fileType: pendingFile.fileType,
      fileName: pendingFile.file.name,
      fileSize: formatSize(pendingFile.file.size),
      fileUrl: URL.createObjectURL(pendingFile.file),
    }

    onUploadPrescription?.(newRx)
    setPendingFile(null)
  }

  return (
    <section className={card} aria-labelledby="rx-section-h">
      <div className={cardTitle} id="rx-section-h">
        <div className="flex items-center gap-2">
          <h2>Saved Prescriptions</h2>
          {sortedPrescriptions.length > 0 && (
            <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-deep">
              {sortedPrescriptions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={button('soft', 'sm')}
            onClick={() => pdfInputRef.current?.click()}
          >
            <Icon name="upload" size={15} />
            Add prescription
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelected('pdf')}
        aria-label="Upload PDF prescription"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic"
        className="hidden"
        onChange={handleFileSelected('image')}
        aria-label="Upload image prescription"
      />

      {sortedPrescriptions.length === 0 ? (
        <div className="rounded-[18px] border-2 border-dashed border-line-strong px-6 py-10 text-center transition-colors hover:border-brand/50">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-mist text-ink-faint">
            <Icon name="file" size={24} />
          </span>
          <p className="font-semibold text-ink">No saved prescriptions yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.88rem] text-ink-soft">
            Upload digital copies of your doctor prescriptions (PDF or images). They will be archived in chronological order.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className={button('ghost', 'sm')}
              onClick={() => pdfInputRef.current?.click()}
            >
              <Icon name="file" size={16} />
              Upload PDF File
            </button>
            <button
              type="button"
              className={button('ghost', 'sm')}
              onClick={() => imageInputRef.current?.click()}
            >
              <Icon name="image" size={16} />
              Upload Image File
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2.5">
          <p className="text-xs text-ink-faint font-medium">
            Ordered by consultation date (newest first):
          </p>
          <ul className="grid gap-2">
            {sortedPrescriptions.map((rx) => (
              <li
                key={rx.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-line bg-mist/60 px-4 py-3 transition-colors hover:bg-mist"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-[12px] font-semibold text-xs ${
                      rx.fileType === 'pdf'
                        ? 'bg-allergy-tint text-allergy-ink'
                        : 'bg-brand-tint text-brand-deep'
                    }`}
                  >
                    {rx.fileType === 'pdf' ? 'PDF' : 'IMG'}
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-[0.92rem] font-semibold text-ink">
                      {rx.title}
                    </strong>
                    <p className="truncate text-xs text-ink-faint">
                      {rx.doctor} {rx.organization ? `· ${rx.organization}` : ''} ·{' '}
                      <span className="font-medium text-ink-soft">{formatDate(rx.date)}</span>
                      {rx.fileSize && ` · ${rx.fileSize}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={button('ghost', 'sm')}
                    onClick={() => setViewingRx(rx)}
                  >
                    View
                  </button>
                  {onDeletePrescription && (
                    <button
                      type="button"
                      className="p-1.5 text-ink-faint hover:text-allergy transition-colors"
                      title="Remove prescription"
                      onClick={() => onDeletePrescription(rx.id)}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Details Modal */}
      {pendingFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[26px] border border-line bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-ink">Prescription Details</h3>
              <button
                type="button"
                className="text-ink-faint hover:text-ink"
                onClick={() => setPendingFile(null)}
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="mb-4 rounded-[14px] bg-brand-tint/60 p-3 text-xs text-brand-deep flex items-center gap-2">
              <Icon name="file" size={16} />
              <span className="truncate">File: <strong>{pendingFile.file.name}</strong></span>
            </div>

            <form onSubmit={handleConfirmUpload} className="grid gap-3.5">
              <div className="grid gap-1">
                <label htmlFor="rx-title" className="text-xs font-semibold text-ink">
                  Prescription Title
                </label>
                <input
                  id="rx-title"
                  className={input}
                  placeholder="e.g. Annual Chest Physician Consultation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1">
                <label htmlFor="rx-doc" className="text-xs font-semibold text-ink">
                  Prescribing Doctor / Hospital
                </label>
                <input
                  id="rx-doc"
                  className={input}
                  placeholder="e.g. Dr. Rohan Kulkarni, Lifeline Clinic"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1">
                <label htmlFor="rx-date" className="text-xs font-semibold text-ink">
                  Date of Consultation
                </label>
                <input
                  id="rx-date"
                  type="date"
                  className={input}
                  value={rxDate}
                  onChange={(e) => setRxDate(e.target.value)}
                  required
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className={button('ghost', 'sm')}
                  onClick={() => setPendingFile(null)}
                >
                  Cancel
                </button>
                <button type="submit" className={button('primary', 'sm')}>
                  Save Prescription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Prescription Modal */}
      {viewingRx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-[26px] border border-line bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-lg font-medium text-ink">{viewingRx.title}</h3>
                <p className="text-xs text-ink-faint">
                  {viewingRx.doctor} · {formatDate(viewingRx.date)}
                </p>
              </div>
              <button
                type="button"
                className="text-ink-faint hover:text-ink"
                onClick={() => setViewingRx(null)}
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="mb-4 rounded-[18px] border border-line bg-mist p-4 text-center">
              {viewingRx.fileUrl && viewingRx.fileType === 'image' ? (
                <img
                  src={viewingRx.fileUrl}
                  alt={viewingRx.title}
                  className="mx-auto max-h-64 rounded-lg object-contain"
                />
              ) : (
                <div className="py-8">
                  <Icon name="file" size={48} className="mx-auto text-brand mb-2" />
                  <p className="text-sm font-semibold text-ink">{viewingRx.fileName}</p>
                  <p className="text-xs text-ink-faint mt-1">{viewingRx.fileSize || 'Standard PDF document'}</p>
                  {viewingRx.fileUrl && (
                    <a
                      href={viewingRx.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${button('primary', 'sm')} mt-4 inline-flex`}
                    >
                      Open Document
                    </a>
                  )}
                </div>
              )}
            </div>

            {viewingRx.instructions && (
              <div className="mb-4 text-xs text-ink-soft">
                <strong>Doctor's Notes:</strong> {viewingRx.instructions}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                className={button('ghost', 'sm')}
                onClick={() => setViewingRx(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

