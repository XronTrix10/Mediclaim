import { request } from './client'

export interface PendingVerification {
  userId: string
  fullName: string
  phone: string
  aadhaarMasked: string
  dateOfBirth: string
  gender?: string
  address?: string
  bloodGroup?: string
  adminVerified: boolean
  registeredAt: string
  mediclaimId?: string
  role?: string
}

export interface VerificationDetail extends PendingVerification {
  mediclaimIdAllocated?: string
  accountStatus?: string
  emergencyContact?: {
    name: string
    phone: string
    relation: string
  }
  specialization?: string
  registrationNumber?: string
  qualification?: string
  organizationName?: string
}

export interface AdminStats {
  totalPatients: number
  pendingApprovals: number
  pendingVerifications?: number
  approvedPatients: number
  totalPractitioners: number
  totalOrganizations: number
  totalHealthcareOrganizations?: number
  totalEmergencyEvents: number
  emergencyBreakGlassEvents?: number
  totalClinicalRecords?: number
}

export interface GlobalEmergencyEvent {
  id: string
  doctorName: string
  doctorPhone?: string
  patientName: string
  mediclaimId: string
  hospitalName?: string
  reason: string
  occurredAt: string
}

export async function getPendingVerifications(params?: {
  limit?: number
  offset?: number
  query?: string
  status?: 'pending' | 'verified' | 'all'
}): Promise<PendingVerification[]> {
  const query = new URLSearchParams()
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.offset) query.set('offset', String(params.offset))
  if (params?.query) query.set('query', params.query)
  if (params?.status) query.set('status', params.status)

  const res = await request<{ status: string; data: PendingVerification[] }>(
    `/admin/verifications?${query.toString()}`
  )
  return res.data
}

export async function getPatientVerificationDetail(userId: string): Promise<VerificationDetail> {
  const res = await request<{ status: string; data: VerificationDetail }>(
    `/admin/verifications/${userId}`
  )
  return res.data
}

export async function approvePatientVerification(userId: string): Promise<{
  userId: string
  mediclaimId: string
  approvedAt: string
}> {
  const res = await request<{ status: string; data: { userId: string; mediclaimId: string; approvedAt: string } }>(
    `/admin/verifications/${userId}/approve`,
    { method: 'POST' }
  )
  return res.data
}

export async function rejectPatientVerification(userId: string, reason: string): Promise<void> {
  await request<{ status: string; message: string }>(
    `/admin/verifications/${userId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  )
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await request<{ status: string; data: any }>('/admin/stats')
  const d = res.data || {}
  return {
    totalPatients: d.totalPatients ?? 0,
    pendingApprovals: d.pendingApprovals ?? d.pendingVerifications ?? 0,
    pendingVerifications: d.pendingVerifications ?? d.pendingApprovals ?? 0,
    approvedPatients: d.approvedPatients ?? 0,
    totalPractitioners: d.totalPractitioners ?? 0,
    totalOrganizations: d.totalOrganizations ?? d.totalHealthcareOrganizations ?? 0,
    totalHealthcareOrganizations: d.totalHealthcareOrganizations ?? d.totalOrganizations ?? 0,
    totalEmergencyEvents: d.totalEmergencyEvents ?? d.emergencyBreakGlassEvents ?? 0,
    emergencyBreakGlassEvents: d.emergencyBreakGlassEvents ?? d.totalEmergencyEvents ?? 0,
    totalClinicalRecords: d.totalClinicalRecords ?? 0,
  }
}

export async function getAllPatients(params?: {
  page?: number
  limit?: number
  query?: string
}): Promise<{ patients: any[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.query) query.set('query', params.query)

  const res = await request<{ status: string; data: any[]; meta: { total?: number } }>(
    `/admin/patients?${query.toString()}`
  )
  return { patients: res.data, total: res.meta?.total || res.data.length }
}

export async function getGlobalEmergencyEvents(): Promise<GlobalEmergencyEvent[]> {
  const res = await request<{ status: string; data: GlobalEmergencyEvent[] }>(
    '/admin/emergency-events'
  )
  return res.data
}
