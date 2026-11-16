import { api } from './client'
import type { AccessGrant, AccessRequest, Caregiver, Kind } from '../types'

export const consentApi = {
  async getRequests(): Promise<AccessRequest[]> {
    const res = await api.get<{ status: string; data: AccessRequest[] }>('/consent/requests')
    return res.data
  },

  async approveRequest(id: string, scope: Kind[], durationHours: number = 4): Promise<AccessGrant> {
    const res = await api.post<{ status: string; data: AccessGrant }>(`/consent/requests/${id}/approve`, {
      approvedScope: scope,
      durationHours,
    })
    return res.data
  },

  async declineRequest(id: string): Promise<void> {
    await api.post(`/consent/requests/${id}/decline`, {})
  },

  async getGrants(): Promise<AccessGrant[]> {
    const res = await api.get<{ status: string; data: AccessGrant[] }>('/consent/grants')
    return res.data
  },

  async giveAccess(input: {
    practitionerId?: string
    name: string
    role?: string
    scope: Kind[]
    hours: number
  }): Promise<AccessGrant> {
    const res = await api.post<{ status: string; data: AccessGrant }>('/consent/grants', {
      practitionerId: input.practitionerId,
      name: input.name,
      role: input.role || 'Practitioner',
      scope: input.scope,
      durationHours: input.hours,
    })
    return res.data
  },

  async revokeGrant(id: string): Promise<void> {
    await api.delete(`/consent/grants/${id}`)
  },

  async getCaregivers(): Promise<Caregiver[]> {
    const res = await api.get<{ status: string; data: Caregiver[] }>('/consent/caregivers')
    return res.data
  },

  async addCaregiver(input: {
    name: string
    relation: string
    scope: Kind[]
  }): Promise<Caregiver> {
    const res = await api.post<{ status: string; data: Caregiver }>('/consent/caregivers', {
      name: input.name,
      relation: input.relation,
      scope: input.scope,
    })
    return res.data
  },

  async removeCaregiver(id: string): Promise<void> {
    await api.delete(`/consent/caregivers/${id}`)
  },
}
