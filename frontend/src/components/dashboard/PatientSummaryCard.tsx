import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Icon from '../Icon'
import { button, card, input, label, textarea } from '../../lib/ui'
import { bloodGroupLabel, formatAge, formatDate, isValidPhone } from '../../lib/format'
import type { PatientProfile, PermittedPersonalDetailsUpdate } from '../../types'

interface PatientSummaryCardProps {
  profile: PatientProfile
  onUpdatePermittedDetails: (update: PermittedPersonalDetailsUpdate) => void
}

export default function PatientSummaryCard({ profile, onUpdatePermittedDetails }: PatientSummaryCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [phone, setPhone] = useState(profile.phone)
  const [address, setAddress] = useState(profile.address)
  const [emergencyPhone, setEmergencyPhone] = useState(profile.emergencyContact.phone)
  const [errors, setErrors] = useState<{ phone?: string; emergencyPhone?: string }>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!saved) return
    const id = setTimeout(() => setSaved(false), 4000)
    return () => clearTimeout(id)
  }, [saved])

  const startEditing = () => {
    // Always start from the saved values, so a cancelled edit never leaves stale text behind.
    setPhone(profile.phone)
    setAddress(profile.address)
    setEmergencyPhone(profile.emergencyContact.phone)
    setErrors({})
    setIsEditing(true)
  }

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!isValidPhone(phone)) next.phone = 'Enter a valid phone number, for example +91 98765 43210.'
    if (!isValidPhone(emergencyPhone)) next.emergencyPhone = 'Enter a valid phone number.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    onUpdatePermittedDetails({
      phone: phone.trim(),
      address: address.trim(),
      emergencyContact: { ...profile.emergencyContact, phone: emergencyPhone.trim() },
    })
    setIsEditing(false)
    setSaved(true)
  }

  return (
    <section className={card} aria-labelledby="patient-info-h">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="patient-info-h" className="text-[1.3rem] font-medium text-ink sm:text-[1.45rem]">
              {profile.fullName}
            </h2>
            <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-deep">
              {profile.gender}
            </span>
            <span className="rounded-full bg-allergy-tint px-2.5 py-0.5 text-xs font-semibold text-allergy-ink">
              {bloodGroupLabel(profile.bloodGroup)}
            </span>
          </div>
          <dl className="mt-2 grid gap-x-5 gap-y-1 text-[0.85rem] text-ink-faint sm:flex sm:flex-wrap">
            <div className="flex gap-1.5">
              <dt>Mediclaim ID</dt>
              <dd className="font-mono font-semibold tracking-tight text-ink">{profile.mediclaimId}</dd>
            </div>
            {profile.aadhaarMasked && (
              <div className="flex gap-1.5">
                <dt>Aadhaar</dt>
                <dd className="font-mono text-ink-soft">{profile.aadhaarMasked}</dd>
              </div>
            )}
            <div className="flex gap-1.5">
              <dt>Born</dt>
              <dd className="text-ink-soft">
                {formatDate(profile.dateOfBirth)} ({formatAge(profile.dateOfBirth)})
              </dd>
            </div>
          </dl>
        </div>

        <button
          type="button"
          className={button('ghost', 'sm')}
          onClick={() => (isEditing ? setIsEditing(false) : startEditing())}
          aria-expanded={isEditing}
        >
          <Icon name={isEditing ? 'x' : 'user'} size={15} />
          {isEditing ? 'Cancel' : 'Edit details'}
        </button>
      </div>

      {saved && (
        <p role="status" className="mt-4 rounded-[14px] bg-vaccination-tint px-4 py-2.5 text-[0.88rem] font-medium text-vaccination-ink">
          Your details were updated.
        </p>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} className="mt-4 grid gap-4 rounded-[18px] bg-mist/70 p-4" noValidate>
          <p className="text-[0.85rem] text-ink-soft">
            You can change your phone numbers and address. Clinical details can only be changed by your doctors.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="edit-phone" className={label}>
                Your phone
              </label>
              <input
                id="edit-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'edit-phone-err' : undefined}
                required
              />
              {errors.phone && (
                <span id="edit-phone-err" className="text-xs text-allergy-ink">
                  {errors.phone}
                </span>
              )}
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="edit-ephone" className={label}>
                Emergency phone ({profile.emergencyContact.name})
              </label>
              <input
                id="edit-ephone"
                type="tel"
                inputMode="tel"
                className={input}
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                aria-invalid={!!errors.emergencyPhone}
                aria-describedby={errors.emergencyPhone ? 'edit-ephone-err' : undefined}
                required
              />
              {errors.emergencyPhone && (
                <span id="edit-ephone-err" className="text-xs text-allergy-ink">
                  {errors.emergencyPhone}
                </span>
              )}
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <label htmlFor="edit-address" className={label}>
                Address
              </label>
              <textarea
                id="edit-address"
                rows={2}
                autoComplete="street-address"
                className={textarea}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={button('ghost', 'sm')} onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button type="submit" className={button('primary', 'sm')}>
              Save changes
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 grid gap-4 text-[0.9rem] sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <Icon name="phone" size={16} className="mt-0.5 text-brand" />
            <div className="min-w-0">
              <span className="block text-xs text-ink-faint">Phone</span>
              <strong className="font-medium text-ink">{profile.phone}</strong>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Icon name="shield" size={16} className="mt-0.5 text-brand" />
            <div className="min-w-0">
              <span className="block text-xs text-ink-faint">Emergency contact</span>
              <strong className="font-medium text-ink">
                {profile.emergencyContact.name} ({profile.emergencyContact.relation})
              </strong>
              <small className="block text-[0.8rem] text-ink-soft">{profile.emergencyContact.phone}</small>
            </div>
          </div>
          <div className="flex items-start gap-2.5 sm:col-span-2">
            <Icon name="map-pin" size={16} className="mt-0.5 text-brand" />
            <div className="min-w-0">
              <span className="block text-xs text-ink-faint">Address</span>
              <span className="block text-ink [overflow-wrap:anywhere]">{profile.address}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
