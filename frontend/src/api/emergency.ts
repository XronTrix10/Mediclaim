import { request } from './client'

export type EmergencyType =
  | 'TRAUMA_RESUSCITATION'
  | 'ACUTE_CORONARY'
  | 'STROKE_THROMBOLYSIS'
  | 'MASS_CASUALTY'
  | 'OTHER_LIFE_THREATENING'

export interface EmergencyAccessInput {
  patientMediclaimId: string
  emergencyType: EmergencyType
  clinicalJustification: string
}

export interface EmergencyCriticalAllergy {
  allergen: string
  severity: string
  reaction: string
}

export interface EmergencyActiveCondition {
  conditionName: string
  status: string
}

export interface EmergencyCriticalSummary {
  bloodGroup: string
  criticalAllergies: EmergencyCriticalAllergy[]
  activeConditions: EmergencyActiveCondition[]
}

export interface EmergencyAccessData {
  emergencyStatus: string
  auditTrackingId: string
  expiresAt: string
  reviewMandatoryBefore: string
  criticalSummary: EmergencyCriticalSummary
}

export interface PatientEmergencyEvent {
  id: string
  requesterName: string
  emergencyType: string
  clinicalJustification: string
  occurredAt: string
}

export async function triggerEmergencyAccess(
  payload: EmergencyAccessInput
): Promise<EmergencyAccessData> {
  const res = await request<{ status: string; data: EmergencyAccessData }>(
    '/emergency/access',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
  return res.data
}

export async function getPatientEmergencyEvents(): Promise<PatientEmergencyEvent[]> {
  const res = await request<{ status: string; data: PatientEmergencyEvent[] }>(
    '/emergency/events'
  )
  return res.data
}

