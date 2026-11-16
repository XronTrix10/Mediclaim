import type { ReactNode } from 'react'
import { countChip } from '../lib/ui'

interface CardHeaderProps {
  id: string
  title: string
  count?: number
  countTone?: keyof typeof countChip
  /** Buttons or links shown opposite the title. They wrap below it on narrow screens. */
  actions?: ReactNode
  className?: string
}

export default function CardHeader({ id, title, count, countTone = 'brand', actions, className = 'mb-4' }: CardHeaderProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        <h2 id={id} className="text-[1.2rem] sm:text-[1.35rem]">
          {title}
        </h2>
        {count !== undefined && <span className={countChip[countTone]}>{count}</span>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{actions}</div>}
    </div>
  )
}
