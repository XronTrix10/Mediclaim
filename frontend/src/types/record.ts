export type Kind = 'allergy' | 'condition' | 'medication' | 'vaccination' | 'report'

export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'life-threatening'
export type AllergyCriticality = 'low' | 'high' | 'unable-to-assess'
export type AllergyCategory = 'food' | 'medication' | 'environment' | 'biologic'
export type RecordStatus = 'active' | 'resolved' | 'inactive' | 'completed' | 'discontinued'

export interface AllergyRecord {
  id: string
  kind: 'allergy'
  title: string
  allergen: string
  category: AllergyCategory
  severity: AllergySeverity
  criticality: AllergyCriticality
  reaction: string
  status: RecordStatus
  identifiedDate: string
  provider: string
  notes?: string
}

export interface ConditionRecord {
  id: string
  kind: 'condition'
  title: string
  conditionName: string
  clinicalCode?: string
  severity?: string
  status: RecordStatus
  onsetDate: string
  resolvedDate?: string
  provider: string
  notes?: string
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
  fileUrl?: string
  instructions?: string
  medications?: {
    name: string
    dosage: string
    frequency: string
    duration: string
  }[]
}

export interface VaccinationRecord {
  id: string
  kind: 'vaccination'
  title: string
  vaccineName: string
  doseNumber: number
  administeredDate: string
  nextDueDate?: string
  batchNumber?: string
  provider: string
  notes?: string
}

export interface DiagnosticReportRecord {
  id: string
  kind: 'report'
  title: string
  reportType?: string
  date: string
  provider: string
  detail: string
  fileUrl?: string
}

export interface HealthEvent {
  id: string
  kind: Kind
  title: string
  short?: string
  detail: string
  date: string
  provider: string
  status?: RecordStatus
  severity?: AllergySeverity
  reaction?: string
  fileType?: 'pdf' | 'image'
  fileName?: string
}
