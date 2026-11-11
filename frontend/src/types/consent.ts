import type { Kind } from './record'

export interface AccessGrant {
  id: string
  name: string
  role: string
  scope: Kind[]
  remaining: string
  validFrom?: string
  expiresAt?: string
  status?: 'active' | 'expired' | 'revoked'
}

export interface AccessRequest {
  id: string
  name: string
  role: string
  scope: Kind[]
  duration: string
  requestedAt?: string
}

export interface Caregiver {
  id: string
  name: string
  relation: string
  scope: string
  since: string
}

export interface AuditLogEntry {
  id: string
  who: string
  what: string
  when: string
  action?: 'view' | 'upload' | 'revoke' | 'approve' | 'emergency'
}

