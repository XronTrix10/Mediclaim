import type { BloodGroup } from '../types'

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parses YYYY-MM-DD as a local calendar date (new Date('2026-09-02') would be UTC midnight and can shift a day). */
export function parseDate(iso: string): Date {
  const m = DATE_ONLY.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
}

/** Today's date as YYYY-MM-DD in the user's own timezone. */
export function todayISO(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

export function formatDate(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function monthsBetween(dobIso: string, to: Date): number {
  const dob = parseDate(dobIso)
  let months = (to.getFullYear() - dob.getFullYear()) * 12 + (to.getMonth() - dob.getMonth())
  if (to.getDate() < dob.getDate()) months -= 1
  return Math.max(months, 0)
}

/** "At birth", "At 9 months", "At 28 years" */
export function ageAt(dobIso: string, dateIso: string): string {
  const months = monthsBetween(dobIso, parseDate(dateIso))
  if (months < 1) return 'At birth'
  if (months < 24) return `At ${months} months`
  return `At ${Math.floor(months / 12)} years`
}

/** "5 months", "32 years" */
export function formatAge(dobIso: string, now: Date = new Date()): string {
  const months = monthsBetween(dobIso, now)
  if (months < 1) return 'newborn'
  if (months < 24) return `${months} months`
  return `${Math.floor(months / 12)} years`
}

/** Time left on an access grant, e.g. "1 h 48 min left". */
export function formatRemaining(expiresAt: string, now: number): string {
  const ms = Date.parse(expiresAt) - now
  if (ms <= 0) return 'Expired'
  const totalMin = Math.ceil(ms / 60_000)
  if (totalMin < 2) return 'Under 1 min left'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h} h ${m} min left` : `${m} min left`
}

/** "Today, 10:42", "Yesterday, 18:05" or "2 Sep 2026". */
export function formatWhen(iso: string, now: number = Date.now()): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const today = todayISO(new Date(now))
  const that = todayISO(d)
  if (that === today) return `Today, ${time}`
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  if (that === todayISO(y)) return `Yesterday, ${time}`
  return formatDate(that)
}

export function bloodGroupLabel(bg: BloodGroup | string): string {
  return bg.replace('-', '\u2212')
}

export function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Accepts +91 98765 43210, 098765-43210, (022) 2345 6789 and similar. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return /^[+\d\s()-]+$/.test(value.trim()) && digits.length >= 10 && digits.length <= 13
}
