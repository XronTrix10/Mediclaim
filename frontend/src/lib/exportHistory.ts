import type { HealthEvent, PatientProfile } from '../types'

/** Saves the user's records as a JSON file. The API's FHIR bundle export will replace this later. */
export function downloadHistory(profile: PatientProfile, events: HealthEvent[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    patient: {
      mediclaimId: profile.mediclaimId,
      fullName: profile.fullName,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      bloodGroup: profile.bloodGroup,
    },
    totalRecords: events.length,
    records: events,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mediclaim-history-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
