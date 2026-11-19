import { createContext, useContext } from 'react'
import type {
  AccessGrant,
  AccessRequest,
  AuditLogEntry,
  Caregiver,
  CorrectionRequest,
  HealthEvent,
  Kind,
  NewAllergyInput,
  NewConditionInput,
  NewMedicationInput,
  NewVaccinationInput,
  NewReportInput,
  PatientProfile,
  PermittedPersonalDetailsUpdate,
  PrescriptionRecord,
  ProfileCompletionPayload,
} from '../types'

export interface HealthState {
  profile: PatientProfile
  /** Records the user owns directly (allergies). Prescriptions and sample data are merged in by the provider. */
  ownEvents: HealthEvent[]
  prescriptions: PrescriptionRecord[]
  sampleLoaded: boolean
  grants: AccessGrant[]
  requests: AccessRequest[]
  caregivers: Caregiver[]
  audit: AuditLogEntry[]
  corrections: CorrectionRequest[]
}

export interface GiveAccessInput {
  name: string
  role?: string
  scope: Kind[]
  hours: number
}

export interface HealthActions {
  completeProfile: (payload: ProfileCompletionPayload) => Promise<void> | void
  updatePermittedDetails: (update: PermittedPersonalDetailsUpdate) => Promise<void> | void
  addAllergy: (input: NewAllergyInput) => Promise<HealthEvent | void> | void
  addVaccination: (input: NewVaccinationInput) => Promise<HealthEvent>
  addCondition: (input: NewConditionInput) => Promise<HealthEvent>
  addMedication: (input: NewMedicationInput) => Promise<HealthEvent>
  addReport: (input: NewReportInput) => Promise<HealthEvent>
  addPrescription: (rx: Omit<PrescriptionRecord, 'id'>) => void
  removePrescription: (id: string) => void
  toggleSample: () => void
  revokeGrant: (id: string) => void
  giveAccess: (input: GiveAccessInput) => AccessGrant
  approveRequest: (id: string) => void
  declineRequest: (id: string) => void
  addCaregiver: (input: Omit<Caregiver, 'id' | 'since'>) => void
  removeCaregiver: (id: string) => void
  requestCorrection: (input: { recordId: string; recordTitle: string; reason: string; proposed?: string }) => void
}

export interface HealthContextValue extends HealthState {
  /** Everything on record, newest first: own records, prescriptions and (optionally) sample data. */
  events: HealthEvent[]
  actions: HealthActions
}

export const HealthDataContext = createContext<HealthContextValue | null>(null)

export function useHealthData(): HealthContextValue {
  const ctx = useContext(HealthDataContext)
  if (!ctx) throw new Error('useHealthData must be used inside <HealthDataProvider>')
  return ctx
}
