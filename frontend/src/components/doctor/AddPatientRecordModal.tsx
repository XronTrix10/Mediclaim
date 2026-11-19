import { useState } from 'react'
import type { FormEvent } from 'react'
import Field from '../Field'
import { button, input, select, textarea } from '../../lib/ui'
import {
  createDoctorCondition,
  createDoctorPrescription,
  createDoctorReport,
  createDoctorVaccination,
} from '../../api/doctor'
import { ApiError } from '../../api/client'

type RecordKind = 'vaccination' | 'condition' | 'medication' | 'allergy' | 'report'

interface Props {
  mediclaimId: string
  initialKind?: RecordKind
  onClose: () => void
  onAdded: () => void
}

const TABS: { kind: RecordKind; label: string }[] = [
  { kind: 'vaccination', label: 'Vaccination' },
  { kind: 'condition', label: 'Condition' },
  { kind: 'medication', label: 'Medication' },
  { kind: 'report', label: 'Report' },
]

const SPECIALIZATIONS = [
  'General Physician', 'Cardiologist', 'Pulmonologist', 'Dermatologist',
  'Neurologist', 'Orthopedic', 'Pediatrician', 'Gynecologist', 'Oncologist', 'Other',
]

export default function AddPatientRecordModal({ mediclaimId, initialKind = 'vaccination', onClose, onAdded }: Props) {
  const [activeKind, setActiveKind] = useState<RecordKind>(initialKind)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Vaccination fields
  const [vacName, setVacName] = useState('')
  const [vacDose, setVacDose] = useState('')
  const [vacDate, setVacDate] = useState('')
  const [vacBatch, setVacBatch] = useState('')
  const [vacNotes, setVacNotes] = useState('')

  // Condition fields
  const [condName, setCondName] = useState('')
  const [condSeverity, setCondSeverity] = useState('')
  const [condStatus, setCondStatus] = useState('active')
  const [condOnset, setCondOnset] = useState('')
  const [condResolved, setCondResolved] = useState('')
  const [condNotes, setCondNotes] = useState('')

  // Medication fields
  const [medTitle, setMedTitle] = useState('')
  const [medName, setMedName] = useState('')
  const [medDosage, setMedDosage] = useState('')
  const [medFrequency, setMedFrequency] = useState('')
  const [medDuration, setMedDuration] = useState('')
  const [medInstructions, setMedInstructions] = useState('')
  const [medDate, setMedDate] = useState('')

  // Report fields
  const [repName, setRepName] = useState('')
  const [repType, setRepType] = useState('')
  const [repDate, setRepDate] = useState('')
  const [repConclusion, setRepConclusion] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      if (activeKind === 'vaccination') {
        await createDoctorVaccination(mediclaimId, {
          vaccineName: vacName.trim(),
          doseNumber: vacDose ? parseInt(vacDose, 10) : undefined,
          administeredDate: vacDate || undefined,
          batchNumber: vacBatch.trim() || undefined,
          notes: vacNotes.trim() || undefined,
        })
      } else if (activeKind === 'condition') {
        await createDoctorCondition(mediclaimId, {
          conditionName: condName.trim(),
          severity: (condSeverity as any) || undefined,
          status: (condStatus as any) || 'active',
          onsetDate: condOnset || undefined,
          resolvedDate: condResolved || undefined,
          notes: condNotes.trim() || undefined,
        })
      } else if (activeKind === 'medication') {
        await createDoctorPrescription(mediclaimId, {
          title: medTitle.trim() || `Prescription for ${medName.trim()}`,
          date: medDate || undefined,
          instructions: medInstructions.trim() || undefined,
          medications: [{
            name: medName.trim(),
            dosage: medDosage.trim() || undefined,
            frequency: medFrequency.trim() || undefined,
            duration: medDuration.trim() || undefined,
            instructions: medInstructions.trim() || undefined,
          }],
        })
      } else if (activeKind === 'report') {
        await createDoctorReport(mediclaimId, {
          reportName: repName.trim(),
          reportType: repType.trim() || undefined,
          reportDate: repDate || undefined,
          conclusion: repConclusion.trim() || undefined,
        })
      }
      onAdded()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to add record. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-4 sm:pb-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-[28px] bg-white shadow-2xl max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-6 py-4 rounded-t-[28px]">
          <div>
            <h2 className="text-lg font-semibold text-ink">Add Record</h2>
            <p className="text-xs text-ink-faint">Patient {mediclaimId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full bg-mist text-ink-soft hover:bg-line transition-colors"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line px-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              onClick={() => { setActiveKind(tab.kind); setError(null) }}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeKind === tab.kind
                  ? 'border-brand text-brand-deep'
                  : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 grid gap-4">
          {error && (
            <div role="alert" className="rounded-xl bg-allergy-tint px-4 py-3 text-sm font-medium text-allergy-ink">
              {error}
            </div>
          )}

          {/* Vaccination */}
          {activeKind === 'vaccination' && (
            <>
              <Field label="Vaccine name" htmlFor="dv-name">
                <input id="dv-name" className={input} placeholder="COVID-19 (Covaxin)" value={vacName} onChange={(e) => setVacName(e.target.value)} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dose number" htmlFor="dv-dose">
                  <input id="dv-dose" type="number" min="1" className={input} placeholder="1" value={vacDose} onChange={(e) => setVacDose(e.target.value)} />
                </Field>
                <Field label="Date administered" htmlFor="dv-date">
                  <input id="dv-date" type="date" className={input} value={vacDate} onChange={(e) => setVacDate(e.target.value)} />
                </Field>
              </div>
              <Field label="Batch number (optional)" htmlFor="dv-batch">
                <input id="dv-batch" className={input} placeholder="BATCH-001" value={vacBatch} onChange={(e) => setVacBatch(e.target.value)} />
              </Field>
              <Field label="Notes (optional)" htmlFor="dv-notes">
                <textarea id="dv-notes" className={textarea} rows={3} placeholder="Additional notes…" value={vacNotes} onChange={(e) => setVacNotes(e.target.value)} />
              </Field>
            </>
          )}

          {/* Condition */}
          {activeKind === 'condition' && (
            <>
              <Field label="Condition name" htmlFor="dc-name">
                <input id="dc-name" className={input} placeholder="Type 2 Diabetes" value={condName} onChange={(e) => setCondName(e.target.value)} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Severity" htmlFor="dc-sev">
                  <select id="dc-sev" className={select} value={condSeverity} onChange={(e) => setCondSeverity(e.target.value)}>
                    <option value="">Select…</option>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </Field>
                <Field label="Status" htmlFor="dc-status">
                  <select id="dc-status" className={select} value={condStatus} onChange={(e) => setCondStatus(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                    <option value="inactive">Inactive</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Onset date" htmlFor="dc-onset">
                  <input id="dc-onset" type="date" className={input} value={condOnset} onChange={(e) => setCondOnset(e.target.value)} />
                </Field>
                <Field label="Resolved date" htmlFor="dc-resolved">
                  <input id="dc-resolved" type="date" className={input} value={condResolved} onChange={(e) => setCondResolved(e.target.value)} />
                </Field>
              </div>
              <Field label="Clinical notes (optional)" htmlFor="dc-notes">
                <textarea id="dc-notes" className={textarea} rows={3} placeholder="Additional clinical notes…" value={condNotes} onChange={(e) => setCondNotes(e.target.value)} />
              </Field>
            </>
          )}

          {/* Medication */}
          {activeKind === 'medication' && (
            <>
              <Field label="Prescription title" htmlFor="dm-title" hint="e.g. 'Post-surgery medication course'">
                <input id="dm-title" className={input} placeholder="Prescription title" value={medTitle} onChange={(e) => setMedTitle(e.target.value)} />
              </Field>
              <Field label="Medication name" htmlFor="dm-name">
                <input id="dm-name" className={input} placeholder="Metformin" value={medName} onChange={(e) => setMedName(e.target.value)} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dosage" htmlFor="dm-dosage">
                  <input id="dm-dosage" className={input} placeholder="500mg" value={medDosage} onChange={(e) => setMedDosage(e.target.value)} />
                </Field>
                <Field label="Frequency" htmlFor="dm-freq">
                  <input id="dm-freq" className={input} placeholder="Twice daily" value={medFrequency} onChange={(e) => setMedFrequency(e.target.value)} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Duration" htmlFor="dm-dur">
                  <input id="dm-dur" className={input} placeholder="30 days" value={medDuration} onChange={(e) => setMedDuration(e.target.value)} />
                </Field>
                <Field label="Prescription date" htmlFor="dm-date">
                  <input id="dm-date" type="date" className={input} value={medDate} onChange={(e) => setMedDate(e.target.value)} />
                </Field>
              </div>
              <Field label="Instructions (optional)" htmlFor="dm-inst">
                <textarea id="dm-inst" className={textarea} rows={2} placeholder="Take with food…" value={medInstructions} onChange={(e) => setMedInstructions(e.target.value)} />
              </Field>
            </>
          )}

          {/* Report */}
          {activeKind === 'report' && (
            <>
              <Field label="Report name" htmlFor="dr-name">
                <input id="dr-name" className={input} placeholder="HbA1c Test" value={repName} onChange={(e) => setRepName(e.target.value)} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Report type" htmlFor="dr-type">
                  <input id="dr-type" className={input} placeholder="Blood Test" value={repType} onChange={(e) => setRepType(e.target.value)} />
                </Field>
                <Field label="Report date" htmlFor="dr-date">
                  <input id="dr-date" type="date" className={input} value={repDate} onChange={(e) => setRepDate(e.target.value)} />
                </Field>
              </div>
              <Field label="Conclusion / findings (optional)" htmlFor="dr-conc">
                <textarea id="dr-conc" className={textarea} rows={4} placeholder="HbA1c level within normal range…" value={repConclusion} onChange={(e) => setRepConclusion(e.target.value)} />
              </Field>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className={`${button('primary', 'md')} flex-1`}>
              {loading ? 'Adding…' : 'Add Record'}
            </button>
            <button type="button" onClick={onClose} className={`${button('ghost', 'md')}`}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

