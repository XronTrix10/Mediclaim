import { Link } from 'react-router-dom'
import Icon from '../Icon'
import { KindTag } from '../Kind'
import { card, cardTitle, button } from '../../lib/ui'
import { formatDate } from '../../lib/format'
import type { HealthEvent } from '../../types'

interface TimelineSectionProps {
  events: HealthEvent[]
  onAddRecordClick?: () => void
  onToggleDemoData?: () => void
  isDemoDataLoaded?: boolean
}

export default function TimelineSection({
  events,
  onAddRecordClick,
  onToggleDemoData,
  isDemoDataLoaded,
}: TimelineSectionProps) {
  // Sort events chronologically descending (newest first)
  const sortedEvents = [...events].sort((a, b) => b.date.localeCompare(a.date))

  // Group events by year
  const groupedEvents = sortedEvents.reduce<
    { year: string; first: boolean; event: HealthEvent }[]
  >((acc, e) => {
    const year = e.date.slice(0, 4)
    const isFirst = acc.length === 0 || acc[acc.length - 1].year !== year
    acc.push({ year, first: isFirst, event: e })
    return acc
  }, [])

  return (
    <section className={`${card} flex flex-col`} aria-labelledby="timeline-h">
      <div className={cardTitle} id="timeline-h">
        <div className="flex items-center gap-2">
          <h2>Lifelong Timeline</h2>
          {events.length > 0 && (
            <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-deep">
              {events.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onToggleDemoData && (
            <button
              type="button"
              className="text-xs font-semibold text-brand hover:underline"
              onClick={onToggleDemoData}
            >
              {isDemoDataLoaded ? 'Clear to empty' : 'Load sample'}
            </button>
          )}
          <Link
            className="font-sans text-[0.88rem] font-semibold text-brand hover:underline hover:underline-offset-[3px]"
            to="/app/timeline"
          >
            Full timeline →
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-[20px] border-2 border-dashed border-line-strong p-6 text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-mist text-ink-faint">
              <Icon name="timeline" size={24} />
            </span>
            <p className="font-semibold text-ink">Lifelong Medical Timeline Empty</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-ink-soft">
              Your timeline maps all diseases, medicines, surgeries, and vaccinations from birth to death.
            </p>
            {onAddRecordClick && (
              <button
                type="button"
                className={`${button('soft', 'sm')} mt-4`}
                onClick={onAddRecordClick}
              >
                <Icon name="upload" size={15} />
                Upload first record
              </button>
            )}
          </div>

          {/* Empty timeline placeholder slots */}
          <div className="rounded-[18px] bg-mist/50 p-4">
            <p className="mb-3 text-xs font-semibold text-ink-faint uppercase tracking-wider">
              Lifelong Timeline Slots (Waiting for Records)
            </p>
            <div className="relative pl-6 space-y-4 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-0.5 before:bg-line-strong">
              <div className="relative">
                <span className="absolute -left-6 top-1 size-2.5 rounded-full border-2 border-line-strong bg-white" />
                <p className="text-xs font-medium text-ink">Birth &amp; Early Childhood Vaccinations</p>
                <span className="text-[0.72rem] text-ink-faint">Slot ready for maternity card &amp; BCG/Hep-B records</span>
              </div>
              <div className="relative">
                <span className="absolute -left-6 top-1 size-2.5 rounded-full border-2 border-line-strong bg-white" />
                <p className="text-xs font-medium text-ink">Chronic Conditions &amp; Illnesses</p>
                <span className="text-[0.72rem] text-ink-faint">Slot ready for diagnostic summaries</span>
              </div>
              <div className="relative">
                <span className="absolute -left-6 top-1 size-2.5 rounded-full border-2 border-line-strong bg-white" />
                <p className="text-xs font-medium text-ink">Prescriptions &amp; Medications</p>
                <span className="text-[0.72rem] text-ink-faint">Slot ready for old and active prescriptions</span>
              </div>
              <div className="relative">
                <span className="absolute -left-6 top-1 size-2.5 rounded-full border-2 border-line-strong bg-white" />
                <p className="text-xs font-medium text-ink">Diagnostic &amp; Lab Reports</p>
                <span className="text-[0.72rem] text-ink-faint">Slot ready for blood work, radiology &amp; tests</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ol className="relative max-h-[560px] overflow-y-auto pr-1">
          {/* Vertical continuous track line */}
          <span className="pointer-events-none absolute left-[11px] top-0 bottom-0 w-0.5 rounded-full bg-line-strong" />

          {groupedEvents.map(({ year, first, event: e }) => (
            <li key={e.id} data-kind={e.kind} className="relative pl-7">
              {/* Year marker */}
              {first && (
                <div className="sticky top-0 z-10 -mx-1 mb-1 mt-3 bg-white/95 py-0.5 backdrop-blur-sm first:mt-0">
                  <span className="font-display text-[1.05rem] font-medium text-ink-faint">{year}</span>
                </div>
              )}

              {/* Marker Dot */}
              <span className="absolute left-1.5 top-[18px] size-2.5 rounded-full border-2 border-(--k) bg-white ring-2 ring-(--kt)" />

              {/* Card */}
              <div className="mb-2 rounded-[14px] border border-line bg-mist/60 px-3.5 py-2.5 transition-colors hover:bg-mist">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <KindTag kind={e.kind} />
                  {e.status === 'active' && (
                    <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[0.7rem] font-semibold text-brand-deep">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[0.88rem] font-semibold leading-snug text-ink">{e.title}</p>
                <p className="mt-0.5 text-[0.78rem] text-ink-faint">
                  {formatDate(e.date)}
                  {e.provider ? ` · ${e.provider.split(',')[0]}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

