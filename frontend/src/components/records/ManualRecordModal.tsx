import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Modal from '../Modal'
import Icon from '../Icon'
import type { IconName } from '../Icon'
import { button, input, label, select, textarea } from '../../lib/ui'
import { todayISO } from '../../lib/format'
import { kinds } from '../../data/mock'
import { useHealthData } from '../../store/healthData'
import type {
  AllergyCategory,
  AllergyCriticality,
  AllergySeverity,
  HealthEvent,
  Kind,
  RecordStatus,
} from '../../types'

interface ManualRecordModalProps {
  open: boolean
  initialKind?: Kind
  onClose: () => void
  onSuccess?: (event: HealthEvent) => void
}

const tabKinds: { kind: Kind; label: string; icon: IconName }[] = [
  { kind: 'vaccination', label: 'Vaccination', icon: 'syringe' },
  { kind: 'condition', label: 'Condition', icon: 'heart' },
  { kind: 'medication', label: 'Medication', icon: 'pill' },
  { kind: 'allergy', label: 'Allergy', icon: 'alert' },
  { kind: 'report', label: 'Diagnostic Report', icon: 'flask' },
]

export default function ManualRecordModal({
  open,
  initialKind = 'vaccination',
  onClose,
  onSuccess,
}: ManualRecordModalProps) {
  const { actions } = useHealthData()
  const [selectedKind, setSelectedKind] = useState<Kind>(initialKind)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Vaccination fields
  const [vaccineName, setVaccineName] = useState('')
  const [doseNumber, setDoseNumber] = useState<number>(1)
  const [administeredDate, setAdministeredDate] = useState(() => todayISO(new Date()))
  const [nextDueDate, setNextDueDate] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [vacProvider, setVacProvider] = useState('')
  const [vacNotes, setVacNotes] = useState('')

  // Condition fields
  const [conditionName, setConditionName] = useState('')
  const [condStatus, setCondStatus] = useState<RecordStatus>('active')
  const [condSeverity, setCondSeverity] = useState('mild')
  const [onsetDate, setOnsetDate] = useState(() => todayISO(new Date()))
  const [resolvedDate, setResolvedDate] = useState('')
  const [condProvider, setCondProvider] = useState('')
  const [condNotes, setCondNotes] = useState('')

  // Medication fields
  const [medicationName, setMedicationName] = useState('')
  const [dosage, setDosage] = useState('')
  const [instructions, setInstructions] = useState('')
  const [startDate, setStartDate] = useState(() => todayISO(new Date()))
  const [endDate, setEndDate] = useState('')
  const [medStatus, setMedStatus] = useState<RecordStatus>('active')
  const [medProvider, setMedProvider] = useState('')

  // Allergy fields
  const [allergen, setAllergen] = useState('')
  const [allergyCategory, setAllergyCategory] = useState<AllergyCategory>('medication')
  const [allergySeverity, setAllergySeverity] = useState<AllergySeverity>('moderate')
  const [allergyCriticality, setAllergyCriticality] = useState<AllergyCriticality>('low')
  const [reaction, setReaction] = useState('')
  const [algProvider, setAlgProvider] = useState('')
  const [algNotes, setAlgNotes] = useState('')

  // Report fields
  const [reportName, setReportName] = useState('')
  const [reportType, setReportType] = useState('lab')
  const [reportDate, setReportDate] = useState(() => todayISO(new Date()))
  const [conclusion, setConclusion] = useState('')
  const [repProvider, setRepProvider] = useState('')

  useEffect(() => {
    if (open) {
      if (initialKind) setSelectedKind(initialKind)
      setError(null)
    }
  }, [open, initialKind])

  const resetForm = () => {
    setVaccineName('')
    setDoseNumber(1)
    setAdministeredDate(todayISO(new Date()))
    setNextDueDate('')
    setBatchNumber('')
    setVacProvider('')
    setVacNotes('')

    setConditionName('')
    setCondStatus('active')
    setCondSeverity('mild')
    setOnsetDate(todayISO(new Date()))
    setResolvedDate('')
    setCondProvider('')
    setCondNotes('')

    setMedicationName('')
    setDosage('')
    setInstructions('')
    setStartDate(todayISO(new Date()))
    setEndDate('')
    setMedStatus('active')
    setMedProvider('')

    setAllergen('')
    setAllergyCategory('medication')
    setAllergySeverity('moderate')
    setAllergyCriticality('low')
    setReaction('')
    setAlgProvider('')
    setAlgNotes('')

    setReportName('')
    setReportType('lab')
    setReportDate(todayISO(new Date()))
    setConclusion('')
    setRepProvider('')

    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let created: HealthEvent | undefined

      switch (selectedKind) {
        case 'vaccination': {
          if (!vaccineName.trim()) {
            throw new Error('Please enter the vaccine name')
          }
          created = await actions.addVaccination({
            vaccineName: vaccineName.trim(),
            doseNumber: Number(doseNumber) || 1,
            administeredDate,
            nextDueDate: nextDueDate || undefined,
            batchNumber: batchNumber.trim() || undefined,
            provider: vacProvider.trim() || undefined,
            notes: vacNotes.trim() || undefined,
          })
          break
        }

        case 'condition': {
          if (!conditionName.trim()) {
            throw new Error('Please enter the condition or illness name')
          }
          created = await actions.addCondition({
            conditionName: conditionName.trim(),
            status: condStatus,
            severity: condSeverity,
            onsetDate,
            resolvedDate: resolvedDate || undefined,
            provider: condProvider.trim() || undefined,
            notes: condNotes.trim() || undefined,
          })
          break
        }

        case 'medication': {
          if (!medicationName.trim()) {
            throw new Error('Please enter the medication name')
          }
          created = await actions.addMedication({
            medicationName: medicationName.trim(),
            dosage: dosage.trim() || undefined,
            instructions: instructions.trim() || undefined,
            startDate,
            endDate: endDate || undefined,
            status: medStatus,
            provider: medProvider.trim() || undefined,
          })
          break
        }

        case 'allergy': {
          if (!allergen.trim() || !reaction.trim()) {
            throw new Error('Please enter both the allergen and the reaction')
          }
          const res = await actions.addAllergy({
            allergen: allergen.trim(),
            category: allergyCategory,
            severity: allergySeverity,
            criticality: allergyCriticality,
            reaction: reaction.trim(),
            provider: algProvider.trim() || 'Self-reported',
            notes: algNotes.trim() || undefined,
          })
          if (res) created = res
          break
        }

        case 'report': {
          if (!reportName.trim()) {
            throw new Error('Please enter the test or report name')
          }
          created = await actions.addReport({
            reportName: reportName.trim(),
            reportType,
            reportDate,
            conclusion: conclusion.trim() || undefined,
            provider: repProvider.trim() || undefined,
          })
          break
        }
      }

      resetForm()
      onClose()
      if (created && onSuccess) onSuccess(created)
    } catch (err: any) {
      setError(err?.message || 'Failed to save record. Please check your entries.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Manual Health Record"
      description="Record past medical events, vaccinations, or prescriptions to keep your lifelong record complete."
      size="lg"
    >
      {/* Category selector pills */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-4" role="tablist" aria-label="Record Type">
        {tabKinds.map((t) => {
          const isSelected = selectedKind === t.kind
          return (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setSelectedKind(t.kind)
                setError(null)
              }}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                isSelected
                  ? 'bg-brand text-white shadow-xs'
                  : 'border border-line bg-mist/60 text-ink-soft hover:border-brand/40 hover:text-ink'
              }`}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2.5 rounded-[14px] border border-allergy-tint bg-allergy-tint/50 px-4 py-3 text-sm text-allergy-ink">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4.5">
        {/* VACCINATION FORM */}
        {selectedKind === 'vaccination' && (
          <>
            <div className="grid gap-1.5">
              <label htmlFor="vac-name" className={label}>
                Vaccine Name <span className="text-allergy-ink">*</span>
              </label>
              <input
                id="vac-name"
                data-autofocus
                className={input}
                placeholder="e.g. Tdap Booster, Covishield, BCG, Hepatitis B"
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="vac-dose" className={label}>
                  Dose Number
                </label>
                <input
                  id="vac-dose"
                  type="number"
                  min={1}
                  max={10}
                  className={input}
                  value={doseNumber}
                  onChange={(e) => setDoseNumber(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="vac-date" className={label}>
                  Administered Date <span className="text-allergy-ink">*</span>
                </label>
                <input
                  id="vac-date"
                  type="date"
                  className={input}
                  value={administeredDate}
                  onChange={(e) => setAdministeredDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="vac-batch" className={label}>
                  Batch / Lot Number (Optional)
                </label>
                <input
                  id="vac-batch"
                  className={input}
                  placeholder="e.g. AB12345"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="vac-next" className={label}>
                  Next Due Date (Optional)
                </label>
                <input
                  id="vac-next"
                  type="date"
                  className={input}
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="vac-prov" className={label}>
                Clinic / Administered By (Optional)
              </label>
              <input
                id="vac-prov"
                className={input}
                placeholder="e.g. Primary Health Centre, Dr. S. Nair"
                value={vacProvider}
                onChange={(e) => setVacProvider(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="vac-notes" className={label}>
                Notes (Optional)
              </label>
              <textarea
                id="vac-notes"
                className={textarea}
                rows={2}
                placeholder="Additional details about the vaccination"
                value={vacNotes}
                onChange={(e) => setVacNotes(e.target.value)}
              />
            </div>
          </>
        )}

        {/* CONDITION FORM */}
        {selectedKind === 'condition' && (
          <>
            <div className="grid gap-1.5">
              <label htmlFor="cond-name" className={label}>
                Condition / Diagnosis Name <span className="text-allergy-ink">*</span>
              </label>
              <input
                id="cond-name"
                data-autofocus
                className={input}
                placeholder="e.g. Asthma, Hypertension, Type 2 Diabetes"
                value={conditionName}
                onChange={(e) => setConditionName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="cond-stat" className={label}>
                  Status
                </label>
                <select
                  id="cond-stat"
                  className={select}
                  value={condStatus}
                  onChange={(e) => setCondStatus(e.target.value as RecordStatus)}
                >
                  <option value="active">Active</option>
                  <option value="resolved">Resolved</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="cond-sev" className={label}>
                  Severity
                </label>
                <select
                  id="cond-sev"
                  className={select}
                  value={condSeverity}
                  onChange={(e) => setCondSeverity(e.target.value)}
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="cond-onset" className={label}>
                  Onset Date <span className="text-allergy-ink">*</span>
                </label>
                <input
                  id="cond-onset"
                  type="date"
                  className={input}
                  value={onsetDate}
                  onChange={(e) => setOnsetDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="cond-res" className={label}>
                  Resolved Date (Optional)
                </label>
                <input
                  id="cond-res"
                  type="date"
                  className={input}
                  value={resolvedDate}
                  onChange={(e) => setResolvedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="cond-prov" className={label}>
                Diagnosed By / Doctor (Optional)
              </label>
              <input
                id="cond-prov"
                className={input}
                placeholder="e.g. Dr. Rohan Kulkarni, Pulmonology"
                value={condProvider}
                onChange={(e) => setCondProvider(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="cond-notes" className={label}>
                Clinical Notes (Optional)
              </label>
              <textarea
                id="cond-notes"
                className={textarea}
                rows={2}
                placeholder="Symptoms, management history, or observations"
                value={condNotes}
                onChange={(e) => setCondNotes(e.target.value)}
              />
            </div>
          </>
        )}

        {/* MEDICATION FORM */}
        {selectedKind === 'medication' && (
          <>
            <div className="grid gap-1.5">
              <label htmlFor="med-name" className={label}>
                Medication Name <span className="text-allergy-ink">*</span>
              </label>
              <input
                id="med-name"
                data-autofocus
                className={input}
                placeholder="e.g. Budesonide Inhaler, Metformin 500mg, Paracetamol"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="med-dose" className={label}>
                  Dosage
                </label>
                <input
                  id="med-dose"
                  className={input}
                  placeholder="e.g. 500 mg, 2 puffs, 1 tablet"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="med-stat" className={label}>
                  Status
                </label>
                <select
                  id="med-stat"
                  className={select}
                  value={medStatus}
                  onChange={(e) => setMedStatus(e.target.value as RecordStatus)}
                >
                  <option value="active">Active (Currently taking)</option>
                  <option value="completed">Completed</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="med-inst" className={label}>
                Instructions & Frequency
              </label>
              <input
                id="med-inst"
                className={input}
                placeholder="e.g. Twice daily after food, 1 puff in morning"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="med-start" className={label}>
                  Start Date <span className="text-allergy-ink">*</span>
                </label>
                <input
                  id="med-start"
                  type="date"
                  className={input}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="med-end" className={label}>
                  End Date (Optional)
                </label>
                <input
                  id="med-end"
                  type="date"
                  className={input}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="med-prov" className={label}>
                Prescribed By / Clinic (Optional)
              </label>
              <input
                id="med-prov"
                className={input}
                placeholder="e.g. Dr. Rohan Kulkarni, Apex Clinic"
                value={medProvider}
                onChange={(e) => setMedProvider(e.target.value)}
              />
            </div>
          </>
        )}

        {/* ALLERGY FORM */}
        {selectedKind === 'allergy' && (
          <>
            <div className="grid gap-1.5">
              <label htmlFor="alg-name" className={label}>
                Allergen <span className="text-allergy-ink">*</span>
              </label>
              <input
                id="alg-name"
                data-autofocus
                className={input}
                placeholder="e.g. Penicillin, Peanuts, Latex, Dust mites"
                value={allergen}
                onChange={(e) => setAllergen(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <label htmlFor="alg-cat" className={label}>
                  Category
                </label>
                <select
                  id="alg-cat"
                  className={select}
                  value={allergyCategory}
                  onChange={(e) => setAllergyCategory(e.target.value as AllergyCategory)}
                >
                  <option value="medication">Medication</option>
                  <option value="food">Food</option>
                  <option value="environment">Environment</option>
                  <option value="biologic">Biologic</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="alg-sev" className={label}>
                  Severity
                </label>
                <select
                  id="alg-sev"
                  className={select}
                  value={allergySeverity}
                  onChange={(e) => setAllergySeverity(e.target.value as AllergySeverity)}
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                  <option value="life-threatening">Life-threatening</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="alg-crit" className={label}>
                  Criticality
                </label>
                <select
                  id="alg-crit"
                  className={select}
                  value={allergyCriticality}
                  onChange={(e) => setAllergyCriticality(e.target.value as AllergyCriticality)}
                >
                  <option value="low">Low</option>
                  <option value="high">High</option>
                  <option value="unable-to-assess">Unable to assess</option>
                </select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="alg-react" className={label}>
                Reaction / Symptoms <span className="text-allergy-ink">*</span>
              </label>
              <input
                id="alg-react"
                className={input}
                placeholder="e.g. Skin rash, facial hives, bronchospasm"
                value={reaction}
                onChange={(e) => setReaction(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="alg-prov" className={label}>
                Identified At / Doctor (Optional)
              </label>
              <input
                id="alg-prov"
                className={input}
                placeholder="e.g. Dr. S. Nair, Family Clinic"
                value={algProvider}
                onChange={(e) => setAlgProvider(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="alg-notes" className={label}>
                Precautions & Notes (Optional)
              </label>
              <textarea
                id="alg-notes"
                className={textarea}
                rows={2}
                placeholder="e.g. Strictly avoid beta-lactam antibiotics"
                value={algNotes}
                onChange={(e) => setAlgNotes(e.target.value)}
              />
            </div>
          </>
        )}

        {/* REPORT FORM */}
        {selectedKind === 'report' && (
          <>
            <div className="grid gap-1.5">
              <label htmlFor="rep-name" className={label}>
                Report / Investigation Name <span className="text-allergy-ink">*</span>
              </label>
              <input
                id="rep-name"
                data-autofocus
                className={input}
                placeholder="e.g. Complete Blood Count (CBC), Chest X-Ray, HbA1c"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="rep-type" className={label}>
                  Report Type
                </label>
                <select
                  id="rep-type"
                  className={select}
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                >
                  <option value="lab">Laboratory (Blood / Urine)</option>
                  <option value="radiology">Radiology (X-Ray / MRI / CT)</option>
                  <option value="pathology">Pathology / Biopsy</option>
                  <option value="cardiology">Cardiology (ECG / Echo)</option>
                  <option value="other">Other Investigation</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="rep-date" className={label}>
                  Test Date <span className="text-allergy-ink">*</span>
                </label>
                <input
                  id="rep-date"
                  type="date"
                  className={input}
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="rep-prov" className={label}>
                Diagnostic Centre / Hospital (Optional)
              </label>
              <input
                id="rep-prov"
                className={input}
                placeholder="e.g. Apex Diagnostics, Bandra"
                value={repProvider}
                onChange={(e) => setRepProvider(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="rep-concl" className={label}>
                Key Findings / Conclusion (Optional)
              </label>
              <textarea
                id="rep-concl"
                className={textarea}
                rows={2}
                placeholder="e.g. HbA1c 5.4%, normal fasting glucose. No abnormalities detected."
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="mt-4 flex flex-col-reverse justify-end gap-2.5 sm:flex-row">
          <button type="button" className={button('ghost')} onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className={button('primary')} disabled={loading}>
            {loading ? (
              'Saving...'
            ) : (
              <>
                <Icon name="plus" size={17} />
                Save {kinds[selectedKind].label}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}

