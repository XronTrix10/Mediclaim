export type Gender = 'Male' | 'Female' | 'Non-binary' | 'Other' | 'Prefer not to say'

export type BloodGroup = 'A+' | 'A−' | 'B+' | 'B−' | 'AB+' | 'AB−' | 'O+' | 'O−' | 'Unknown'

export type EmergencyRelation =
  | 'Parent'
  | 'Spouse'
  | 'Sibling'
  | 'Child'
  | 'Friend'
  | 'Guardian'
  | 'Other'

export interface EmergencyContact {
  name: string
  phone: string
  relation: EmergencyRelation | string
}

export interface PatientProfile {
  id: string
  userId: string
  mediclaimId: string
  aadhaarMasked?: string
  fullName: string
  firstName: string
  dateOfBirth: string
  gender: Gender
  bloodGroup: BloodGroup
  phone: string
  address: string
  emergencyContact: EmergencyContact
  isProfileComplete: boolean
  createdAt: string
  updatedAt: string
}

export interface ProfileCompletionPayload {
  gender: Gender | string
  bloodGroup: BloodGroup | string
  address: string
  emergencyName: string
  emergencyPhone: string
  emergencyRelation: EmergencyRelation | string
}

export interface PermittedPersonalDetailsUpdate {
  phone?: string
  address?: string
  emergencyContact?: EmergencyContact
}

