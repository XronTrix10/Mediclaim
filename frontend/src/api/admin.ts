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
}

export interface VerificationDetail extends PendingVerification {
  mediclaimIdAllocated?: string
}

export interface AdminStats {
  totalPatients: number
  pendingApprovals: number
  approvedPatients: number
  totalPractitioners: number
  totalOrganizations: number
  totalEmergencyEvents: number
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
}): Promise<PendingVerification[]> {
  const query = new URLSearchParams()
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.offset) query.set('offset', String(params.offset))
  if (params?.query) query.set('query', params.query)

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
  const res = await request<{ status: string; data: AdminStats }>('/admin/stats')
  return res.data
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
