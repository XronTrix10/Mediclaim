import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  /** Content shown opposite the label, such as a "Forgot password?" link */
  aside?: ReactNode
  children: ReactNode
}

export default function Field({ label, htmlFor, hint, aside, children }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-semibold">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && <span className="text-sm text-ink-faint">{hint}</span>}
    </div>
  )
}
