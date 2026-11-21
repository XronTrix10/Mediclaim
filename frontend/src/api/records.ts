import { api } from './client'
import type {
  HealthEvent,
  NewAllergyInput,
  NewConditionInput,
  NewMedicationInput,
  NewVaccinationInput,
  NewReportInput,
  PrescriptionRecord,
  Kind,
  RecordStatus,
} from '../types'

export interface RecordFilters {
  kind?: Kind
  status?: RecordStatus | string
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export interface ParsedMedicationItem {
  name: string
  dosage?: string
  frequency?: string
  duration?: string
  instructions?: string
}

export interface ParsedLabResultItem {
  testName: string
  resultValue?: string
  unit?: string
  referenceRange?: string
  interpretation?: string
}

export interface ParsedDocumentPayload {
  documentType: 'prescription' | 'vaccination' | 'lab_report' | 'discharge_summary' | 'allergy_note' | 'other'
  title?: string
  documentDate?: string
  provider?: string
  organization?: string
  confidence: number
  prescriptions: Array<{
    title: string
    doctor: string
    organization?: string
    date?: string
    instructions?: string
    medications: ParsedMedicationItem[]
  }>
  vaccinations: Array<{
    vaccineName: string
    doseNumber?: number
    administeredDate?: string
    nextDueDate?: string
    batchNumber?: string
    provider?: string
    notes?: string
  }>
  allergies: Array<{
    allergen: string
    category?: string
    severity?: string
    criticality?: string
    reaction: string
    provider?: string
    identifiedDate?: string
    notes?: string
  }>
  conditions: Array<{
    conditionName: string
    status?: string
    severity?: string
    onsetDate?: string
    resolvedDate?: string
    provider?: string
    notes?: string
  }>
  medications: Array<{
    medicationName: string
    dosage?: string
    startDate?: string
    endDate?: string
    status?: string
    provider?: string
    instructions?: string
  }>
  reports: Array<{
    reportName: string
    reportType?: string
    reportDate?: string
    conclusion?: string
    provider?: string
    labResults: ParsedLabResultItem[]
  }>
  warnings: string[]
}

export interface UploadParseResponse {
  uploadId: string
  documentId: string
  fileName: string
  fileType: 'pdf' | 'image'
  fileSizeBytes: number
  fileUrl: string
  ocrStatus: 'pending' | 'processing' | 'needs_review' | 'completed' | 'failed'
  parserProvider?: string
  confidence?: number
  extractedData?: ParsedDocumentPayload | null
  failureMessage?: string
  parseError?: string
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

  async addCondition(input: NewConditionInput): Promise<HealthEvent> {
    const res = await api.post<{ status: string; data: HealthEvent }>('/records/conditions', input)
    return res.data
  },

  async addMedication(input: NewMedicationInput): Promise<HealthEvent> {
    const res = await api.post<{ status: string; data: HealthEvent }>('/records/medications', input)
    return res.data
  },

  async addVaccination(input: NewVaccinationInput): Promise<HealthEvent> {
    const res = await api.post<{ status: string; data: HealthEvent }>('/records/vaccinations', input)
    return res.data
  },

  async addDiagnosticReport(input: NewReportInput): Promise<HealthEvent> {
    const res = await api.post<{ status: string; data: HealthEvent }>('/records/reports', input)
    return res.data
  },

  async addReport(input: NewReportInput): Promise<HealthEvent> {
    return this.addDiagnosticReport(input)
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

  async uploadAndParseDocument(
    file: File,
    options?: {
      title?: string
      doctor?: string
      organization?: string
      consultationDate?: string
      documentType?: string
    },
  ): Promise<UploadParseResponse> {
    const form = new FormData()
    form.append('file', file)
    if (options?.title) form.append('title', options.title)
    if (options?.doctor) form.append('doctor', options.doctor)
    if (options?.organization) form.append('organization', options.organization)
    if (options?.consultationDate) form.append('consultationDate', options.consultationDate)
    if (options?.documentType) form.append('documentType', options.documentType)
    form.append('autoParse', 'true')

    const res = await api.post<{ status: string; data: UploadParseResponse }>('/uploads', form)
    return res.data
  },

  async getDocumentParseStatus(documentId: string): Promise<UploadParseResponse> {
    const res = await api.get<{ status: string; data: UploadParseResponse }>(`/documents/${documentId}/parse-status`)
    return res.data
  },

  async commitParsedDocument(
    documentId: string,
    payload: ParsedDocumentPayload,
  ): Promise<{ documentId: string; fileUrl: string; ocrStatus: string; createdCount: number; createdRecords: Record<string, unknown[]> }> {
    const res = await api.post<{
      status: string
      data: { documentId: string; fileUrl: string; ocrStatus: string; createdCount: number; createdRecords: Record<string, unknown[]> }
    }>(`/documents/${documentId}/commit`, { payload })
    return res.data
  },
}
