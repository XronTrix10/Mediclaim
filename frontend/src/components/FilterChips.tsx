import { kindOrder, kinds } from '../data/mock'
import { chip } from '../lib/ui'
import type { Kind } from '../types'

export type KindFilter = 'all' | Kind

interface FilterChipsProps {
  value: KindFilter
  onChange: (value: KindFilter) => void
}

/** One scrollable row on phones, wrapping row on larger screens. */
export default function FilterChips({ value, onChange }: FilterChipsProps) {
  return (
    <div
      role="group"
      aria-label="Filter by type"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>button]:shrink-0"
    >
      <button type="button" className={chip} aria-pressed={value === 'all'} onClick={() => onChange('all')}>
        All
      </button>
      {kindOrder.map((k) => (
        <button key={k} type="button" className={chip} aria-pressed={value === k} onClick={() => onChange(k)}>
          {kinds[k].plural}
        </button>
      ))}
    </div>
  )
}
