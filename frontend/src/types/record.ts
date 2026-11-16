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
  // Allergy details
  severity?: AllergySeverity
  criticality?: AllergyCriticality
  category?: AllergyCategory
  reaction?: string
  notes?: string
  // Attached document (prescriptions)
  prescriptionId?: string
  fileType?: 'pdf' | 'image'
  fileName?: string
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
  /** In-memory blob URL for this session only. Never persisted. */
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
