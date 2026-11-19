import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { card, button, chip, emptyBox } from '../../lib/ui'
import { getAuthorizedRecords, type DoctorPatientSummary } from '../../api/doctor'
import type { HealthEvent } from '../../types'
import AddPatientRecordModal from '../../components/doctor/AddPatientRecordModal'

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

type RecordKind = 'all' | 'vaccination' | 'condition' | 'medication' | 'allergy' | 'report'

const KIND_LABELS: Record<string, string> = {
  all: 'All Records',
  vaccination: 'Vaccinations',
  condition: 'Conditions',
  medication: 'Medications',
  allergy: 'Allergies',
  report: 'Reports',
}

const KIND_ICON: Record<string, string> = {
  vaccination: 'syringe',
  condition: 'heart',
  medication: 'pill',
  allergy: 'alert',
  report: 'file',
}

function RecordChip({ kind, selected, onClick }: { kind: RecordKind; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={chip}
    >
      {KIND_LABELS[kind]}
    </button>
  )
}

function RecordRow({ event }: { event: HealthEvent }) {
  const iconName = (KIND_ICON[event.kind] ?? 'file') as any
  return (
    <li className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-mist text-ink-soft">
        <Icon name={iconName} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{event.title}</p>
        {event.detail && <p className="mt-0.5 text-sm text-ink-soft">{event.detail}</p>}
      </div>
      <span className="shrink-0 text-xs text-ink-faint">{formatDate(event.date)}</span>
    </li>
  )
}

export default function DoctorPatientDetail() {
  const { mediclaimId } = useParams<{ mediclaimId: string }>()
  const [data, setData] = useState<{ patient: any; approvedScopes: string[]; expiresAt: string; records: HealthEvent[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterKind, setFilterKind] = useState<RecordKind>('all')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addKind, setAddKind] = useState<RecordKind>('vaccination')

  function load() {
    if (!mediclaimId) return
    setLoading(true)
    getAuthorizedRecords(mediclaimId)
      .then(setData)
      .catch(() => setError('Failed to load patient records. You may not have access.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [mediclaimId])

  const records = data?.records ?? []
  const filtered = filterKind === 'all' ? records : records.filter((r) => r.kind === filterKind)

  function openAdd(kind: RecordKind) {
    setAddKind(kind === 'all' ? 'vaccination' : kind)
    setAddModalOpen(true)
  }

  return (
    <div className="grid gap-7">
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Link to="/app/patients" className="hover:text-brand">My Patients</Link>
        <Icon name="chevron-right" size={14} />
        <span className="text-ink">{mediclaimId}</span>
      </div>

      {loading ? (
        <div className="grid gap-6">
          <div className="h-32 rounded-[26px] bg-white animate-pulse border border-line" />
          <div className="h-64 rounded-[26px] bg-white animate-pulse border border-line" />
        </div>
      ) : error ? (
        <div className={`${emptyBox} text-allergy-ink`}>
          <Icon name="lock" size={32} className="mx-auto" />
          <p className="mt-3 font-medium">{error}</p>
          <p className="mt-1 text-sm text-ink-soft">Request access from the patient first.</p>
          <Link to="/app/request-access" className={`${button('soft', 'sm')} mt-4`}>Request Access</Link>
        </div>
      ) : data ? (
        <>
          {/* Patient card */}
          <PageHeader
            title={data.patient?.fullName ?? mediclaimId}
            subtitle={`Mediclaim ID: ${mediclaimId} · Access expires ${formatDate(data.expiresAt)}`}
            actions={
              <button onClick={() => openAdd('all')} className={`${button('primary', 'md')} gap-2`}>
                <Icon name="plus" size={16} />
                Add record
              </button>
            }
          />

          <div className={card}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div>
                <p className="text-xs text-ink-faint">Gender</p>
                <p className="font-medium text-ink capitalize">{data.patient?.gender ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Date of birth</p>
                <p className="font-medium text-ink">{formatDate(data.patient?.dateOfBirth)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Blood group</p>
                <p className="font-medium text-ink">{data.patient?.bloodGroup ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Consent scope</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.approvedScopes?.map((s) => (
                    <span key={s} className="text-xs font-medium text-brand-deep bg-brand-tint rounded-full px-2 py-0.5 capitalize">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Records */}
          <div className={card}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[1.1rem] font-semibold text-ink">Records</h2>
              <div className="flex flex-wrap gap-2">
                {(['all', 'vaccination', 'condition', 'medication', 'allergy', 'report'] as RecordKind[]).map((k) => (
                  <RecordChip key={k} kind={k} selected={filterKind === k} onClick={() => setFilterKind(k)} />
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className={emptyBox}>
                <Icon name="file" size={28} className="mx-auto text-ink-faint" />
                <p className="mt-2 text-sm text-ink-soft">
                  {filterKind === 'all' ? 'No records found.' : `No ${KIND_LABELS[filterKind].toLowerCase()} records.`}
                </p>
                <button onClick={() => openAdd(filterKind)} className={`${button('soft', 'sm')} mt-3 gap-2`}>
                  <Icon name="plus" size={14} />
                  Add {filterKind === 'all' ? 'record' : KIND_LABELS[filterKind].toLowerCase().replace(/s$/, '')}
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {filtered.map((r) => <RecordRow key={r.id} event={r} />)}
              </ul>
            )}
          </div>
        </>
      ) : null}

      {addModalOpen && mediclaimId && (
        <AddPatientRecordModal
          mediclaimId={mediclaimId}
          initialKind={addKind === 'all' ? 'vaccination' : addKind}
          onClose={() => setAddModalOpen(false)}
          onAdded={() => { setAddModalOpen(false); load() }}
        />
      )}
    </div>
  )
}

