export type Kind = 'allergy' | 'condition' | 'medication' | 'vaccination' | 'report'

export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'life-threatening'
export type AllergyCriticality = 'low' | 'high' | 'unable-to-assess'
export type AllergyCategory = 'food' | 'medication' | 'environment' | 'biologic'
export type RecordStatus = 'active' | 'resolved' | 'inactive' | 'completed' | 'discontinued'

/** Who entered the record. Self-reported and uploaded records are not clinician-verified. */
export type RecordSource = 'self_reported' | 'uploaded' | 'practitioner'

export interface HealthEvent {
  id: string
  kind: Kind
  title: string
  /** Short label used inside graphs */
  short?: string
  detail: string
  date: string
  provider: string
  status?: RecordStatus
  source?: RecordSource
  // Birth milestone metadata
  isBirthRecord?: boolean
  hasCertificate?: boolean
  missingRecordHint?: string
  // Allergy details
  severity?: AllergySeverity
  criticality?: AllergyCriticality
  category?: AllergyCategory
  reaction?: string
  notes?: string
  // Attached document (any uploaded record or prescription)
  prescriptionId?: string
  documentId?: string
  fileType?: 'pdf' | 'image'
  fileName?: string
  fileSizeBytes?: number
  fileUrl?: string
  // Specific fields for other record kinds
  vaccineName?: string
  doseNumber?: number
  batchNumber?: string
  administeredDate?: string
  nextDueDate?: string
  conditionName?: string
  onsetDate?: string
  resolvedDate?: string
  medicationName?: string
  dosage?: string
  instructions?: string
  startDate?: string
  endDate?: string
  reportName?: string
  reportType?: string
  reportDate?: string
  conclusion?: string
}

export interface NewAllergyInput {
  allergen: string
  category: AllergyCategory
  severity: AllergySeverity
  criticality: AllergyCriticality
  reaction: string
  provider: string
  notes?: string
}

export interface NewConditionInput {
  conditionName: string
  status?: RecordStatus
  severity?: string
  onsetDate?: string
  resolvedDate?: string
  provider?: string
  notes?: string
}

export interface NewMedicationInput {
  medicationName: string
  dosage?: string
  startDate?: string
  endDate?: string
  status?: RecordStatus
  provider?: string
  instructions?: string
}

export interface NewVaccinationInput {
  vaccineName: string
  doseNumber?: number
  administeredDate?: string
  nextDueDate?: string
  batchNumber?: string
  provider?: string
  notes?: string
}

export interface NewReportInput {
  reportName: string
  reportType?: string
  reportDate?: string
  conclusion?: string
  provider?: string
}

export interface PrescriptionRecord {
  id: string
  kind?: 'medication'
  title: string
  doctor: string
  organization?: string
  date: string
  status?: RecordStatus
  fileType: 'pdf' | 'image'
  fileName: string
  fileSize?: string
  /** Authenticated backend URL (/api/v1/documents/doc_.../content) or session blob URL. */
  fileUrl?: string
  instructions?: string
  medications?: {
    name: string
    dosage: string
    frequency: string
    duration: string
  }[]
}

export interface CorrectionRequest {
  id: string
  recordId: string
  recordTitle: string
  reason: string
  proposed?: string
  status: 'under_review'
  createdAt: string
}
