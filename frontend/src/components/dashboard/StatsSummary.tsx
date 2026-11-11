import StatCard from './StatCard'
import type { HealthEvent } from '../../types'

interface StatsSummaryProps {
  events: HealthEvent[]
}

export default function StatsSummary({ events }: StatsSummaryProps) {
  const activeAllergies = events.filter((e) => e.kind === 'allergy' && e.status === 'active')
  const activeConditions = events.filter((e) => e.kind === 'condition' && e.status === 'active')
  const activeMedicines = events.filter((e) => e.kind === 'medication' && e.status === 'active')
  const vaccinations = events.filter((e) => e.kind === 'vaccination')

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Health record summary">
      <StatCard
        kind="allergy"
        value={activeAllergies.length}
        label="Active allergies"
        note={activeAllergies.map((a) => a.title).join(', ') || 'No active allergies'}
      />
      <StatCard
        kind="condition"
        value={activeConditions.length}
        label="Active conditions"
        note={activeConditions.map((c) => c.title).join(', ') || 'No active conditions'}
      />
      <StatCard
        kind="medication"
        value={activeMedicines.length}
        label="Current medicines"
        note={activeMedicines.map((m) => m.title.split(' ')[0]).join(', ') || 'None prescribed'}
      />
      <StatCard
        kind="vaccination"
        value={vaccinations.length}
        label="Vaccinations"
        note={vaccinations.length > 0 ? `${vaccinations.length} doses logged` : 'Schedule not started'}
      />
    </section>
  )
}

