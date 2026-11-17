import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader'
import Icon from '../../components/Icon'
import { card, emptyBox } from '../../lib/ui'
import { formatDate, formatWhen } from '../../lib/format'
import { getGlobalEmergencyEvents } from '../../api/admin'
import type { GlobalEmergencyEvent } from '../../api/admin'

function SkeletonRow() {
  return (
    <div className="flex gap-4 py-4 animate-pulse">
      <div className="mt-1 size-8 rounded-[10px] bg-line shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-48 rounded bg-line" />
        <div className="h-3 w-64 rounded bg-line" />
        <div className="h-3 w-32 rounded bg-line" />
      </div>
      <div className="hidden sm:block h-3 w-24 rounded bg-line mt-1" />
    </div>
  )
}

export default function AdminEmergencyEvents() {
  const [events, setEvents] = useState<GlobalEmergencyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGlobalEmergencyEvents()
      .then(setEvents)
      .catch(() => setError('Failed to load emergency events'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader
        title="Emergency Break-Glass Events"
        subtitle="Immutable audit log of all emergency health record accesses"
      />

      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-[18px] border border-allergy-tint bg-allergy-tint/60 px-4 py-3 text-allergy-ink text-sm">
          <Icon name="alert" size={18} />
          {error}
        </div>
      )}

      <div className={card}>
        {loading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : events.length === 0 ? (
          <div className={emptyBox}>
            <Icon name="shield" size={32} className="mx-auto mb-3 text-ink-faint" />
            <p className="font-semibold text-ink">No emergency events recorded</p>
            <p className="mt-1 text-sm text-ink-faint">
              Break-glass accesses will appear here when triggered by practitioners.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {events.map((ev) => (
              <div key={ev.id} className="flex gap-4 py-4">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#fff3e0] text-[#e65100]">
                  <Icon name="alert" size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <strong className="text-[0.95rem] font-semibold text-ink">{ev.doctorName}</strong>
                    <span className="text-[0.82rem] text-ink-faint">accessed records of</span>
                    <strong className="text-[0.95rem] font-semibold text-ink">{ev.patientName}</strong>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.82rem] text-ink-soft">
                    <span className="flex items-center gap-1">
                      <Icon name="shield" size={13} />
                      Mediclaim ID: <span className="font-mono font-medium">{ev.mediclaimId}</span>
                    </span>
                    {ev.hospitalName && (
                      <span className="flex items-center gap-1">
                        <Icon name="stethoscope" size={13} />
                        {ev.hospitalName}
                      </span>
                    )}
                    {ev.doctorPhone && (
                      <span className="flex items-center gap-1">
                        <Icon name="phone" size={13} />
                        {ev.doctorPhone}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 rounded-[10px] bg-mist px-3 py-2 text-[0.84rem] text-ink-soft">
                    <span className="font-semibold text-ink">Reason: </span>
                    {ev.reason}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[0.78rem] text-ink-faint">
                  <span className="hidden sm:block">{formatDate(ev.occurredAt)}</span>
                  <span className="block">{formatWhen(ev.occurredAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {events.length > 0 && (
        <p className="mt-4 text-center text-[0.82rem] text-ink-faint">
          <Icon name="lock" size={13} className="mr-1 inline" />
          This log is append-only and cannot be modified.
        </p>
      )}
    </div>
  )
}
