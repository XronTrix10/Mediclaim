import { Link } from 'react-router-dom'
import Icon from '../Icon'
import CardHeader from '../CardHeader'
import { KindTag } from '../Kind'
import { button, card, emptyBox, textLink } from '../../lib/ui'
import { formatDate } from '../../lib/format'
import type { HealthEvent } from '../../types'

const PREVIEW_COUNT = 6

const emptySlots = [
  ['Birth and early vaccinations', 'Maternity card, BCG and Hepatitis B records'],
  ['Conditions and illnesses', 'Diagnosis summaries and discharge notes'],
  ['Prescriptions and medicines', 'Old and current prescriptions'],
  ['Lab and diagnostic reports', 'Blood work, scans and tests'],
]

interface TimelineSectionProps {
  events: HealthEvent[]
  sampleLoaded: boolean
  onUpload: () => void
  onToggleSample: () => void
  onUploadBirthCertificate?: () => void
}

function BirthMilestoneCard({
  event,
  onUploadBirthCertificate,
  onUpload,
}: {
  event: HealthEvent
  onUploadBirthCertificate?: () => void
  onUpload: () => void
}) {
  const triggerUpload = onUploadBirthCertificate || onUpload
  return (
    <div
      className={`rounded-[16px] border ${
        !event.hasCertificate
          ? 'border-amber-300/90 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20'
          : 'border-line bg-mist/60'
      } p-3.5`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <KindTag kind={event.kind} />
        <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[0.7rem] font-semibold text-brand-deep">
          Birth & Origin
        </span>
        {!event.hasCertificate ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Icon name="alert" size={12} />
            Missing certificate
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Icon name="check" size={12} />
            Verified
          </span>
        )}
        {event.fileUrl && (
          <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-[0.7rem] font-medium text-ink-soft">
            <Icon name={event.fileType === 'pdf' ? 'file' : 'image'} size={11} />
            Attached
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <p className="text-[0.92rem] leading-snug font-semibold text-ink [overflow-wrap:anywhere]">
          {event.title}
        </p>
        <span className="text-[0.75rem] font-medium text-brand">
          Starting point ({formatDate(event.date)})
        </span>
      </div>

      <p className="mt-1 text-[0.8rem] text-ink-soft [overflow-wrap:anywhere]">
        {event.detail}
      </p>

      <p className="mt-0.5 text-[0.75rem] text-ink-faint [overflow-wrap:anywhere]">
        {event.provider}
      </p>

      {!event.hasCertificate && (
        <div className="mt-2.5 rounded-[12px] border border-amber-200/80 bg-amber-50/80 p-2.5 text-[0.76rem] text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 text-sm">💡</span>
            <div className="leading-snug">
              <strong className="font-semibold">Birth & neonatal records:</strong>
              <p className="mt-0.5 text-ink-soft">
                Upload your birth certificate, maternity card, or early vaccinations like Hepatitis B (birth dose) and BCG.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={triggerUpload}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-[0.74rem] font-semibold text-white shadow-xs hover:bg-brand-deep transition-colors"
          >
            <Icon name="upload" size={12} />
            Upload birth certificate
          </button>
        </div>
      )}
    </div>
  )
}

export default function TimelineSection({
  events,
  sampleLoaded,
  onUpload,
  onToggleSample,
  onUploadBirthCertificate,
}: TimelineSectionProps) {
  const recent = events.slice(0, PREVIEW_COUNT)
  const hidden = events.length - recent.length
  const birthEvent = events.find((e) => e.isBirthRecord)
  const onlyBirthRecord = events.length === 1 && events[0].isBirthRecord

  return (
    <section className={card} aria-labelledby="timeline-h">
      <CardHeader
        id="timeline-h"
        title="Lifelong timeline"
        count={events.length > 0 ? events.length : undefined}
        actions={
          <>
            <button type="button" className={textLink} onClick={onToggleSample}>
              {sampleLoaded ? 'Clear sample data' : 'Load sample data'}
            </button>
            <Link className={textLink} to="/app/timeline">
              Full timeline
            </Link>
          </>
        }
      />

      {events.length === 0 ? (
        <div className="grid gap-4">
          <div className={emptyBox}>
            <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-mist text-ink-faint">
              <Icon name="timeline" size={24} />
            </span>
            <p className="font-semibold text-ink">Your timeline is empty</p>
            <p className="mx-auto mt-1 max-w-xs text-[0.85rem] text-ink-soft">
              It will map every illness, medicine, surgery and vaccination from birth onwards.
            </p>
            <button type="button" className={`${button('soft', 'sm')} mt-4`} onClick={onUpload}>
              <Icon name="upload" size={15} />
              Upload first record
            </button>
          </div>

          <div className="rounded-[18px] bg-mist/60 p-4">
            <p className="mb-3 text-[0.85rem] font-semibold text-ink-soft">What will appear here</p>
            <ul className="relative grid gap-3.5 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-line-strong">
              {emptySlots.map(([title, hint]) => (
                <li key={title} className="relative">
                  <span className="absolute top-1.5 -left-6 size-3 rounded-full border-2 border-line-strong bg-white" />
                  <p className="text-[0.85rem] font-medium text-ink">{title}</p>
                  <span className="text-[0.78rem] text-ink-faint">{hint}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <>
          <ol className="relative grid gap-2.5 before:absolute before:top-3 before:bottom-3 before:left-[7px] before:w-0.5 before:rounded-full before:bg-line-strong">
            {recent.map((e) => (
              <li key={e.id} data-kind={e.kind} className="relative pl-7">
                <span className="absolute top-[18px] left-0 size-4 rounded-full border-[3px] border-(--k) bg-white" />
                {e.isBirthRecord ? (
                  <BirthMilestoneCard
                    event={e}
                    onUploadBirthCertificate={onUploadBirthCertificate}
                    onUpload={onUpload}
                  />
                ) : (
                  <div className="rounded-[14px] border border-line bg-mist/60 px-3.5 py-2.5">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <KindTag kind={e.kind} />
                      {e.status === 'active' && (
                        <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[0.7rem] font-semibold text-brand-deep">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[0.9rem] leading-snug font-semibold text-ink [overflow-wrap:anywhere]">{e.title}</p>
                    <p className="mt-0.5 text-[0.78rem] text-ink-faint [overflow-wrap:anywhere]">
                      {formatDate(e.date)}
                      {e.provider ? `, ${e.provider.split(',')[0]}` : ''}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>

          {hidden > 0 && (
            <Link to="/app/timeline" className={`${button('ghost', 'sm')} mt-4 w-full`}>
              See {hidden} older {hidden === 1 ? 'record' : 'records'}
            </Link>
          )}

          {birthEvent && !recent.some((e) => e.isBirthRecord) && (
            <div className="mt-4 border-t border-dashed border-line pt-3">
              <div className="mb-2 flex items-center justify-between text-[0.75rem] font-semibold tracking-wider text-ink-faint uppercase">
                <span>Timeline starting point</span>
                <span>{formatDate(birthEvent.date)}</span>
              </div>
              <BirthMilestoneCard
                event={birthEvent}
                onUploadBirthCertificate={onUploadBirthCertificate}
                onUpload={onUpload}
              />
            </div>
          )}

          {onlyBirthRecord && (
            <div className="mt-4 rounded-[18px] bg-mist/60 p-4">
              <p className="mb-3 text-[0.85rem] font-semibold text-ink-soft">What will appear here</p>
              <ul className="relative grid gap-3.5 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-line-strong">
                {emptySlots.slice(1).map(([title, hint]) => (
                  <li key={title} className="relative">
                    <span className="absolute top-1.5 -left-6 size-3 rounded-full border-2 border-line-strong bg-white" />
                    <p className="text-[0.85rem] font-medium text-ink">{title}</p>
                    <span className="text-[0.78rem] text-ink-faint">{hint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
