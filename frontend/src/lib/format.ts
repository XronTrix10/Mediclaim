export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "At birth", "At 9 months", "At 28 years" */
export function ageAt(dobIso: string, dateIso: string): string {
  const dob = new Date(dobIso)
  const d = new Date(dateIso)
  let months = (d.getFullYear() - dob.getFullYear()) * 12 + (d.getMonth() - dob.getMonth())
  if (d.getDate() < dob.getDate()) months -= 1
  if (months < 1) return 'At birth'
  if (months < 24) return `At ${months} months`
  return `At ${Math.floor(months / 12)} years`
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
