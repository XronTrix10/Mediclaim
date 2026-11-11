import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../Icon'
import { card, cardTitle, button, input, select } from '../../lib/ui'
import { formatDate } from '../../lib/format'
import type { AllergyRecord, AllergySeverity, AllergyCriticality, AllergyCategory } from '../../types'

interface AllergiesSectionProps {
  allergies: AllergyRecord[]
  onAddAllergy?: (newAllergy: AllergyRecord) => void
}

function getSeverityBadge(severity: AllergySeverity) {
  const styles: Record<AllergySeverity, string> = {
    mild: 'bg-vaccination-tint text-vaccination-ink',
    moderate: 'bg-report-tint text-report-ink',
    severe: 'bg-allergy-tint text-allergy-ink',
    'life-threatening': 'bg-allergy text-white',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold capitalize ${styles[severity]}`}>
      {severity}
    </span>
  )
}

function getCriticalityBadge(criticality: AllergyCriticality) {
  if (criticality === 'high') {
    return (
      <span className="rounded-full bg-allergy-tint px-2 py-0.5 text-[0.7rem] font-medium text-allergy-ink">
        High criticality
      </span>
    )
  }
  return null
}

export default function AllergiesSection({ allergies, onAddAllergy }: AllergiesSectionProps) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [allergen, setAllergen] = useState('')
  const [category, setCategory] = useState<AllergyCategory>('medication')
  const [severity, setSeverity] = useState<AllergySeverity>('moderate')
  const [criticality, setCriticality] = useState<AllergyCriticality>('low')
  const [reaction, setReaction] = useState('')
  const [provider, setProvider] = useState('')

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!allergen.trim() || !reaction.trim()) return

    const newRecord: AllergyRecord = {
      id: `alg-${Date.now()}`,
      kind: 'allergy',
      title: allergen,
      allergen,
      category,
      severity,
      criticality,
      reaction,
      status: 'active',
      identifiedDate: new Date().toISOString().split('T')[0],
      provider: provider.trim() || 'Self reported',
    }

    onAddAllergy?.(newRecord)
    setShowAddModal(false)
    setAllergen('')
    setReaction('')
    setProvider('')
  }

  return (
    <section className={card} aria-labelledby="allergies-h">
      <div className={cardTitle} id="allergies-h">
        <div className="flex items-center gap-2">
          <h2>Allergies &amp; Sensitivities</h2>
          <span className="rounded-full bg-allergy-tint px-2.5 py-0.5 text-xs font-semibold text-allergy-ink">
            {allergies.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={button('soft', 'sm')}
            onClick={() => setShowAddModal(true)}
          >
            <Icon name="plus" size={15} />
            Add allergy
          </button>
          <Link
            className="font-sans text-[0.88rem] font-semibold text-brand hover:underline hover:underline-offset-[3px]"
            to="/app/records?kind=allergy"
          >
            All records →
          </Link>
        </div>
      </div>

      {allergies.length === 0 ? (
        <div className="rounded-[18px] border-2 border-dashed border-line-strong p-8 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-mist text-ink-faint">
            <Icon name="alert" size={22} />
          </span>
          <p className="font-semibold text-ink">No known allergies on record</p>
          <p className="mt-1 text-[0.86rem] text-ink-soft">
            Recording allergies protects you during emergency doctor visits and hospital admissions.
          </p>
          <button
            type="button"
            className={`${button('soft', 'sm')} mt-4`}
            onClick={() => setShowAddModal(true)}
          >
            <Icon name="plus" size={15} />
            Record an allergy
          </button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {allergies.map((a) => (
            <li
              key={a.id}
              data-kind="allergy"
              className="flex flex-col gap-2 rounded-[18px] border border-line bg-mist/60 p-4 transition-colors hover:bg-mist"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="size-2.5 shrink-0 rounded-full bg-(--k) ring-4 ring-(--kt)" />
                  <strong className="text-[0.98rem] font-semibold text-ink">{a.title}</strong>
                  <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[0.72rem] font-medium text-ink-soft capitalize">
                    {a.category}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {getCriticalityBadge(a.criticality)}
                  {getSeverityBadge(a.severity)}
                </div>
              </div>

              {/* Reaction & Symptoms */}
              <div className="pl-5 text-[0.88rem]">
                <p className="text-ink-soft">
                  <strong className="font-semibold text-ink">Manifestation:</strong> {a.reaction}
                </p>
                {a.notes && (
                  <p className="mt-1 text-xs text-ink-faint italic">{a.notes}</p>
                )}
                <p className="mt-1.5 text-xs text-ink-faint">
                  Identified: {formatDate(a.identifiedDate)} · Diagnosed by: {a.provider}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add Allergy Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[26px] border border-line bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-ink">Record an Allergy</h3>
              <button
                type="button"
                className="text-ink-faint hover:text-ink"
                onClick={() => setShowAddModal(false)}
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="grid gap-3.5">
              <div className="grid gap-1">
                <label htmlFor="alg-name" className="text-xs font-semibold text-ink">
                  Allergen Name <span className="text-allergy">*</span>
                </label>
                <input
                  id="alg-name"
                  className={input}
                  placeholder="e.g. Penicillin, Peanuts, Latex"
                  value={allergen}
                  onChange={(e) => setAllergen(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label htmlFor="alg-cat" className="text-xs font-semibold text-ink">
                    Category
                  </label>
                  <select
                    id="alg-cat"
                    className={select}
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AllergyCategory)}
                  >
                    <option value="medication">Medication</option>
                    <option value="food">Food</option>
                    <option value="environment">Environment</option>
                    <option value="biologic">Biologic</option>
                  </select>
                </div>

                <div className="grid gap-1">
                  <label htmlFor="alg-sev" className="text-xs font-semibold text-ink">
                    Severity
                  </label>
                  <select
                    id="alg-sev"
                    className={select}
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as AllergySeverity)}
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="life-threatening">Life-threatening</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-1">
                <label htmlFor="alg-react" className="text-xs font-semibold text-ink">
                  Reaction / Symptoms <span className="text-allergy">*</span>
                </label>
                <input
                  id="alg-react"
                  className={input}
                  placeholder="e.g. Skin rash, facial hives, shortness of breath"
                  value={reaction}
                  onChange={(e) => setReaction(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1">
                <label htmlFor="alg-crit" className="text-xs font-semibold text-ink">
                  Criticality (Doctor Alert Priority)
                </label>
                <select
                  id="alg-crit"
                  className={select}
                  value={criticality}
                  onChange={(e) => setCriticality(e.target.value as AllergyCriticality)}
                >
                  <option value="low">Low Risk</option>
                  <option value="high">High Risk (Prompt Doctors)</option>
                  <option value="unable-to-assess">Unable to Assess</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label htmlFor="alg-prov" className="text-xs font-semibold text-ink">
                  Diagnosing Doctor / Clinic
                </label>
                <input
                  id="alg-prov"
                  className={input}
                  placeholder="e.g. Dr. Rohan Kulkarni, City Hospital"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className={button('ghost', 'sm')}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={button('primary', 'sm')}>
                  Save Allergy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

