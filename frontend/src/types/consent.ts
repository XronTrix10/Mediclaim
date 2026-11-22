import type { Kind } from './record'

export interface AccessGrant {
  id: string
  grantId?: string
  name: string
  role: string
  scope: Kind[]
  /** ISO 8601 UTC. The remaining time is always computed from this. */
  expiresAt: string
  validFrom?: string
  grantStatus?: 'active' | 'expired' | 'revoked' | string
}

export interface AccessRequest {
  id: string
  name: string
  role: string
  scope: Kind[]
  durationHours: number
  purpose?: string
  requestedAt?: string
}

export interface Caregiver {
  id: string
  name: string
  relation: string
  scope: Kind[]
  /** YYYY-MM-DD */
  since: string
}

export interface AuditLogEntry {
  id: string
  who: string
  what: string
  /** ISO 8601 UTC */
  at: string
  action?: 'view' | 'upload' | 'revoke' | 'approve' | 'grant' | 'correction' | 'emergency'
}
