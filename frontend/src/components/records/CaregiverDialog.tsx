import { useState } from 'react'
import type { FormEvent } from 'react'
import Modal from '../Modal'
import { kindOrder, kinds } from '../../data/mock'
import { button, input, label, select } from '../../lib/ui'
import { useHealthData } from '../../store/healthData'
import type { Kind } from '../../types'

const relations = ['Parent', 'Spouse', 'Sibling', 'Child', 'Guardian', 'Friend', 'Other']

export default function CaregiverDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useHealthData()
  const [name, setName] = useState('')
  const [relation, setRelation] = useState(relations[0])
  const [scope, setScope] = useState<Kind[]>(['vaccination'])
  const [error, setError] = useState('')

  const close = () => {
    setName('')
    setRelation(relations[0])
    setScope(['vaccination'])
    setError('')
    onClose()
  }

  const toggle = (k: Kind) => setScope((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Enter the caregiver\u2019s name.')
    if (scope.length === 0) return setError('Choose at least one type of record to share.')
    actions.addCaregiver({ name: name.trim(), relation, scope })
    close()
  }

  return (
    <Modal open={open} onClose={close} title="Add a caregiver" description="A caregiver can see the record types you choose until you remove them.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <label htmlFor="cg-name" className={label}>
            Full name
          </label>
          <input id="cg-name" data-autofocus className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="cg-rel" className={label}>
            Relationship
          </label>
          <select id="cg-rel" className={select} value={relation} onChange={(e) => setRelation(e.target.value)}>
            {relations.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <fieldset className="grid gap-2">
          <legend className={`${label} mb-2`}>What can they see?</legend>
          <div className="flex flex-wrap gap-2">
            {kindOrder.map((k) => (
              <label className="relative cursor-pointer" data-kind={k} key={k}>
                <input type="checkbox" checked={scope.includes(k)} onChange={() => toggle(k)} className="peer absolute inset-0 size-full cursor-pointer opacity-0" />
                <span className="inline-flex items-center rounded-full border border-line-strong bg-white px-3.5 py-[7px] text-[0.88rem] font-medium text-ink-soft transition-colors peer-checked:border-(--k) peer-checked:bg-(--kt) peer-checked:font-semibold peer-checked:text-(--ki) peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand/45">
                  {kinds[k].plural}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-allergy-ink">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={button('ghost', 'sm')} onClick={close}>
            Cancel
          </button>
          <button type="submit" className={button('primary', 'sm')}>
            Add caregiver
          </button>
        </div>
      </form>
    </Modal>
  )
}
