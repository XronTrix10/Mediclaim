import Modal from '../Modal'
import AuthenticatedFilePreview from '../AuthenticatedFilePreview'
import { KindTag } from '../Kind'
import { button } from '../../lib/ui'
import { ageAt, formatDate } from '../../lib/format'
import { useHealthData } from '../../store/healthData'
import type { HealthEvent } from '../../types'

const sourceLabel = {
  self_reported: 'Reported by you',
  uploaded: 'Uploaded by you',
  practitioner: 'Entered by a doctor',
} as const

interface RecordDetailDialogProps {
  record: HealthEvent | null
  onClose: () => void
  onRequestCorrection: (record: HealthEvent) => void
}

export default function RecordDetailDialog({ record, onClose, onRequestCorrection }: RecordDetailDialogProps) {
  const { profile } = useHealthData()

  const rows: [string, string | undefined][] = record
    ? [
        ['Date', `${formatDate(record.date)} (${ageAt(profile.dateOfBirth, record.date).toLowerCase()})`],
        ['Provider', record.provider],
        ['Source', record.source ? sourceLabel[record.source] : undefined],
        ['Severity', record.severity],
        ['Reaction', record.reaction],
        ['Risk level', record.criticality === 'high' ? 'High' : record.criticality === 'low' ? 'Low' : undefined],
        ['Dosage', record.dosage],
        ['Dose', record.doseNumber ? `Dose ${record.doseNumber}` : undefined],
        ['Batch no.', record.batchNumber],
        ['File', record.fileName],
      ]
    : []

  return (
    <Modal open={!!record} onClose={onClose} title={record?.title ?? ''} size="lg">
      {record && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <KindTag kind={record.kind} />
            {record.status && (
              <span className="rounded-full bg-mist-2 px-2.5 py-0.5 text-xs font-semibold text-ink-soft capitalize">{record.status}</span>
            )}
          </div>
          <p className="text-[0.95rem] text-ink-soft">{record.detail}</p>
          <dl className="mt-5 grid gap-3 text-[0.88rem]">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="grid gap-0.5 border-t border-line pt-3 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
                  <dt className="text-ink-faint">{k}</dt>
                  <dd className="font-medium text-ink [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
          </dl>

          {record.fileUrl && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Attached document</p>
              <AuthenticatedFilePreview
                fileUrl={record.fileUrl}
                fileName={record.fileName}
                fileType={record.fileType}
              />
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={button('ghost', 'sm')} onClick={onClose}>
              Close
            </button>
            <button type="button" className={button('soft', 'sm')} onClick={() => onRequestCorrection(record)}>
              Request a correction
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
