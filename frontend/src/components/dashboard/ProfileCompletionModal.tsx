import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import Modal from '../Modal'
import { button, input, label, select, textarea } from '../../lib/ui'
import { bloodGroupLabel, isValidPhone } from '../../lib/format'
import type { BloodGroup, EmergencyRelation, Gender, ProfileCompletionPayload } from '../../types'

const bloodGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']
const genders: Gender[] = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say']
const relations: EmergencyRelation[] = ['Parent', 'Spouse', 'Sibling', 'Child', 'Guardian', 'Friend', 'Other']

interface ProfileCompletionModalProps {
  initialName?: string
  onComplete: (payload: ProfileCompletionPayload) => Promise<void> | void
}

export default function ProfileCompletionModal({ initialName, onComplete }: ProfileCompletionModalProps) {
  const [form, setForm] = useState<ProfileCompletionPayload>({
    gender: '',
    bloodGroup: '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileCompletionPayload, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const set = (key: keyof ProfileCompletionPayload) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setApiError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setApiError(null)
    const next: typeof errors = {}
    if (!form.gender) next.gender = 'Choose a gender.'
    if (!form.bloodGroup) next.bloodGroup = 'Choose a blood group.'
    if (!form.address.trim()) next.address = 'Enter your address.'
    if (!form.emergencyName.trim()) next.emergencyName = 'Enter a name.'
    if (!isValidPhone(form.emergencyPhone)) next.emergencyPhone = 'Enter a valid phone number.'
    if (!form.emergencyRelation) next.emergencyRelation = 'Choose a relationship.'
    setErrors(next)
    if (Object.keys(next).length === 0) {
      setSubmitting(true)
      try {
        await onComplete(form)
      } catch (err: any) {
        setApiError(err?.message || 'Failed to save profile. Please check the details and try again.')
      } finally {
        setSubmitting(false)
      }
    }
  }

  const err = (key: keyof ProfileCompletionPayload) =>
    errors[key] ? (
      <span id={`err-${key}`} className="text-xs text-allergy-ink">
        {errors[key]}
      </span>
    ) : null
  const aria = (key: keyof ProfileCompletionPayload) => ({
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `err-${key}` : undefined,
  })

  return (
    <Modal
      open
      dismissible={false}
      size="lg"
      icon="user"
      title="Complete your profile"
      description={`${initialName ? `Welcome, ${initialName}. ` : ''}We need a few details to set up your health record.`}
    >
      <form onSubmit={submit} className="grid gap-5" noValidate>
        {apiError && (
          <div role="alert" className="rounded-xl bg-allergy-tint p-3 text-sm font-medium text-allergy-ink">
            {apiError}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="p-gender" className={label}>
              Gender
            </label>
            <select id="p-gender" className={select} value={form.gender} onChange={set('gender')} {...aria('gender')}>
              <option value="" disabled>
                Select gender
              </option>
              {genders.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {err('gender')}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="p-blood" className={label}>
              Blood group
            </label>
            <select id="p-blood" className={select} value={form.bloodGroup} onChange={set('bloodGroup')} {...aria('bloodGroup')}>
              <option value="" disabled>
                Select blood group
              </option>
              {bloodGroups.map((bg) => (
                <option key={bg} value={bg}>
                  {bloodGroupLabel(bg)}
                </option>
              ))}
            </select>
            {err('bloodGroup')}
          </div>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="p-address" className={label}>
            Home address
          </label>
          <textarea
            id="p-address"
            rows={2}
            autoComplete="street-address"
            className={textarea}
            placeholder="Flat or door number, street, city, state, PIN code"
            value={form.address}
            onChange={set('address')}
            {...aria('address')}
          />
          {err('address')}
        </div>

        <fieldset className="grid gap-3.5 rounded-[18px] border border-line bg-mist/50 p-4">
          <legend className="px-1 text-[0.9rem] font-semibold text-ink">Emergency contact</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="p-ename" className={label}>
                Full name
              </label>
              <input id="p-ename" className={input} placeholder="For example, Lakshmi Rao" value={form.emergencyName} onChange={set('emergencyName')} {...aria('emergencyName')} />
              {err('emergencyName')}
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="p-ephone" className={label}>
                Phone number
              </label>
              <input id="p-ephone" type="tel" inputMode="tel" className={input} placeholder="+91 98765 12345" value={form.emergencyPhone} onChange={set('emergencyPhone')} {...aria('emergencyPhone')} />
              {err('emergencyPhone')}
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <label htmlFor="p-erel" className={label}>
                Relationship
              </label>
              <select id="p-erel" className={select} value={form.emergencyRelation} onChange={set('emergencyRelation')} {...aria('emergencyRelation')}>
                <option value="" disabled>
                  Select relationship
                </option>
                {relations.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {err('emergencyRelation')}
            </div>
          </div>
        </fieldset>

        <div>
          <button className={`${button('primary', 'lg')} w-full cursor-pointer justify-center`} type="submit" disabled={submitting}>
            {submitting ? 'Saving details…' : 'Save and continue'}
          </button>
          <p className="mt-2 text-center text-[0.8rem] text-ink-faint">
            You can change your phone numbers and address later.
          </p>
        </div>
      </form>
    </Modal>
  )
}
