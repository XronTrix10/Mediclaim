import { api } from './client'
import type { CorrectionRequest } from '../types'

export const correctionsApi = {
  async getCorrections(): Promise<CorrectionRequest[]> {
    const res = await api.get<{ status: string; data: any[] }>('/corrections')
    return (res.data || []).map((c) => ({
      id: c.id,
      recordId: c.recordId,
      recordTitle: c.recordTitle,
      reason: c.reason,
      proposed: c.proposed,
      status: (c.correctionStatus || c.status || 'under_review') as 'under_review',
      createdAt: c.createdAt,
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

  async withdrawCorrection(id: string): Promise<void> {
    await api.delete(`/corrections/${id}`)
  },
}
