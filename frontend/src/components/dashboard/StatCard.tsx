import Icon from '../Icon'
import { kinds } from '../../data/mock'
import type { Kind } from '../../types'

export interface StatCardProps {
  kind: Kind
  value: number
  label: string
  note: string
}

export default function StatCard({ kind, value, label, note }: StatCardProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-[20px] bg-(--kt) p-4 transition-transform hover:-translate-y-0.5"
      data-kind={kind}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-white text-(--ki) shadow-xs">
        <Icon name={kinds[kind].icon} size={18} />
      </span>
      <div className="min-w-0">
        <strong className="block font-display text-[1.85rem] font-medium leading-none text-(--ki)">
          {value}
        </strong>
        <span className="mt-1.5 block truncate text-[0.82rem] font-semibold leading-tight text-ink">
          {label}
        </span>
        <small className="mt-0.5 block truncate text-[0.76rem] leading-[1.35] text-ink-soft">
          {note}
        </small>
      </div>
    </div>
  )
}
