import { api } from './client'
import type { HealthEvent } from '../types'

export interface TimelineResponse {
  events: (HealthEvent & { ageAtEventMonths?: number })[]
  total: number
}

export interface GraphNode {
  id: string
  label: string
  kind: string
  date: string
  status?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label?: string
  relationType?: string
}

export interface HealthGraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const timelineApi = {
  async getTimeline(params?: { fromDate?: string; toDate?: string }): Promise<TimelineResponse> {
    const q = new URLSearchParams()
    if (params?.fromDate) q.set('from_date', params.fromDate)
    if (params?.toDate) q.set('to_date', params.toDate)
    const query = q.toString() ? `?${q.toString()}` : ''
    const res = await api.get<{ status: string; data: TimelineResponse }>(`/timeline${query}`)
    return res.data
  },

  async getHealthGraph(): Promise<HealthGraphResponse> {
    const res = await api.get<{ status: string; data: HealthGraphResponse }>('/timeline/graph')
    return res.data
  },
}
