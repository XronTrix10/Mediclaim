import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-5 gap-y-4 sm:mb-7">
      <div className="min-w-0">
        <h1 className="mb-1.5 text-[clamp(1.75rem,3vw,2.5rem)]">{title}</h1>
        {subtitle && <p className="text-[0.95rem] text-ink-faint sm:text-base">{subtitle}</p>}
      </div>
      {children && (
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-2.5 *:w-full sm:*:w-auto">
          {children}
        </div>
      )}
    </header>
  )
}
