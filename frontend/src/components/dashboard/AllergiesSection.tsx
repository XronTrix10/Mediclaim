import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../Icon'
import Modal from '../Modal'
import CardHeader from '../CardHeader'
import { button, card, emptyBox, input, label, select, textLink, textarea } from '../../lib/ui'
import { formatDate } from '../../lib/format'
import type {
  AllergyCategory,
  AllergyCriticality,
  AllergySeverity,
  HealthEvent,
  NewAllergyInput,
} from '../../types'

const severityStyles: Record<AllergySeverity, string> = {
  mild: 'bg-vaccination-tint text-vaccination-ink',
  moderate: 'bg-report-tint text-report-ink',
  severe: 'bg-allergy-tint text-allergy-ink',
  'life-threatening': 'bg-allergy text-white',
}

interface AllergiesSectionProps {
  allergies: HealthEvent[]
  onAddAllergy: (input: NewAllergyInput) => void
}

export default function AllergiesSection({ allergies, onAddAllergy }: AllergiesSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <section className={card} aria-labelledby="allergies-h">
      <CardHeader
        id="allergies-h"
        title="Allergies"
        count={allergies.length}
        countTone="allergy"
        actions={
          <>
            <button type="button" className={button('soft', 'sm')} onClick={() => setOpen(true)}>
              <Icon name="plus" size={15} />
              Add allergy
            </button>
            <Link className={textLink} to="/app/records?kind=allergy">
              All records
            </Link>
          </>
        }
      />

      {allergies.length === 0 ? (
        <div className={emptyBox}>
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-mist text-ink-faint">
            <Icon name="alert" size={22} />
          </span>
          <p className="font-semibold text-ink">No known allergies on record</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.88rem] text-ink-soft">
            Recording allergies protects you during emergency visits and hospital admissions.
          </p>
          <button type="button" className={`${button('soft', 'sm')} mt-4`} onClick={() => setOpen(true)}>
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
              className="grid gap-2 rounded-[18px] border border-line bg-mist/60 p-3.5 sm:p-4"
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className="size-2.5 shrink-0 rounded-full bg-(--k) ring-4 ring-(--kt)" />
                <strong className="min-w-0 text-[0.98rem] font-semibold text-ink [overflow-wrap:anywhere]">{a.title}</strong>
                {a.category && (
                  <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[0.72rem] font-medium text-ink-soft capitalize">
                    {a.category}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pl-[22px]">
                {a.severity && (
                  <span className={`rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold capitalize ${severityStyles[a.severity]}`}>
                    {a.severity}
                  </span>
                )}
                {a.criticality === 'high' && (
                  <span className="rounded-full bg-allergy-tint px-2 py-0.5 text-[0.7rem] font-medium text-allergy-ink">
                    High criticality
                  </span>
                )}
                {a.source === 'self_reported' && (
                  <span className="rounded-full bg-mist-2 px-2 py-0.5 text-[0.7rem] font-medium text-ink-soft">
                    Self-reported
                  </span>
                )}
              </div>

              <div className="pl-[22px] text-[0.88rem]">
                {a.reaction && (
                  <p className="text-ink-soft">
                    <strong className="font-semibold text-ink">Reaction:</strong> {a.reaction}
                  </p>
                )}
                {a.notes && <p className="mt-1 text-xs text-ink-faint italic">{a.notes}</p>}
                <p className="mt-1.5 text-xs text-ink-faint">
                  Identified {formatDate(a.date)}. {a.source === 'self_reported' ? 'Reported by you' : `Diagnosed by ${a.provider}`}.
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AllergyDialog
        open={open}
        onClose={() => setOpen(false)}
        onSave={(input) => {
          onAddAllergy(input)
          setOpen(false)
        }}
      />
    </section>
  )
}

function AllergyDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (i: NewAllergyInput) => void }) {
  const [allergen, setAllergen] = useState('')
  const [category, setCategory] = useState<AllergyCategory>('medication')
  const [severity, setSeverity] = useState<AllergySeverity>('moderate')
  const [criticality, setCriticality] = useState<AllergyCriticality>('low')
  const [reaction, setReaction] = useState('')
  const [provider, setProvider] = useState('')
  const [notes, setNotes] = useState('')

  const reset = () => {
    setAllergen('')
    setCategory('medication')
    setSeverity('moderate')
    setCriticality('low')
    setReaction('')
    setProvider('')
    setNotes('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!allergen.trim() || !reaction.trim()) return
    onSave({ allergen, category, severity, criticality, reaction, provider, notes })
    reset()
  }

  const close = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Record an allergy"
      description="Entries you add are marked as self-reported until a doctor confirms them."
    >
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="alg-name" className={label}>
            Allergen <span className="text-allergy-ink">*</span>
          </label>
          <input
            id="alg-name"
            data-autofocus
            className={input}
            placeholder="For example, Penicillin, peanuts, latex"
            value={allergen}
            onChange={(e) => setAllergen(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="alg-cat" className={label}>
              Category
            </label>
            <select id="alg-cat" className={select} value={category} onChange={(e) => setCategory(e.target.value as AllergyCategory)}>
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
            <select id="alg-sev" className={select} value={severity} onChange={(e) => setSeverity(e.target.value as AllergySeverity)}>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="life-threatening">Life-threatening</option>
            </select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="alg-react" className={label}>
            Reaction or symptoms <span className="text-allergy-ink">*</span>
          </label>
          <input
            id="alg-react"
            className={input}
            placeholder="For example, skin rash, hives, shortness of breath"
            value={reaction}
            onChange={(e) => setReaction(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="alg-crit" className={label}>
            Risk level for doctors
          </label>
          <select id="alg-crit" className={select} value={criticality} onChange={(e) => setCriticality(e.target.value as AllergyCriticality)}>
            <option value="low">Low risk</option>
            <option value="high">High risk (alert doctors first)</option>
            <option value="unable-to-assess">Not sure</option>
          </select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="alg-prov" className={label}>
            Diagnosing doctor or clinic (optional)
          </label>
          <input
            id="alg-prov"
            className={input}
            placeholder="For example, Dr. Rohan Kulkarni, City Hospital"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="alg-notes" className={label}>
            Notes (optional)
          </label>
          <textarea id="alg-notes" rows={2} className={textarea} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={button('ghost', 'sm')} onClick={close}>
            Cancel
          </button>
          <button type="submit" className={button('primary', 'sm')}>
            Save allergy
          </button>
        </div>
      </form>
    </Modal>
  )
}
