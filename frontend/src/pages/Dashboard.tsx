import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import { button } from '../lib/ui'
import {
  StatsSummary,
  ProfileCompletionModal,
  PatientSummaryCard,
  AllergiesSection,
  PrescriptionsSection,
  TimelineSection,
  ActiveAccessCard,
} from '../components/dashboard'
import {
  initialPatientProfile,
  initialAllergies,
  initialGrants,
  events as demoEvents,
} from '../data/mock'
import type {
  PatientProfile,
  ProfileCompletionPayload,
  PermittedPersonalDetailsUpdate,
  AllergyRecord,
  PrescriptionRecord,
  HealthEvent,
  AccessGrant,
} from '../types'

const PROFILE_STORAGE_KEY = 'mediclaim_profile_complete'
const PATIENT_DATA_KEY = 'mediclaim_patient_data'
const PRESCRIPTIONS_KEY = 'mediclaim_prescriptions'
const ALLERGIES_KEY = 'mediclaim_allergies'

export default function Dashboard() {
  // Check if profile was already completed
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(() => {
    return localStorage.getItem(PROFILE_STORAGE_KEY) === 'true'
  })

  // Patient profile data
  const [profile, setProfile] = useState<PatientProfile>(() => {
    const saved = localStorage.getItem(PATIENT_DATA_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return {
      ...initialPatientProfile,
      isProfileComplete: localStorage.getItem(PROFILE_STORAGE_KEY) === 'true',
    }
  })

  // Prescriptions: Initially empty as specified in requirements
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>(() => {
    const saved = localStorage.getItem(PRESCRIPTIONS_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return []
  })

  // Allergies: Initial allergies list with rich medical properties
  const [allergies, setAllergies] = useState<AllergyRecord[]>(() => {
    const saved = localStorage.getItem(ALLERGIES_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return initialAllergies
  })

  // Timeline: Initially empty on the right as specified in requirements
  const [timelineEvents, setTimelineEvents] = useState<HealthEvent[]>([])
  const [isDemoTimelineLoaded, setIsDemoTimelineLoaded] = useState(false)

  // Doctor access grants
  const [grants, setGrants] = useState<AccessGrant[]>(initialGrants)

  // Persist prescriptions
  useEffect(() => {
    localStorage.setItem(PRESCRIPTIONS_KEY, JSON.stringify(prescriptions))
  }, [prescriptions])

  // Persist allergies
  useEffect(() => {
    localStorage.setItem(ALLERGIES_KEY, JSON.stringify(allergies))
  }, [allergies])

  // Profile completion handler
  const handleProfileComplete = (payload: ProfileCompletionPayload) => {
    const updatedProfile: PatientProfile = {
      ...profile,
      gender: payload.gender as PatientProfile['gender'],
      bloodGroup: payload.bloodGroup as PatientProfile['bloodGroup'],
      address: payload.address,
      emergencyContact: {
        name: payload.emergencyName,
        phone: payload.emergencyPhone,
        relation: payload.emergencyRelation,
      },
      isProfileComplete: true,
      updatedAt: new Date().toISOString(),
    }

    setProfile(updatedProfile)
    setIsProfileComplete(true)
    localStorage.setItem(PROFILE_STORAGE_KEY, 'true')
    localStorage.setItem(PATIENT_DATA_KEY, JSON.stringify(updatedProfile))
  }

  // Update permitted personal details (phone, address, emergency contact)
  const handleUpdatePermittedDetails = (update: PermittedPersonalDetailsUpdate) => {
    const updated: PatientProfile = {
      ...profile,
      phone: update.phone ?? profile.phone,
      address: update.address ?? profile.address,
      emergencyContact: update.emergencyContact ?? profile.emergencyContact,
      updatedAt: new Date().toISOString(),
    }
    setProfile(updated)
    localStorage.setItem(PATIENT_DATA_KEY, JSON.stringify(updated))
  }

  // Prescription upload handler
  const handleUploadPrescription = (newRx: PrescriptionRecord) => {
    setPrescriptions((prev) => [newRx, ...prev])

    // Also map to timeline event
    const newTimelineEvent: HealthEvent = {
      id: `ev-${newRx.id}`,
      kind: 'medication',
      title: newRx.title,
      detail: `Prescribed by ${newRx.doctor}. Attached: ${newRx.fileName} (${newRx.fileSize || 'Document'})`,
      date: newRx.date,
      provider: newRx.doctor,
      status: 'active',
      fileType: newRx.fileType,
      fileName: newRx.fileName,
    }
    setTimelineEvents((prev) => [newTimelineEvent, ...prev])
  }

  const handleDeletePrescription = (id: string) => {
    setPrescriptions((prev) => prev.filter((p) => p.id !== id))
  }

  // Add allergy handler
  const handleAddAllergy = (newAllergy: AllergyRecord) => {
    setAllergies((prev) => [newAllergy, ...prev])

    // Also map to timeline event
    const newTimelineEvent: HealthEvent = {
      id: `ev-${newAllergy.id}`,
      kind: 'allergy',
      title: `${newAllergy.allergen} Allergy`,
      detail: `${newAllergy.reaction} (${newAllergy.severity} severity)`,
      date: newAllergy.identifiedDate,
      provider: newAllergy.provider,
      status: 'active',
      severity: newAllergy.severity,
      reaction: newAllergy.reaction,
    }
    setTimelineEvents((prev) => [newTimelineEvent, ...prev])
  }

  // Toggle demo timeline events
  const handleToggleDemoData = () => {
    if (isDemoTimelineLoaded) {
      setTimelineEvents([])
      setIsDemoTimelineLoaded(false)
    } else {
      setTimelineEvents(demoEvents)
      setIsDemoTimelineLoaded(true)
    }
  }

  const handleRevokeGrant = (grantId: string) => {
    setGrants((prev) => prev.filter((g) => g.id !== grantId))
  }

  return (
    <>
      {/* Mandatory Profile Completion Modal on first visit */}
      {!isProfileComplete && (
        <ProfileCompletionModal
          initialName={profile.firstName}
          onComplete={handleProfileComplete}
        />
      )}

      {/* Page Header */}
      <PageHeader
        title={`Welcome back, ${profile.firstName}`}
        subtitle="Lifelong Health Record Management · HL7 FHIR Standard"
      >
        <Link className={button('ghost')} to="/app/records">
          <Icon name="download" size={17} />
          Download history
        </Link>
        <Link className={button('primary')} to="/app/records">
          <Icon name="upload" size={17} />
          Upload record
        </Link>
      </PageHeader>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 gap-5">
        {/* Patient Profile Summary Card */}
        <PatientSummaryCard
          profile={profile}
          onUpdatePermittedDetails={handleUpdatePermittedDetails}
        />

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 items-start gap-5 min-[1080px]:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
          {/* Left Column: Stats, Allergies, Prescriptions, Quick Access */}
          <div className="flex flex-col gap-5">
            {/* Real-time stats summary */}
            <StatsSummary events={timelineEvents.length > 0 ? timelineEvents : demoEvents} />

            {/* Prescriptions Section (time-ordered, initially empty with PDF/Image upload) */}
            <PrescriptionsSection
              prescriptions={prescriptions}
              onUploadPrescription={handleUploadPrescription}
              onDeletePrescription={handleDeletePrescription}
            />

            {/* Allergies & Related Properties Section */}
            <AllergiesSection
              allergies={allergies}
              onAddAllergy={handleAddAllergy}
            />

            {/* Quick access tiles */}
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Quick navigation">
              <Link
                to="/app/timeline"
                className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-brand-tint text-brand">
                  <Icon name="timeline" size={20} />
                </span>
                <div>
                  <strong className="block text-sm font-semibold text-ink">Lifelong Timeline</strong>
                  <span className="text-xs text-ink-faint">Full interactive history</span>
                </div>
              </Link>

              <Link
                to="/app/records"
                className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-brand-tint text-brand">
                  <Icon name="file" size={20} />
                </span>
                <div>
                  <strong className="block text-sm font-semibold text-ink">All Records</strong>
                  <span className="text-xs text-ink-faint">Reports, tests &amp; scans</span>
                </div>
              </Link>

              <Link
                to="/app/access"
                className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-brand-tint text-brand">
                  <Icon name="shield" size={20} />
                </span>
                <div>
                  <strong className="block text-sm font-semibold text-ink">Access Control</strong>
                  <span className="text-xs text-ink-faint">Doctor consent &amp; audit log</span>
                </div>
              </Link>
            </section>
          </div>

          {/* Right Column: Timeline (initially empty on right) & Active Doctor Access */}
          <div className="flex flex-col gap-5">
            {/* Timeline Section */}
            <TimelineSection
              events={timelineEvents}
              onAddRecordClick={() => {
                // Focus upload or trigger prescription upload
                const btn = document.querySelector<HTMLButtonElement>('[aria-label="Upload PDF prescription"]')
                btn?.click()
              }}
              onToggleDemoData={handleToggleDemoData}
              isDemoDataLoaded={isDemoTimelineLoaded}
            />

            {/* Doctor Access & Consent Summary */}
            <ActiveAccessCard
              grants={grants}
              onRevoke={handleRevokeGrant}
            />
          </div>
        </div>
      </div>
    </>
  )
}
