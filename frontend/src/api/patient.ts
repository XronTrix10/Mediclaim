import { api } from './client'
import type { PatientProfile, ProfileCompletionPayload, PermittedPersonalDetailsUpdate } from '../types'

export const patientApi = {
  async getProfile(): Promise<PatientProfile> {
    const res = await api.get<{ status: string; data: PatientProfile }>('/patients/me')
    return res.data
  },

  async completeProfile(payload: ProfileCompletionPayload): Promise<PatientProfile> {
    await api.post('/patients/me/complete-profile', {
      gender: payload.gender,
      bloodGroup: payload.bloodGroup,
      address: payload.address.trim(),
      emergencyName: payload.emergencyName.trim(),
      emergencyPhone: payload.emergencyPhone.trim(),
      emergencyRelation: payload.emergencyRelation,
    })
    return this.getProfile()
  },

  async updatePermittedDetails(update: PermittedPersonalDetailsUpdate): Promise<PatientProfile> {
    const payload: Record<string, any> = {}
    if (update.phone !== undefined) payload.phone = update.phone
    if (update.address !== undefined) payload.address = update.address
    if (update.emergencyContact !== undefined) {
      payload.emergencyContact = {
        name: update.emergencyContact.name,
        phone: update.emergencyContact.phone,
        relation: update.emergencyContact.relation,
      }
    }
    const res = await api.patch<{ status: string; data: PatientProfile }>('/patients/me/permitted-details', payload)
    return res.data
  },
}
