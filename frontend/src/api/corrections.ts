import { api } from './client'
import type { CorrectionRequest } from '../types'

export interface CorrectionReviewInput {
  status: 'approved' | 'rejected'
  reviewNotes?: string
}

export const correctionsApi = {
  async getCorrections(params?: { status?: string; patientMediclaimId?: string }): Promise<CorrectionRequest[]> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.patientMediclaimId) query.set('patientMediclaimId', params.patientMediclaimId)
    const qs = query.toString() ? `?${query.toString()}` : ''

    const res = await api.get<{ status: string; data: any[] }>(`/corrections${qs}`)
    return (res.data || []).map((c) => ({
      id: c.id,
      recordId: c.recordId,
      recordTitle: c.recordTitle,
      reason: c.reason,
      proposed: c.proposed,
      status: (c.correctionStatus || c.status || 'under_review') as 'under_review' | 'approved' | 'rejected',
      createdAt: c.createdAt,
      reviewedAt: c.reviewedAt,
      reviewNotes: c.reviewNotes,
      patientId: c.patientId,
      patientName: c.patientName,
      patientMediclaimId: c.patientMediclaimId,
      requestedByName: c.requestedByName,
    }))
  },

  async requestCorrection(input: {
    recordId: string
    recordTitle: string
    reason: string
    proposed?: string
  }): Promise<CorrectionRequest> {
    const res = await api.post<{ status: string; data: any }>('/corrections', input)
    const c = res.data
    return {
      id: c.id,
      recordId: c.recordId,
      recordTitle: c.recordTitle,
      reason: c.reason,
      proposed: c.proposed,
      status: 'under_review',
      createdAt: c.createdAt,
    }
  },

  async reviewCorrection(id: string, input: CorrectionReviewInput): Promise<any> {
    const cleanId = id.replace('corr_', '')
    const res = await api.patch<{ status: string; data: any }>(`/corrections/${cleanId}`, input)
    return res.data
  },

  async withdrawCorrection(id: string): Promise<void> {
    const cleanId = id.replace('corr_', '')
    await api.delete(`/corrections/${cleanId}`)
  },
}
