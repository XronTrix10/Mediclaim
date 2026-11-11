import { useMemo, useState } from 'react'
import Icon from '../components/Icon'
import HealthGraph from '../components/HealthGraph'
import PageHeader from '../components/PageHeader'
import { KindTag } from '../components/Kind'
import { events, kindOrder, kinds, patient } from '../data/mock'
import type { HealthEvent, Kind } from '../data/mock'
import { ageAt, formatDate } from '../lib/format'
import { chip } from '../lib/ui'

type View = 'timeline' | 'graph'
type Filter = 'all' | Kind

export default function Timeline() {
  const [view, setView] = useState<View>('timeline')
  const [filter, setFilter] = useState<Filter>('all')

  const years = useMemo(() => {
    const groups = new Map<string, HealthEvent[]>()
    events
      .filter((e) => filter === 'all' || e.kind === filter)
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((e) => {
        const year = e.date.slice(0, 4)
        groups.set(year, [...(groups.get(year) ?? []), e])
      })
    return [...groups.entries()]
  }, [filter])

  return (
    <>
      <PageHeader title="Your timeline" subtitle="Everything on record, from birth to today." />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-full border border-line bg-white p-1" role="tablist" aria-label="View">
          <button
            role="tab"
            aria-selected={view === 'timeline'}
            onClick={() => setView('timeline')}
            className={`rounded-full px-[22px] py-2 text-[0.92rem] font-semibold transition-colors ${
              view === 'timeline' ? 'bg-brand text-white' : 'text-ink-soft'
            }`}
          >
            Timeline
          </button>
          <button
            role="tab"
            aria-selected={view === 'graph'}
            onClick={() => setView('graph')}
            className={`rounded-full px-[22px] py-2 text-[0.92rem] font-semibold transition-colors ${
              view === 'graph' ? 'bg-brand text-white' : 'text-ink-soft'
            }`}
          >
            Graph
          </button>
        </div>
        {view === 'timeline' && (
          <div className="flex flex-wrap gap-2" aria-label="Filter by type">
            <button className={chip} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </button>
            {kindOrder.map((k) => (
              <button key={k} className={chip} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {kinds[k].plural}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'timeline' ? (
        <ol className="grid gap-1">
          {years.map(([year, items]) => (
            <li className="grid grid-cols-1 gap-2 sm:grid-cols-[96px_minmax(0,1fr)]" key={year}>
              <h2 className="static pt-0 pb-3 text-[1.9rem] leading-none sm:sticky sm:top-5 sm:self-start sm:pt-3.5 sm:pb-0">
                {year}
              </h2>
              <ul className="relative grid gap-3.5 pb-5 pl-9 before:absolute before:top-0 before:bottom-0 before:left-[7px] before:w-0.5 before:rounded-xs before:bg-line-strong sm:pb-7">
                {items.map((e) => (
                  <li
                    className="relative before:absolute before:top-[22px] before:-left-9 before:size-4 before:rounded-full before:border-[3px] before:border-(--k) before:bg-white after:absolute after:top-[29px] after:-left-5 after:h-0.5 after:w-5 after:bg-(--k) after:opacity-45"
                    key={e.id}
                    data-kind={e.kind}
                  >
                    <article className="rounded-[22px] border border-line bg-white p-[18px_22px] shadow-soft">
                      <header className="mb-2.5 flex flex-wrap items-center gap-2">
                        <KindTag kind={e.kind} />
                        {e.status && (
                          <span
                            className={`rounded-full px-[11px] py-[3px] text-[0.78rem] font-semibold ${
                              e.status === 'active' ? 'bg-brand-tint text-brand-deep' : 'bg-mist-2 text-ink-soft'
                            }`}
                          >
                            {e.status === 'active' ? 'Active' : 'Resolved'}
                          </span>
                        )}
                        <time dateTime={e.date} className="ml-auto text-[0.85rem] text-ink-faint">
                          {formatDate(e.date)}
                        </time>
                      </header>
                      <h3 className="mb-1 text-[1.25rem]">{e.title}</h3>
                      <p className="text-[0.95rem] text-ink-soft">{e.detail}</p>
                      <footer className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line-strong pt-3 text-[0.85rem] text-ink-faint">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name="stethoscope" size={15} />
                          {e.provider}
                        </span>
                        <span>{ageAt(patient.dob, e.date)}</span>
                      </footer>
                    </article>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <section className="rounded-[36px] border border-line bg-white p-4 sm:p-6 shadow-soft" aria-label="Health graph">
          <div className="overflow-x-auto [&>svg]:min-w-[640px]">
            <HealthGraph leaves={3} />
          </div>
          <ul className="mt-3 flex flex-wrap justify-center gap-x-[22px] gap-y-2 text-[0.88rem] text-ink-soft">
            {kindOrder.map((k) => (
              <li key={k} data-kind={k} className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-(--k)" />
                {kinds[k].plural}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
