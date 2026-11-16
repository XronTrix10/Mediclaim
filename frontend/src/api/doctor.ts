import { request } from './client'
import type { HealthEvent } from '../types'

export interface DoctorPatientSummary {
  patientProfileId: string
  mediclaimId: string
  fullName: string
  gender?: string
  dateOfBirth?: string
  bloodGroup?: string
  grantId: string
  approvedScopes: string[]
  expiresAt: string
}

export interface DoctorAccessRequestItem {
  id: string
  patientMediclaimId: string
  patientFullName?: string
  scope: string[]
  durationHours: number
  purpose?: string
  status: string
  requestedAt?: string
  expiresAt?: string
}

export interface DoctorEncounterInput {
  encounterType?: 'outpatient' | 'emergency' | 'inpatient' | 'telehealth'
  reason: string
  diagnosisSummary?: string
  startTime?: string
  endTime?: string
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled'
}

export interface DoctorConditionInput {
  conditionName: string
  severity?: 'mild' | 'moderate' | 'severe'
  status?: 'active' | 'resolved' | 'inactive' | 'discontinued'
  onsetDate?: string
  resolvedDate?: string
  notes?: string
}

export interface DoctorPrescriptionInput {
  title: string
  instructions?: string
  date?: string
  medications: Array<{
    name: string
    dosage?: string
    frequency?: string
    duration?: string
    instructions?: string
  }>
}

export interface DoctorReportInput {
  reportName: string
  reportType?: string
  reportDate?: string
  conclusion?: string
  status?: 'draft' | 'final' | 'amended' | 'cancelled'
}

export interface DoctorVaccinationInput {
  vaccineName: string
  doseNumber?: number
  administeredDate?: string
  batchNumber?: string
  notes?: string
}

export async function getAuthorizedPatients(): Promise<DoctorPatientSummary[]> {
  const res = await request<{ status: string; data: DoctorPatientSummary[] }>('/doctor/patients')
  return res.data
}

export async function getAuthorizedPatient(mediclaimId: string): Promise<any> {
  const res = await request<{ status: string; data: any }>(`/doctor/patients/${mediclaimId}`)
  return res.data
}

export async function getAuthorizedRecords(
  mediclaimId: string,
  kind?: string
): Promise<{ patient: any; approvedScopes: string[]; expiresAt: string; records: HealthEvent[] }> {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : ''
  const res = await request<{
    status: string
    data: { patient: any; approvedScopes: string[]; expiresAt: string; records: HealthEvent[] }
  }>(`/doctor/patients/${mediclaimId}/records${q}`)
  return res.data
}

export async function submitAccessRequest(payload: {
  patientMediclaimId: string
  scope: string[]
  durationHours: number
  purpose: string
}): Promise<any> {
  const res = await request<{ status: string; data: any }>('/doctor/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function getDoctorAccessRequests(status: string = 'all'): Promise<DoctorAccessRequestItem[]> {
  const res = await request<{ status: string; data: DoctorAccessRequestItem[] }>(
    `/doctor/requests?status=${encodeURIComponent(status)}`
  )
  return res.data
}

export async function createEncounter(
  mediclaimId: string,
  payload: DoctorEncounterInput
): Promise<any> {
  const res = await request<{ status: string; data: any }>(
    `/doctor/patients/${mediclaimId}/encounters`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
  return res.data
}

export async function createDoctorCondition(
  mediclaimId: string,
  payload: DoctorConditionInput
): Promise<any> {
  const res = await request<{ status: string; data: any }>(
    `/doctor/patients/${mediclaimId}/conditions`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
  return res.data
}

export async function createDoctorPrescription(
  mediclaimId: string,
  payload: DoctorPrescriptionInput
): Promise<any> {
  const res = await request<{ status: string; data: any }>(
    `/doctor/patients/${mediclaimId}/prescriptions`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
  return res.data
}

export async function createDoctorReport(
  mediclaimId: string,
  payload: DoctorReportInput
): Promise<any> {
  const res = await request<{ status: string; data: any }>(
    `/doctor/patients/${mediclaimId}/reports`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
  return res.data
}

export async function createDoctorVaccination(
  mediclaimId: string,
  payload: DoctorVaccinationInput
): Promise<any> {
  const res = await request<{ status: string; data: any }>(
    `/doctor/patients/${mediclaimId}/vaccinations`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
  return res.data
}
