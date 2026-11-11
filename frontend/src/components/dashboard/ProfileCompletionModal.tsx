import { useState } from 'react'
import Icon from '../Icon'
import { button, input, select } from '../../lib/ui'
import type { BloodGroup, Gender, EmergencyRelation, ProfileCompletionPayload } from '../../types'

const bloodGroups: BloodGroup[] = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Unknown']
const genders: Gender[] = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say']
const emergencyRelations: EmergencyRelation[] = ['Parent', 'Spouse', 'Sibling', 'Child', 'Guardian', 'Friend', 'Other']

interface ProfileCompletionModalProps {
  onComplete: (payload: ProfileCompletionPayload) => void
  initialName?: string
}

export default function ProfileCompletionModal({ onComplete, initialName }: ProfileCompletionModalProps) {
  const [form, setForm] = useState<ProfileCompletionPayload>({
    gender: '',
    bloodGroup: '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (key: keyof ProfileCompletionPayload) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!form.gender) newErrors.gender = 'Please select a gender'
    if (!form.bloodGroup) newErrors.bloodGroup = 'Please select a blood group'
    if (!form.address.trim()) newErrors.address = 'Address is required'
    if (!form.emergencyName.trim()) newErrors.emergencyName = 'Emergency contact name is required'
    if (!form.emergencyPhone.trim()) newErrors.emergencyPhone = 'Emergency phone is required'
    if (!form.emergencyRelation) newErrors.emergencyRelation = 'Please specify relation'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onComplete(form)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="w-full max-w-lg rounded-[28px] border border-line bg-white shadow-soft overflow-hidden">
        {/* Header */}
        <div className="border-b border-line bg-mist/60 px-7 pt-7 pb-5">
          <div className="inline-flex size-11 items-center justify-center rounded-[14px] bg-brand-tint text-brand">
            <Icon name="user" size={22} />
          </div>
          <h2 id="profile-modal-title" className="mt-3 text-[1.55rem] font-medium tracking-tight text-ink">
            Complete your profile
          </h2>
          <p className="mt-1 text-[0.92rem] text-ink-soft">
            {initialName ? `Welcome ${initialName}. ` : ''}Please fill these required details to initialize your lifetime health record.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-7 py-6">
          <div className="grid gap-5">
            {/* Gender and Blood Group */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="p-gender" className="text-sm font-semibold text-ink">
                  Gender <span className="text-allergy">*</span>
                </label>
                <select
                  id="p-gender"
                  className={select}
                  value={form.gender}
                  onChange={handleChange('gender')}
                  required
                >
                  <option value="" disabled>Select gender…</option>
                  {genders.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                {errors.gender && <span className="text-xs text-allergy">{errors.gender}</span>}
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="p-blood" className="text-sm font-semibold text-ink">
                  Blood group <span className="text-allergy">*</span>
                </label>
                <select
                  id="p-blood"
                  className={select}
                  value={form.bloodGroup}
                  onChange={handleChange('bloodGroup')}
                  required
                >
                  <option value="" disabled>Select blood group…</option>
                  {bloodGroups.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
                {errors.bloodGroup && <span className="text-xs text-allergy">{errors.bloodGroup}</span>}
              </div>
            </div>

            {/* Address */}
            <div className="grid gap-1.5">
              <label htmlFor="p-address" className="text-sm font-semibold text-ink">
                Permanent residential address <span className="text-allergy">*</span>
              </label>
              <textarea
                id="p-address"
                rows={2}
                className="w-full rounded-[14px] border border-line-strong bg-white px-4 py-2.5 text-[0.92rem] transition placeholder:text-[#85999f] focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none resize-none"
                placeholder="Flat/door no, street, city, state – PIN code"
                value={form.address}
                onChange={handleChange('address')}
                required
              />
              {errors.address && <span className="text-xs text-allergy">{errors.address}</span>}
            </div>

            {/* Emergency Contact */}
            <div className="rounded-[18px] border border-line bg-mist/50 p-4">
              <p className="mb-3 text-[0.9rem] font-semibold text-ink flex items-center gap-1.5">
                <Icon name="phone" size={16} className="text-brand" />
                Emergency Contact <span className="text-allergy">*</span>
              </p>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label htmlFor="p-ename" className="text-xs font-medium text-ink-soft">
                    Full name
                  </label>
                  <input
                    id="p-ename"
                    className={input}
                    placeholder="e.g. Lakshmi Rao"
                    value={form.emergencyName}
                    onChange={handleChange('emergencyName')}
                    required
                  />
                  {errors.emergencyName && <span className="text-xs text-allergy">{errors.emergencyName}</span>}
                </div>

                <div className="grid gap-1">
                  <label htmlFor="p-ephone" className="text-xs font-medium text-ink-soft">
                    Phone number
                  </label>
                  <input
                    id="p-ephone"
                    type="tel"
                    className={input}
                    placeholder="+91 98765 12345"
                    value={form.emergencyPhone}
                    onChange={handleChange('emergencyPhone')}
                    required
                  />
                  {errors.emergencyPhone && <span className="text-xs text-allergy">{errors.emergencyPhone}</span>}
                </div>

                <div className="grid gap-1 sm:col-span-2">
                  <label htmlFor="p-erel" className="text-xs font-medium text-ink-soft">
                    Relationship to patient
                  </label>
                  <select
                    id="p-erel"
                    className={select}
                    value={form.emergencyRelation}
                    onChange={handleChange('emergencyRelation')}
                    required
                  >
                    <option value="" disabled>Select relationship…</option>
                    {emergencyRelations.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {errors.emergencyRelation && <span className="text-xs text-allergy">{errors.emergencyRelation}</span>}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button className={`${button('primary', 'lg')} w-full`} type="submit">
                Save and Enter Dashboard
              </button>
              <p className="mt-2 text-center text-[0.8rem] text-ink-faint">
                You can edit permitted personal details (phone, address, emergency contact) anytime.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

