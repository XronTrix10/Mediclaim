import { useState } from 'react'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { KindBubble, KindTag } from '../components/Kind'
import { events, kindOrder, kinds } from '../data/mock'
import type { Kind } from '../data/mock'
import { formatDate } from '../lib/format'
import { button, cardFlush, chip, input } from '../lib/ui'

type Filter = 'all' | Kind

export default function Records() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const rows = events.filter(
    (e) =>
      (filter === 'all' || e.kind === filter) &&
      `${e.title} ${e.detail} ${e.provider}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <>
      <PageHeader title="Records" subtitle="Prescriptions, reports, allergies and vaccinations in one list.">
        <button className={button('ghost')} type="button">
          <Icon name="download" size={18} />
          Download history
        </button>
        <button className={button('primary')} type="button">
          <Icon name="upload" size={18} />
          Upload a record
        </button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-[220px] max-w-[360px] flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
            <Icon name="search" size={18} />
          </span>
          <input
            className={`${input} rounded-full pl-11`}
            type="search"
            placeholder="Search records or doctors"
            aria-label="Search records"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
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
      </div>

      <section className={cardFlush}>
        {rows.length === 0 ? (
          <div className="grid justify-items-start gap-1.5 px-2 py-7 text-ink-soft">
            <strong className="text-[1.05rem] font-semibold text-ink">No records match your search</strong>
            <p>Try a different word, or clear the filter to see everything.</p>
            <button
              className={`${button('soft', 'sm')} mt-2`}
              type="button"
              onClick={() => {
                setQuery('')
                setFilter('all')
              }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <ul>
            {rows.map((e) => (
              <li
                className="grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto] min-[1001px]:grid-cols-[auto_minmax(0,1fr)_minmax(0,220px)_auto] items-center gap-[18px] py-4 border-t border-line first:border-t-0"
                key={e.id}
                data-kind={e.kind}
              >
                <KindBubble kind={e.kind} />
                <div className="min-w-0 flex-1">
                  <strong className="block font-semibold leading-[1.35]">{e.title}</strong>
                  <small className="block text-[0.86rem] leading-[1.45] text-ink-faint">{e.detail}</small>
                </div>
                <div className="hidden min-[1001px]:grid gap-0.5 text-[0.85rem] text-ink-faint">
                  <span>{e.provider}</span>
                  <time dateTime={e.date}>{formatDate(e.date)}</time>
                </div>
                <div className="flex items-center gap-3 max-sm:col-span-full max-sm:justify-between">
                  <KindTag kind={e.kind} />
                  <button className={button('ghost', 'sm')} type="button">
                    View
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-[36px] border border-line bg-white px-8 py-7">
        <div>
          <h2 className="mb-1 text-[1.35rem]">Spotted a mistake?</h2>
          <p className="text-ink-faint">
            Your doctors write these records, so changes are reviewed. The original stays in your history.
          </p>
        </div>
        <button className={button('soft')} type="button">
          Request a correction
        </button>
      </section>
    </>
  )
}
