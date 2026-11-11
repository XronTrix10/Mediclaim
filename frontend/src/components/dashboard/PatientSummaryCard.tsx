import { useState } from 'react'
import Icon from '../Icon'
import { card, button, input } from '../../lib/ui'
import { ageAt, formatDate } from '../../lib/format'
import type { PatientProfile, PermittedPersonalDetailsUpdate } from '../../types'

interface PatientSummaryCardProps {
  profile: PatientProfile
  onUpdatePermittedDetails?: (update: PermittedPersonalDetailsUpdate) => void
}

export default function PatientSummaryCard({ profile, onUpdatePermittedDetails }: PatientSummaryCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [phone, setPhone] = useState(profile.phone)
  const [address, setAddress] = useState(profile.address)
  const [emergencyPhone, setEmergencyPhone] = useState(profile.emergencyContact.phone)

  const patientAge = ageAt(profile.dateOfBirth, profile.updatedAt || '2026-11-11')

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdatePermittedDetails?.({
      phone,
      address,
      emergencyContact: {
        ...profile.emergencyContact,
        phone: emergencyPhone,
      },
    })
    setIsEditing(false)
  }

  return (
    <section className={card} aria-labelledby="patient-info-h">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id="patient-info-h" className="text-[1.35rem] font-medium text-ink">
              {profile.fullName}
            </h2>
            <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-deep">
              {profile.gender}
            </span>
            <span className="rounded-full bg-allergy-tint px-2.5 py-0.5 text-xs font-semibold text-allergy-ink">
              {profile.bloodGroup}
            </span>
          </div>
          <p className="mt-1 text-[0.85rem] text-ink-faint">
            Mediclaim ID: <strong className="font-mono text-ink">{profile.mediclaimId}</strong>
            {profile.aadhaarMasked && ` · Aadhaar: ${profile.aadhaarMasked}`}
            {' · '}DOB: {formatDate(profile.dateOfBirth)} ({patientAge})
          </p>
        </div>

        <button
          type="button"
          className={button('ghost', 'sm')}
          onClick={() => setIsEditing(!isEditing)}
        >
          <Icon name="user" size={15} />
          {isEditing ? 'Cancel' : 'Edit permitted details'}
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="mt-4 grid gap-4 rounded-[16px] bg-mist/60 p-4">
          <p className="text-xs font-semibold text-brand uppercase tracking-wider">
            Edit Permitted Personal Details (Phone & Address)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <label htmlFor="edit-phone" className="text-xs font-semibold text-ink">
                Personal phone
              </label>
              <input
                id="edit-phone"
                className={input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="edit-ephone" className="text-xs font-semibold text-ink">
                Emergency phone ({profile.emergencyContact.name} - {profile.emergencyContact.relation})
              </label>
              <input
                id="edit-ephone"
                className={input}
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <label htmlFor="edit-address" className="text-xs font-semibold text-ink">
                Residential address
              </label>
              <input
                id="edit-address"
                className={input}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={button('ghost', 'sm')} onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button type="submit" className={button('primary', 'sm')}>
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 text-[0.88rem] sm:grid-cols-3">
          <div className="flex items-start gap-2.5">
            <Icon name="phone" size={16} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <span className="block text-xs text-ink-faint">Contact phone</span>
              <strong className="font-medium text-ink">{profile.phone}</strong>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Icon name="map-pin" size={16} className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0">
              <span className="block text-xs text-ink-faint">Address</span>
              <span className="block truncate text-ink">{profile.address}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <span className="block text-xs text-ink-faint">Emergency contact</span>
              <strong className="font-medium text-ink">
                {profile.emergencyContact.name} ({profile.emergencyContact.relation})
              </strong>
              <small className="block text-[0.78rem] text-ink-soft">{profile.emergencyContact.phone}</small>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
