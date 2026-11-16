import StatCard from './StatCard'
import type { HealthEvent } from '../../types'

interface StatsSummaryProps {
  events: HealthEvent[]
}

export default function StatsSummary({ events }: StatsSummaryProps) {
  const active = (kind: HealthEvent['kind']) => events.filter((e) => e.kind === kind && e.status === 'active')
  const allergies = active('allergy')
  const conditions = active('condition')
  const medicines = active('medication')
  const vaccinations = events.filter((e) => e.kind === 'vaccination')

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Health record summary">
      <StatCard
        kind="allergy"
        value={allergies.length}
        label="Active allergies"
        note={allergies.map((a) => a.title).join(', ') || 'None recorded'}
      />
      <StatCard
        kind="condition"
        value={conditions.length}
        label="Active conditions"
        note={conditions.map((c) => c.short ?? c.title).join(', ') || 'None recorded'}
      />
      <StatCard
        kind="medication"
        value={medicines.length}
        label="Current medicines"
        note={medicines.map((m) => m.short ?? m.title.split(' ')[0]).join(', ') || 'None recorded'}
      />
      <StatCard
        kind="vaccination"
        value={vaccinations.length}
        label="Vaccinations"
        note={vaccinations.length > 0 ? `${vaccinations.length} doses logged` : 'None recorded'}
      />
    </section>
  )
}
