import { Suspense, lazy, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import FilterChips from '../components/FilterChips'
import type { KindFilter } from '../components/FilterChips'
import { KindTag } from '../components/Kind'
import { ageAt, formatDate } from '../lib/format'
import { button, emptyBox } from '../lib/ui'
import { useHealthData } from '../store/healthData'
import type { HealthEvent } from '../types'

// The graph library is large, so it is only downloaded when the Graph tab is first opened.
const HealthGraphFlow = lazy(() => import('../components/graph/HealthGraphFlow'))

type View = 'timeline' | 'graph'

export default function Timeline() {
  const { profile, events } = useHealthData()
  const [view, setView] = useState<View>('timeline')
  const [filter, setFilter] = useState<KindFilter>('all')

  const years = useMemo(() => {
    const groups = new Map<string, HealthEvent[]>()
    for (const e of events) {
      if (filter !== 'all' && e.kind !== filter) continue
      const year = e.date.slice(0, 4)
      groups.set(year, [...(groups.get(year) ?? []), e])
    }
    return [...groups.entries()]
  }, [events, filter])

  return (
    <>
      <PageHeader title="Your timeline" subtitle="Everything on record, from birth to today." />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="inline-flex rounded-full border border-line bg-white p-1" role="group" aria-label="View">
          {(['timeline', 'graph'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-5 py-2 text-[0.92rem] font-semibold capitalize transition-colors sm:px-[22px] ${
                view === v ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === 'timeline' && events.length > 0 && (
          <div className="min-w-0 max-w-full">
            <FilterChips value={filter} onChange={setFilter} />
          </div>
        )}
      </div>

      {view === 'graph' ? (
        <Suspense fallback={<div className="h-[62dvh] min-h-[380px] animate-pulse rounded-[26px] bg-white" aria-busy="true" />}>
          <HealthGraphFlow events={events} patientName={profile.fullName} dateOfBirth={profile.dateOfBirth} />
        </Suspense>
      ) : events.length === 0 ? (
        <div className={emptyBox}>
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-mist text-ink-faint">
            <Icon name="timeline" size={24} />
          </span>
          <p className="font-semibold text-ink">Your timeline is empty</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.88rem] text-ink-soft">
            Records you add or upload, and records your doctors enter, will appear here in date order.
          </p>
          <Link to="/app" className={`${button('soft', 'sm')} mt-4`}>
            Go to overview
          </Link>
        </div>
      ) : years.length === 0 ? (
        <p className="rounded-[18px] bg-white p-6 text-center text-ink-soft">No records of this type yet.</p>
      ) : (
        <ol className="grid gap-1">
          {years.map(([year, items]) => (
            <li className="grid grid-cols-1 gap-1 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-2" key={year}>
              <h2 className="pb-2 text-[1.6rem] leading-none sm:sticky sm:top-5 sm:self-start sm:pt-3.5 sm:pb-0 sm:text-[1.9rem]">{year}</h2>
              <ul className="relative grid gap-3.5 pb-5 pl-8 before:absolute before:top-0 before:bottom-0 before:left-[7px] before:w-0.5 before:rounded-xs before:bg-line-strong sm:pl-9 sm:pb-7">
                {items.map((e) => (
                  <li
                    className="relative before:absolute before:top-[22px] before:-left-8 before:size-4 before:rounded-full before:border-[3px] before:border-(--k) before:bg-white after:absolute after:top-[29px] after:-left-4 after:h-0.5 after:w-4 after:bg-(--k) after:opacity-45 sm:before:-left-9 sm:after:-left-5 sm:after:w-5"
                    key={e.id}
                    data-kind={e.kind}
                  >
                    <article className="rounded-[22px] border border-line bg-white px-4 py-4 shadow-soft sm:px-[22px] sm:py-[18px]">
                      <header className="mb-2.5 flex flex-wrap items-center gap-2">
                        <KindTag kind={e.kind} />
                        {e.status && (
                          <span
                            className={`rounded-full px-[11px] py-[3px] text-[0.78rem] font-semibold capitalize ${
                              e.status === 'active' ? 'bg-brand-tint text-brand-deep' : 'bg-mist-2 text-ink-soft'
                            }`}
                          >
                            {e.status}
                          </span>
                        )}
                        <time dateTime={e.date} className="w-full text-[0.85rem] text-ink-faint sm:ml-auto sm:w-auto">
                          {formatDate(e.date)}
                        </time>
                      </header>
                      <h3 className="mb-1 text-[1.15rem] sm:text-[1.25rem] [overflow-wrap:anywhere]">{e.title}</h3>
                      <p className="text-[0.92rem] text-ink-soft sm:text-[0.95rem]">{e.detail}</p>
                      <footer className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dashed border-line-strong pt-3 text-[0.85rem] text-ink-faint">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Icon name="stethoscope" size={15} />
                          <span className="[overflow-wrap:anywhere]">{e.provider}</span>
                        </span>
                        <span>{ageAt(profile.dateOfBirth, e.date)}</span>
                      </footer>
                    </article>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
