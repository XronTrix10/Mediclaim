import { request } from './client'

export interface OrganizationSummary {
  id: string
  publicId: string
  hospitalId?: string
  name: string
  organizationType: 'hospital' | 'clinic' | 'pharmacy' | 'diagnostic_lab'
  registrationNumber?: string
  address?: string
  phone?: string
  email?: string
  practitionersCount: number
  createdAt: string
  practitioners?: any[]
}

export interface OrganizationCreateInput {
  name: string
  organizationType: 'hospital' | 'clinic' | 'pharmacy' | 'diagnostic_lab'
  registrationNumber: string
  address?: string
  phone?: string
  email?: string
}

export interface PractitionerSummary {
  id: string
  publicId: string
  doctorId?: string
  fullName: string
  registrationNumber: string
  specialization?: string
  qualification?: string
  phone: string
  email?: string
  organization?: {
    id: string
    publicId: string
    hospitalId?: string
    name: string
  }
  createdAt: string
}

export interface PractitionerCreateInput {
  fullName: string
  phone: string
  email?: string
  password: string
  registrationNumber: string
  specialization?: string
  qualification?: string
  organizationId?: string
  designation?: string
}

export async function getOrganizations(params?: {
  q?: string
  page?: number
  limit?: number
}): Promise<{ organizations: OrganizationSummary[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.q) query.set('q', params.q)
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))

  const res = await request<{ status: string; data: OrganizationSummary[]; meta: { total: number } }>(
    `/hospital/organizations?${query.toString()}`
  )
  return { organizations: res.data, total: res.meta?.total || res.data.length }
}

export async function registerOrganization(payload: OrganizationCreateInput): Promise<OrganizationSummary> {
  const res = await request<{ status: string; data: OrganizationSummary }>('/hospital/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function getOrganizationDetail(orgId: string): Promise<OrganizationSummary> {
  const res = await request<{ status: string; data: OrganizationSummary }>(
    `/hospital/organizations/${orgId}`
  )
  return res.data
}

export async function getPractitioners(params?: {
  organizationId?: string
  specialization?: string
  q?: string
  page?: number
  limit?: number
}): Promise<{ practitioners: PractitionerSummary[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.organizationId) query.set('organizationId', params.organizationId)
  if (params?.specialization) query.set('specialization', params.specialization)
  if (params?.q) query.set('q', params.q)
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))

  const res = await request<{ status: string; data: PractitionerSummary[]; meta: { total: number } }>(
    `/hospital/practitioners?${query.toString()}`
  )
  return { practitioners: res.data, total: res.meta?.total || res.data.length }
}

export async function onboardPractitioner(payload: PractitionerCreateInput): Promise<PractitionerSummary> {
  const res = await request<{ status: string; data: PractitionerSummary }>('/hospital/practitioners', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function getPractitionerDetail(practitionerId: string): Promise<PractitionerSummary> {
  const res = await request<{ status: string; data: PractitionerSummary }>(
    `/hospital/practitioners/${practitionerId}`
  )
  return res.data
}
