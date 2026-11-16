import { api } from './client'
import type { HealthEvent, NewAllergyInput, PrescriptionRecord, Kind, RecordStatus } from '../types'

export interface RecordFilters {
  kind?: Kind
  status?: RecordStatus | string
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export const recordsApi = {
  async getRecords(filters?: RecordFilters): Promise<HealthEvent[]> {
    const params = new URLSearchParams()
    if (filters?.kind) params.set('kind', filters.kind)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.fromDate) params.set('from_date', filters.fromDate)
    if (filters?.toDate) params.set('to_date', filters.toDate)
    if (filters?.limit) params.set('limit', String(filters.limit))
    if (filters?.offset) params.set('offset', String(filters.offset))

    const query = params.toString() ? `?${params.toString()}` : ''
    const res = await api.get<{ status: string; data: HealthEvent[] }>(`/records${query}`)
    return res.data
  },

  async getRecord(id: string): Promise<HealthEvent> {
    const res = await api.get<{ status: string; data: HealthEvent }>(`/records/${id}`)
    return res.data
  },

  async addAllergy(input: NewAllergyInput): Promise<HealthEvent> {
    const res = await api.post<{ status: string; data: HealthEvent }>('/records/allergies', input)
    return res.data
  },

  async addCondition(input: {
    conditionName: string
    status?: RecordStatus
    severity?: string
    onsetDate?: string
    resolvedDate?: string
    provider?: string
    notes?: string
  }): Promise<HealthEvent> {
    const res = await api.post<{ status: string; data: HealthEvent }>('/records/conditions', input)
    return res.data
  },

  async addMedication(input: {
    medicationName: string
    dosage?: string
    startDate?: string
    endDate?: string
    status?: RecordStatus
    provider?: string
    instructions?: string
  }): Promise<HealthEvent> {
    const res = await api.post<{ status: string; data: HealthEvent }>('/records/medications', input)
    return res.data
  },

  async addVaccination(input: {
    vaccineName: string
    doseNumber?: number
    administeredDate: string
    nextDueDate?: string
    batchNumber?: string
    provider?: string
    notes?: string
  }): Promise<HealthEvent> {
    const res = await api.post<{ status: string; data: HealthEvent }>('/records/vaccinations', input)
    return res.data
  },

  async addDiagnosticReport(input: {
    reportName: string
    reportType?: string
    reportDate?: string
    conclusion?: string
    provider?: string
  }): Promise<HealthEvent> {
    const res = await api.post<{ status: string; data: HealthEvent }>('/records/diagnostic-reports', input)
    return res.data
  },

  async getPrescriptions(): Promise<PrescriptionRecord[]> {
    const res = await api.get<{ status: string; data: PrescriptionRecord[] }>('/records/prescriptions')
    return res.data
  },

  async addPrescription(rx: Partial<PrescriptionRecord> & { title: string; doctor: string; date: string }): Promise<PrescriptionRecord> {
    const res = await api.post<{ status: string; data: PrescriptionRecord }>('/records/prescriptions', rx)
    return res.data
  },

  async removePrescription(id: string): Promise<void> {
    await api.delete(`/records/prescriptions/${id}`)
  },

  async retractRecord(id: string): Promise<void> {
    await api.delete(`/records/${id}`)
  },
}
