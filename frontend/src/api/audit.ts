import { api } from './client'
import type { AuditLogEntry } from '../types'

export const auditApi = {
  async getAuditLogs(params?: { limit?: number; offset?: number; action?: string }): Promise<AuditLogEntry[]> {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    if (params?.action) q.set('action', params.action)
    const query = q.toString() ? `?${q.toString()}` : ''
    const res = await api.get<{ status: string; data: any[] }>(`/audit${query}`)
    return (res.data || []).map((entry) => ({
      id: entry.id,
      who: entry.who,
      what: entry.what,
      at: entry.occurredAt || entry.at,
      action: entry.action,
    }))
  },
}
