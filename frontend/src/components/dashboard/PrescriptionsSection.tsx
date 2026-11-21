import { useState } from 'react'
import Icon from '../Icon'
import Modal from '../Modal'
import CardHeader from '../CardHeader'
import AuthenticatedFilePreview from '../AuthenticatedFilePreview'
import { button, card, emptyBox } from '../../lib/ui'
import { formatDate } from '../../lib/format'
import type { PrescriptionRecord } from '../../types'

interface PrescriptionsSectionProps {
  prescriptions: PrescriptionRecord[]
  onAdd: () => void
  onDelete: (id: string) => void
}

export default function PrescriptionsSection({ prescriptions, onAdd, onDelete }: PrescriptionsSectionProps) {
  const [viewing, setViewing] = useState<PrescriptionRecord | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const sorted = [...prescriptions].sort((a, b) => b.date.localeCompare(a.date))

  const remove = (rx: PrescriptionRecord) => {
    if (rx.fileUrl?.startsWith('blob:')) URL.revokeObjectURL(rx.fileUrl)
    onDelete(rx.id)
    setConfirmingId(null)
  }

  return (
    <section className={card} aria-labelledby="rx-section-h">
      <CardHeader
        id="rx-section-h"
        title="Saved prescriptions"
        count={sorted.length > 0 ? sorted.length : undefined}
        actions={
          <button type="button" className={button('soft', 'sm')} onClick={onAdd}>
            <Icon name="upload" size={15} />
            Add prescription
          </button>
        }
      />

      {sorted.length === 0 ? (
        <div className={emptyBox}>
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-mist text-ink-faint">
            <Icon name="file" size={24} />
          </span>
          <p className="font-semibold text-ink">No saved prescriptions yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.88rem] text-ink-soft">
            Upload a PDF or a photo of a prescription. They are kept in order, newest first.
          </p>
          <button type="button" className={`${button('ghost', 'sm')} mt-5`} onClick={onAdd}>
            <Icon name="upload" size={16} />
            Choose a file
          </button>
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {sorted.map((rx) => (
            <li key={rx.id} className="rounded-[16px] border border-line bg-mist/60 p-3 sm:px-4">
              {confirmingId === rx.id ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[0.88rem] font-medium text-ink">Remove &ldquo;{rx.title}&rdquo;?</p>
                  <div className="flex gap-2">
                    <button type="button" className={button('ghost', 'sm')} onClick={() => setConfirmingId(null)}>
                      Keep
                    </button>
                    <button type="button" className={button('danger', 'sm')} onClick={() => remove(rx)}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-[12px] text-xs font-semibold ${
                      rx.fileType === 'pdf' ? 'bg-allergy-tint text-allergy-ink' : 'bg-brand-tint text-brand-deep'
                    }`}
                  >
                    {rx.fileType === 'pdf' ? 'PDF' : 'IMG'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[0.92rem] leading-snug font-semibold text-ink [overflow-wrap:anywhere]">{rx.title}</strong>
                    <p className="text-xs leading-relaxed text-ink-faint [overflow-wrap:anywhere]">
                      {rx.doctor}
                      {rx.organization ? `, ${rx.organization}` : ''}
                      <br />
                      <span className="font-medium text-ink-soft">{formatDate(rx.date)}</span>
                      {rx.fileSize && ` \u00b7 ${rx.fileSize}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" className={button('ghost', 'sm')} onClick={() => setViewing(rx)}>
                      View
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${rx.title}`}
                      className="grid size-9 place-items-center rounded-full text-ink-faint transition-colors hover:bg-allergy-tint hover:text-allergy-ink"
                      onClick={() => setConfirmingId(rx.id)}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title ?? ''}
        description={viewing ? `${viewing.doctor}, ${formatDate(viewing.date)}` : undefined}
        size="lg"
      >
        {viewing && (
          <>
            <AuthenticatedFilePreview
              fileUrl={viewing.fileUrl}
              fileName={viewing.fileName}
              fileType={viewing.fileType}
            />
            {viewing.medications && viewing.medications.length > 0 && (
              <div className="mt-4 rounded-[14px] border border-line bg-mist/50 p-3 text-xs">
                <p className="mb-1.5 font-semibold text-ink">Medications</p>
                <ul className="grid gap-1 text-ink-soft">
                  {viewing.medications.map((m, idx) => (
                    <li key={idx}>
                      <strong className="text-ink">{m.name}</strong>
                      {[m.dosage, m.frequency, m.duration].filter(Boolean).length > 0 &&
                        ` — ${[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ')}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {viewing.instructions && (
              <p className="mt-4 text-[0.88rem] text-ink-soft">
                <strong className="text-ink">Doctor&rsquo;s notes:</strong> {viewing.instructions}
              </p>
            )}
            <div className="mt-5 flex justify-end">
              <button type="button" className={button('ghost', 'sm')} onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
          </>
        )}
      </Modal>
    </section>
  )
}
