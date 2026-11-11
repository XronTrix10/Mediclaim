import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div>
        <h1 className="mb-1.5 text-[clamp(1.9rem,3vw,2.5rem)]">{title}</h1>
        {subtitle && <p className="text-ink-faint">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2.5">{children}</div>}
    </header>
  )
}
