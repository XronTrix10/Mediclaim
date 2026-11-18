import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import { HealthDataContext } from './healthData'
import type { GiveAccessInput, HealthActions, HealthContextValue, HealthState } from './healthData'
import {
  initialPatientProfile,
  initialRequests,
  sampleEvents,
  seedAllergies,
  seedAudit,
  seedCaregivers,
  seedGrants,
} from '../data/mock'
import { kinds } from '../data/mock'
import { todayISO } from '../lib/format'
import type {
  AccessGrant,
  AuditLogEntry,
  HealthEvent,
  NewAllergyInput,
  PermittedPersonalDetailsUpdate,
  PrescriptionRecord,
  ProfileCompletionPayload,
  Caregiver,
} from '../types'
import type { BloodGroup, Gender } from '../types'
import {
  authApi,
  patientApi,
  recordsApi,
  consentApi,
  auditApi,
  correctionsApi,
} from '../api'
import { getStoredUser, setStoredUser } from '../api/client'

const STORAGE_KEY = 'mediclaim:v2'
const LEGACY = {
  complete: 'mediclaim_profile_complete',
  patient: 'mediclaim_patient_data',
  prescriptions: 'mediclaim_prescriptions',
  allergies: 'mediclaim_allergies',
}

const uid = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`

/* ---------- Persistence ---------- */

function seedState(now: number): HealthState {
  return {
    profile: initialPatientProfile,
    ownEvents: seedAllergies,
    prescriptions: [],
    sampleLoaded: false,
    grants: seedGrants(now),
    requests: initialRequests,
    caregivers: seedCaregivers,
    audit: seedAudit(now),
    corrections: [],
  }
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Blob URLs die with the page, so they are never written to storage. */
function serialize(state: HealthState): HealthState {
  return {
    ...state,
    prescriptions: state.prescriptions.map((rx) =>
      rx.fileUrl?.startsWith('blob:') ? { ...rx, fileUrl: undefined } : rx,
    ),
  }
}

function loadInitial(): HealthState {
  const now = Date.now()
  const curUser = getStoredUser()
  const saved = readJSON<HealthState>(STORAGE_KEY)

  // If saved state matches the authenticated user, restore it
  if (saved?.profile) {
    const isSameUser = !curUser ||
      saved.profile.userId === curUser.id ||
      saved.profile.mediclaimId?.replace(/\s/g, '') === curUser.mediclaimId?.replace(/\s/g, '')

    if (isSameUser) {
      if (curUser?.isProfileComplete) {
        saved.profile.isProfileComplete = true
      }
      return { ...seedState(now), ...saved }
    }
  }

  // Fresh state for the current authenticated user
  const state = seedState(now)
  if (curUser) {
    state.profile = {
      ...state.profile,
      userId: curUser.id,
      fullName: curUser.fullName,
      firstName: curUser.fullName.split(' ')[0],
      phone: curUser.phone,
      mediclaimId: curUser.mediclaimId || state.profile.mediclaimId,
      isProfileComplete: Boolean(curUser.isProfileComplete),
    }
    return state
  }
  const legacyProfile = readJSON<HealthState['profile']>(LEGACY.patient)
  const legacyRx = readJSON<PrescriptionRecord[]>(LEGACY.prescriptions)
  const legacyAllergies = readJSON<
    {
      id: string
      title: string
      allergen: string
      category: HealthEvent['category']
      severity: HealthEvent['severity']
      criticality: HealthEvent['criticality']
      reaction: string
      status: HealthEvent['status']
      identifiedDate: string
      provider: string
      notes?: string
    }[]
  >(LEGACY.allergies)
  if (legacyProfile) state.profile = { ...legacyProfile, isProfileComplete: legacyProfile.isProfileComplete ?? false }
  else if (localStorage.getItem(LEGACY.complete) === 'true') state.profile = { ...state.profile, isProfileComplete: true }
  if (legacyRx) state.prescriptions = legacyRx.map((rx) => ({ ...rx, fileUrl: undefined }))
  if (legacyAllergies) {
    state.ownEvents = legacyAllergies.map((a) => ({
      id: a.id,
      kind: 'allergy',
      title: a.title,
      detail: a.notes ?? a.reaction,
      date: a.identifiedDate,
      provider: a.provider,
      status: a.status,
      category: a.category,
      severity: a.severity,
      criticality: a.criticality,
      reaction: a.reaction,
      notes: a.notes,
    }))
  }
  return state
}

/* ---------- Reducer ---------- */

type Action =
  | { type: 'state/hydrated'; payload: Partial<HealthState> }
  | { type: 'profile/hydrated'; profile: HealthState['profile'] }
  | { type: 'profile/complete'; payload: ProfileCompletionPayload; now: number }
  | { type: 'profile/update'; update: PermittedPersonalDetailsUpdate; now: number }
  | { type: 'allergy/add'; input: NewAllergyInput; id: string; now: number }
  | { type: 'rx/add'; rx: PrescriptionRecord; now: number }
  | { type: 'rx/remove'; id: string }
  | { type: 'sample/toggle' }
  | { type: 'grant/revoke'; id: string; now: number }
  | { type: 'grant/expire'; now: number }
  | { type: 'grant/give'; grant: AccessGrant; now: number }
  | { type: 'request/approve'; id: string; grantId: string; now: number }
  | { type: 'request/decline'; id: string; now: number }
  | { type: 'caregiver/add'; caregiver: Caregiver; now: number }
  | { type: 'caregiver/remove'; id: string; now: number }
  | { type: 'correction/add'; id: string; recordId: string; recordTitle: string; reason: string; proposed?: string; now: number }

function log(state: HealthState, now: number, who: string, what: string, action: AuditLogEntry['action']): AuditLogEntry[] {
  return [{ id: uid('l'), who, what, at: new Date(now).toISOString(), action }, ...state.audit]
}

function scopeLabel(scope: AccessGrant['scope']) {
  return scope.map((k) => kinds[k].plural.toLowerCase()).join(', ')
}

function reducer(state: HealthState, action: Action): HealthState {
  switch (action.type) {
    case 'state/hydrated':
      return { ...state, ...action.payload }

    case 'profile/hydrated':
      return { ...state, profile: action.profile }

    case 'profile/complete': {
      const p = action.payload
      return {
        ...state,
        profile: {
          ...state.profile,
          gender: p.gender as Gender,
          bloodGroup: p.bloodGroup as BloodGroup,
          address: p.address.trim(),
          emergencyContact: { name: p.emergencyName.trim(), phone: p.emergencyPhone.trim(), relation: p.emergencyRelation },
          isProfileComplete: true,
          updatedAt: new Date(action.now).toISOString(),
        },
      }
    }
    case 'profile/update':
      return {
        ...state,
        profile: {
          ...state.profile,
          phone: action.update.phone ?? state.profile.phone,
          address: action.update.address ?? state.profile.address,
          emergencyContact: action.update.emergencyContact ?? state.profile.emergencyContact,
          updatedAt: new Date(action.now).toISOString(),
        },
      }
    case 'allergy/add': {
      const i = action.input
      const event: HealthEvent = {
        id: action.id,
        kind: 'allergy',
        title: i.allergen.trim(),
        detail: i.notes?.trim() || i.reaction.trim(),
        date: todayISO(new Date(action.now)),
        provider: i.provider.trim() || 'Self reported',
        status: 'active',
        source: 'self_reported',
        category: i.category,
        severity: i.severity,
        criticality: i.criticality,
        reaction: i.reaction.trim(),
        notes: i.notes?.trim() || undefined,
      }
      return {
        ...state,
        ownEvents: [event, ...state.ownEvents],
        audit: log(state, action.now, 'You', `recorded an allergy to ${event.title}`, 'upload'),
      }
    }
    case 'rx/add':
      return {
        ...state,
        prescriptions: [action.rx, ...state.prescriptions],
        audit: log(state, action.now, 'You', `uploaded ${action.rx.title}`, 'upload'),
      }
    case 'rx/remove':
      return { ...state, prescriptions: state.prescriptions.filter((rx) => rx.id !== action.id) }
    case 'sample/toggle':
      return { ...state, sampleLoaded: !state.sampleLoaded }
    case 'grant/revoke': {
      const g = state.grants.find((x) => x.id === action.id)
      if (!g) return state
      return {
        ...state,
        grants: state.grants.filter((x) => x.id !== action.id),
        audit: log(state, action.now, 'You', `revoked access for ${g.name}`, 'revoke'),
      }
    }
    case 'grant/expire': {
      const expired = state.grants.filter((g) => Date.parse(g.expiresAt) <= action.now)
      if (expired.length === 0) return state
      let audit = state.audit
      for (const g of expired) {
        audit = [{ id: uid('l'), who: g.name, what: 'access ended automatically', at: g.expiresAt, action: 'revoke' as const }, ...audit]
      }
      return { ...state, grants: state.grants.filter((g) => Date.parse(g.expiresAt) > action.now), audit }
    }
    case 'grant/give':
      return {
        ...state,
        grants: [...state.grants, action.grant],
        audit: log(state, action.now, 'You', `gave ${action.grant.name} access to ${scopeLabel(action.grant.scope)}`, 'grant'),
      }
    case 'request/approve': {
      const req = state.requests.find((r) => r.id === action.id)
      if (!req) return state
      const grant: AccessGrant = {
        id: action.grantId,
        name: req.name,
        role: req.role,
        scope: req.scope,
        validFrom: new Date(action.now).toISOString(),
        expiresAt: new Date(action.now + req.durationHours * 3_600_000).toISOString(),
      }
      return {
        ...state,
        requests: state.requests.filter((r) => r.id !== action.id),
        grants: [...state.grants, grant],
        audit: log(state, action.now, 'You', `approved access for ${req.name}`, 'approve'),
      }
    }
    case 'request/decline': {
      const req = state.requests.find((r) => r.id === action.id)
      if (!req) return state
      return {
        ...state,
        requests: state.requests.filter((r) => r.id !== action.id),
        audit: log(state, action.now, 'You', `declined the request from ${req.name}`, 'revoke'),
      }
    }
    case 'caregiver/add':
      return {
        ...state,
        caregivers: [...state.caregivers, action.caregiver],
        audit: log(state, action.now, 'You', `added ${action.caregiver.name} as a caregiver`, 'grant'),
      }
    case 'caregiver/remove': {
      const c = state.caregivers.find((x) => x.id === action.id)
      if (!c) return state
      return {
        ...state,
        caregivers: state.caregivers.filter((x) => x.id !== action.id),
        audit: log(state, action.now, 'You', `removed ${c.name} as a caregiver`, 'revoke'),
      }
    }
    case 'correction/add':
      return {
        ...state,
        corrections: [
          {
            id: action.id,
            recordId: action.recordId,
            recordTitle: action.recordTitle,
            reason: action.reason,
            proposed: action.proposed,
            status: 'under_review',
            createdAt: new Date(action.now).toISOString(),
          },
          ...state.corrections,
        ],
        audit: log(state, action.now, 'You', `requested a correction to ${action.recordTitle}`, 'correction'),
      }
  }
}

/* ---------- Provider ---------- */

function toPrescriptionEvent(rx: PrescriptionRecord): HealthEvent {
  return {
    id: `ev-${rx.id}`,
    kind: 'medication',
    title: rx.title,
    detail: `Prescribed by ${rx.doctor}${rx.organization ? `, ${rx.organization}` : ''}. Attached: ${rx.fileName}${rx.fileSize ? ` (${rx.fileSize})` : ''}.`,
    date: rx.date,
    provider: rx.organization ? `${rx.doctor}, ${rx.organization}` : rx.doctor,
    status: rx.status ?? 'active',
    source: 'uploaded',
    prescriptionId: rx.id,
    fileType: rx.fileType,
    fileName: rx.fileName,
  }
}

export default function HealthDataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial)
  const stateRef = useRef(state)
  stateRef.current = state

  // Save to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(state)))
    } catch {
      // Storage can be full or blocked
    }
  }, [state])

  // Hydrate data from API if user is authenticated
  useEffect(() => {
    if (!authApi.isAuthenticated()) return

    let isMounted = true

    async function syncFromBackend() {
      try {
        const [
          profileRes,
          recordsRes,
          prescriptionsRes,
          grantsRes,
          requestsRes,
          caregiversRes,
          auditRes,
          correctionsRes,
        ] = await Promise.allSettled([
          patientApi.getProfile(),
          recordsApi.getRecords(),
          recordsApi.getPrescriptions(),
          consentApi.getGrants(),
          consentApi.getRequests(),
          consentApi.getCaregivers(),
          auditApi.getAuditLogs(),
          correctionsApi.getCorrections(),
        ])

        if (!isMounted) return

        const patch: Partial<HealthState> = {}

        if (profileRes.status === 'fulfilled' && profileRes.value) {
          const p = profileRes.value
          patch.profile = {
            ...p,
            gender: (p.gender || '') as Gender,
            bloodGroup: (p.bloodGroup || '') as BloodGroup,
            address: p.address || '',
            emergencyContact: p.emergencyContact || {
              name: '',
              phone: '',
              relation: 'Parent',
            },
            isProfileComplete: Boolean(p.isProfileComplete),
          }
        }

        if (recordsRes.status === 'fulfilled' && recordsRes.value) {
          patch.ownEvents = recordsRes.value
        }

        if (prescriptionsRes.status === 'fulfilled' && prescriptionsRes.value) {
          patch.prescriptions = prescriptionsRes.value
        }

        if (grantsRes.status === 'fulfilled' && grantsRes.value) {
          patch.grants = grantsRes.value
        }

        if (requestsRes.status === 'fulfilled' && requestsRes.value) {
          patch.requests = requestsRes.value
        }

        if (caregiversRes.status === 'fulfilled' && caregiversRes.value) {
          patch.caregivers = caregiversRes.value
        }

        if (auditRes.status === 'fulfilled' && auditRes.value && auditRes.value.length > 0) {
          patch.audit = auditRes.value
        }

        if (correctionsRes.status === 'fulfilled' && correctionsRes.value) {
          patch.corrections = correctionsRes.value
        }

        if (Object.keys(patch).length > 0) {
          dispatch({ type: 'state/hydrated', payload: patch })
        }
      } catch {
        // Fallback silently to offline/stored state
      }
    }

    syncFromBackend()

    return () => {
      isMounted = false
    }
  }, [])

  // End each access grant the moment its time is up
  const nextExpiry = useMemo(
    () => state.grants.reduce((min, g) => Math.min(min, Date.parse(g.expiresAt)), Infinity),
    [state.grants],
  )
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return
    const wait = Math.min(Math.max(nextExpiry - Date.now(), 0) + 250, 2 ** 31 - 1)
    const id = setTimeout(() => dispatch({ type: 'grant/expire', now: Date.now() }), wait)
    return () => clearTimeout(id)
  }, [nextExpiry])

  const actions = useMemo<HealthActions>(
    () => ({
      completeProfile: async (payload) => {
        if (authApi.isAuthenticated()) {
          const updated = await patientApi.completeProfile(payload)
          dispatch({
            type: 'profile/hydrated',
            profile: {
              ...updated,
              gender: (updated.gender || payload.gender) as Gender,
              bloodGroup: (updated.bloodGroup || payload.bloodGroup) as BloodGroup,
              address: updated.address || payload.address,
              emergencyContact: updated.emergencyContact || {
                name: payload.emergencyName,
                phone: payload.emergencyPhone,
                relation: payload.emergencyRelation,
              },
              isProfileComplete: true,
            },
          })
          const curUser = authApi.getCurrentUser()
          if (curUser) {
            setStoredUser({ ...curUser, isProfileComplete: true })
          }
        } else {
          dispatch({ type: 'profile/complete', payload, now: Date.now() })
        }
      },

      updatePermittedDetails: async (update) => {
        if (authApi.isAuthenticated()) {
          try {
            const updated = await patientApi.updatePermittedDetails(update)
            dispatch({
              type: 'profile/hydrated',
              profile: {
                ...updated,
                gender: (updated.gender || '') as Gender,
                bloodGroup: (updated.bloodGroup || '') as BloodGroup,
                address: updated.address || (update.address ?? ''),
                emergencyContact: updated.emergencyContact || update.emergencyContact || {
                  name: '',
                  phone: '',
                  relation: 'Parent',
                },
                isProfileComplete: updated.isProfileComplete ?? true,
              },
            })
          } catch (e) {
            console.warn('Backend update permitted details sync failed:', e)
            dispatch({ type: 'profile/update', update, now: Date.now() })
          }
        } else {
          dispatch({ type: 'profile/update', update, now: Date.now() })
        }
      },

      addAllergy: async (input) => {
        const eventId = uid('alg')
        dispatch({ type: 'allergy/add', input, id: eventId, now: Date.now() })
        if (authApi.isAuthenticated()) {
          try {
            await recordsApi.addAllergy(input)
          } catch (e) {
            console.warn('Backend add allergy sync failed:', e)
          }
        }
      },

      addPrescription: async (rx) => {
        const rxId = uid('rx')
        const fullRx: PrescriptionRecord = { ...rx, id: rxId }
        dispatch({ type: 'rx/add', rx: fullRx, now: Date.now() })
        if (authApi.isAuthenticated()) {
          try {
            await recordsApi.addPrescription(fullRx)
          } catch (e) {
            console.warn('Backend add prescription sync failed:', e)
          }
        }
      },

      removePrescription: async (id) => {
        dispatch({ type: 'rx/remove', id })
        if (authApi.isAuthenticated()) {
          try {
            await recordsApi.removePrescription(id)
          } catch (e) {
            console.warn('Backend remove prescription sync failed:', e)
          }
        }
      },

      toggleSample: () => dispatch({ type: 'sample/toggle' }),

      revokeGrant: async (id) => {
        dispatch({ type: 'grant/revoke', id, now: Date.now() })
        if (authApi.isAuthenticated()) {
          try {
            await consentApi.revokeGrant(id)
          } catch (e) {
            console.warn('Backend revoke grant sync failed:', e)
          }
        }
      },

      giveAccess: (input: GiveAccessInput) => {
        const now = Date.now()
        const grant: AccessGrant = {
          id: uid('g'),
          name: input.name,
          role: input.role ?? 'Added by ID',
          scope: input.scope,
          validFrom: new Date(now).toISOString(),
          expiresAt: new Date(now + input.hours * 3_600_000).toISOString(),
        }
        dispatch({ type: 'grant/give', grant, now })
        if (authApi.isAuthenticated()) {
          consentApi.giveAccess(input).catch((e) => console.warn('Backend give access sync failed:', e))
        }
        return grant
      },

      approveRequest: async (id) => {
        const now = Date.now()
        const req = stateRef.current.requests.find((r) => r.id === id)
        const grantId = uid('g')
        dispatch({ type: 'request/approve', id, grantId, now })
        if (authApi.isAuthenticated() && req) {
          try {
            await consentApi.approveRequest(id, req.scope, req.durationHours)
          } catch (e) {
            console.warn('Backend approve request sync failed:', e)
          }
        }
      },

      declineRequest: async (id) => {
        dispatch({ type: 'request/decline', id, now: Date.now() })
        if (authApi.isAuthenticated()) {
          try {
            await consentApi.declineRequest(id)
          } catch (e) {
            console.warn('Backend decline request sync failed:', e)
          }
        }
      },

      addCaregiver: async (input) => {
        const caregiverId = uid('c')
        const fullCaregiver: Caregiver = { ...input, id: caregiverId, since: todayISO() }
        dispatch({ type: 'caregiver/add', caregiver: fullCaregiver, now: Date.now() })
        if (authApi.isAuthenticated()) {
          try {
            await consentApi.addCaregiver(input)
          } catch (e) {
            console.warn('Backend add caregiver sync failed:', e)
          }
        }
      },

      removeCaregiver: async (id) => {
        dispatch({ type: 'caregiver/remove', id, now: Date.now() })
        if (authApi.isAuthenticated()) {
          try {
            await consentApi.removeCaregiver(id)
          } catch (e) {
            console.warn('Backend remove caregiver sync failed:', e)
          }
        }
      },

      requestCorrection: async (input) => {
        const corrId = uid('corr')
        dispatch({ type: 'correction/add', id: corrId, now: Date.now(), ...input })
        if (authApi.isAuthenticated()) {
          try {
            await correctionsApi.requestCorrection(input)
          } catch (e) {
            console.warn('Backend request correction sync failed:', e)
          }
        }
      },
    }),
    [],
  )

  const value = useMemo<HealthContextValue>(() => {
    const events = [
      ...state.ownEvents,
      ...state.prescriptions.map(toPrescriptionEvent),
      ...(state.sampleLoaded ? sampleEvents : []),
    ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    return { ...state, events, actions }
  }, [state, actions])

  return <HealthDataContext.Provider value={value}>{children}</HealthDataContext.Provider>
}
