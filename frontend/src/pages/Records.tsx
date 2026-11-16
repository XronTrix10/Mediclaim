import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import FilterChips from '../components/FilterChips'
import type { KindFilter } from '../components/FilterChips'
import { KindBubble, KindTag } from '../components/Kind'
import RecordDetailDialog from '../components/records/RecordDetailDialog'
import CorrectionDialog from '../components/records/CorrectionDialog'
import { PrescriptionUploader } from '../components/dashboard'
import type { UploaderHandle } from '../components/dashboard'
import { kindOrder } from '../data/mock'
import { formatDate, formatWhen } from '../lib/format'
import { downloadHistory } from '../lib/exportHistory'
import { button, card, cardFlush, input } from '../lib/ui'
import { useHealthData } from '../store/healthData'
import type { HealthEvent } from '../types'

export default function Records() {
  const { profile, events, corrections } = useHealthData()
  const [params, setParams] = useSearchParams()
  const uploader = useRef<UploaderHandle>(null)
  const [viewing, setViewing] = useState<HealthEvent | null>(null)
  const [correcting, setCorrecting] = useState<{ open: boolean; recordId?: string }>({ open: false })

  // Filters live in the URL, so links like /app/records?kind=allergy work and the back button behaves.
  const kindParam = params.get('kind')
  const filter: KindFilter = kindOrder.find((k) => k === kindParam) ?? 'all'
  const query = params.get('q') ?? ''

  const update = (next: { kind?: KindFilter; q?: string }) => {
    const p = new URLSearchParams(params)
    const kind = next.kind ?? filter
    const q = next.q ?? query
    if (kind === 'all') p.delete('kind')
    else p.set('kind', kind)
    if (q) p.set('q', q)
    else p.delete('q')
    setParams(p, { replace: true })
  }

  const needle = query.trim().toLowerCase()
  const rows = events.filter(
    (e) =>
      (filter === 'all' || e.kind === filter) &&
      (!needle || `${e.title} ${e.detail} ${e.provider}`.toLowerCase().includes(needle)),
  )

  return (
    <>
      <PrescriptionUploader ref={uploader} />
      <RecordDetailDialog
        record={viewing}
        onClose={() => setViewing(null)}
        onRequestCorrection={(r) => {
          setViewing(null)
          setCorrecting({ open: true, recordId: r.id })
        }}
      />
      <CorrectionDialog open={correcting.open} recordId={correcting.recordId} onClose={() => setCorrecting({ open: false })} />

      <PageHeader title="Records" subtitle="Prescriptions, reports, allergies and vaccinations in one list.">
        <button type="button" className={button('ghost')} onClick={() => downloadHistory(profile, events)}>
          <Icon name="download" size={18} />
          Download history
        </button>
        <button type="button" className={button('primary')} onClick={() => uploader.current?.openPicker()}>
          <Icon name="upload" size={18} />
          Upload record
        </button>
      </PageHeader>

      <div className="mb-5 grid gap-3 sm:mb-6 lg:flex lg:items-center lg:justify-between lg:gap-4">
        <div className="relative w-full lg:max-w-[360px]">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-faint">
            <Icon name="search" size={18} />
          </span>
          <input
            className={`${input} rounded-full pl-11`}
            type="search"
            placeholder="Search records or doctors"
            aria-label="Search records"
            value={query}
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>
        <div className="min-w-0">
          <FilterChips value={filter} onChange={(kind) => update({ kind })} />
        </div>
      </div>

      <section className={cardFlush} aria-label="Records">
        {rows.length === 0 ? (
          <div className="grid justify-items-start gap-1.5 px-2 py-7 text-ink-soft">
            <strong className="text-[1.05rem] font-semibold text-ink">
              {events.length === 0 ? 'No records yet' : 'No records match your search'}
            </strong>
            <p>
              {events.length === 0
                ? 'Upload a prescription or add an allergy from the overview page.'
                : 'Try a different word, or clear the filter to see everything.'}
            </p>
            {events.length > 0 && (
              <button
                className={`${button('soft', 'sm')} mt-2`}
                type="button"
                onClick={() => setParams({}, { replace: true })}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <ul>
            {rows.map((e) => (
              <li
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 gap-y-3 border-t border-line py-4 first:border-t-0 sm:items-center sm:gap-x-[18px] lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,220px)_auto]"
                key={e.id}
                data-kind={e.kind}
              >
                <KindBubble kind={e.kind} />
                <div className="min-w-0">
                  <strong className="block leading-[1.35] font-semibold [overflow-wrap:anywhere]">{e.title}</strong>
                  <small className="block text-[0.86rem] leading-[1.45] text-ink-faint [overflow-wrap:anywhere]">{e.detail}</small>
                  {/* Below 1024px the date and provider sit under the description; on wide screens they get their own column. */}
                  <small className="mt-1 block text-[0.82rem] text-ink-faint lg:hidden [overflow-wrap:anywhere]">
                    {formatDate(e.date)}, {e.provider}
                  </small>
                </div>
                <div className="hidden gap-0.5 text-[0.85rem] text-ink-faint lg:grid">
                  <span className="[overflow-wrap:anywhere]">{e.provider}</span>
                  <time dateTime={e.date}>{formatDate(e.date)}</time>
                </div>
                <div className="col-span-full flex items-center justify-between gap-3 lg:col-span-1 lg:justify-end">
                  <KindTag kind={e.kind} />
                  <button className={button('ghost', 'sm')} type="button" onClick={() => setViewing(e)}>
                    View
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {corrections.length > 0 && (
        <section className={`${card} mt-5`} aria-labelledby="corr-h">
          <h2 id="corr-h" className="mb-3 text-[1.2rem] sm:text-[1.35rem]">
            Your correction requests
          </h2>
          <ul className="grid gap-3">
            {corrections.map((c) => (
              <li key={c.id} className="rounded-[16px] bg-mist/70 p-3.5 text-[0.9rem]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="font-semibold [overflow-wrap:anywhere]">{c.recordTitle}</strong>
                  <span className="rounded-full bg-report-tint px-2.5 py-0.5 text-xs font-semibold text-report-ink">Under review</span>
                </div>
                <p className="mt-1 text-ink-soft [overflow-wrap:anywhere]">{c.reason}</p>
                <small className="mt-1 block text-xs text-ink-faint">Sent {formatWhen(c.createdAt)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-[28px] border border-line bg-white px-5 py-6 sm:mt-6 sm:rounded-[36px] sm:px-8 sm:py-7">
        <div className="min-w-0">
          <h2 className="mb-1 text-[1.2rem] sm:text-[1.35rem]">Spotted a mistake?</h2>
          <p className="text-ink-faint">Your doctors write these records, so changes are reviewed. The original stays in your history.</p>
        </div>
        <button className={`${button('soft')} max-sm:w-full`} type="button" onClick={() => setCorrecting({ open: true })}>
          Request a correction
        </button>
      </section>
    </>
  )
}
