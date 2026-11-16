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
    <div className="flex min-w-0 flex-col gap-2.5 rounded-[20px] bg-(--kt) p-3.5 sm:p-4" data-kind={kind}>
      <div className="flex items-center justify-between gap-2">
        <strong className="font-display text-[1.9rem] leading-none font-medium text-(--ki)">{value}</strong>
        <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-white text-(--ki) shadow-xs">
          <Icon name={kinds[kind].icon} size={18} />
        </span>
      </div>
      <div className="min-w-0">
        <span className="block text-[0.84rem] leading-tight font-semibold text-ink">{label}</span>
        <small className="mt-0.5 block text-[0.76rem] leading-[1.35] text-ink-soft [overflow-wrap:anywhere]">
          {note}
        </small>
      </div>
    </div>
  )
}
