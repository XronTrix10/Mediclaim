import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  /** Content shown opposite the label, such as a "Forgot password?" link */
  aside?: ReactNode
  children: ReactNode
}

export default function Field({ label, htmlFor, hint, error, aside, children }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-semibold">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <span className="text-xs font-medium text-rose-600 animate-in fade-in duration-150">
          {error}
        </span>
      ) : hint ? (
        <span className="text-sm text-ink-faint">{hint}</span>
      ) : null}
    </div>
  )
}
