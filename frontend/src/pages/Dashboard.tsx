import { useRef } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import type { IconName } from '../components/Icon'
import { button } from '../lib/ui'
import { downloadHistory } from '../lib/exportHistory'
import { useHealthData } from '../store/healthData'
import {
  ActiveAccessCard,
  AllergiesSection,
  PatientSummaryCard,
  PrescriptionUploader,
  PrescriptionsSection,
  ProfileCompletionModal,
  StatsSummary,
  TimelineSection,
} from '../components/dashboard'
import type { UploaderHandle } from '../components/dashboard'

const quickLinks: { to: string; icon: IconName; title: string; hint: string }[] = [
  { to: '/app/timeline', icon: 'timeline', title: 'Lifelong timeline', hint: 'Timeline and health graph' },
  { to: '/app/records', icon: 'file', title: 'All records', hint: 'Search, view and correct' },
  { to: '/app/access', icon: 'shield', title: 'Access control', hint: 'Doctor consent and history' },
]

export default function Dashboard() {
  const { profile, events, prescriptions, grants, sampleLoaded, actions } = useHealthData()
  const uploader = useRef<UploaderHandle>(null)
  const openUpload = () => uploader.current?.openPicker()
  const allergies = events.filter((e) => e.kind === 'allergy')

  return (
    <>
      {!profile.isProfileComplete && (
        <ProfileCompletionModal initialName={profile.firstName} onComplete={actions.completeProfile} />
      )}
      <PrescriptionUploader ref={uploader} />

      <PageHeader title={`Welcome back, ${profile.firstName}`} subtitle="Your lifelong health record, in HL7 FHIR format.">
        <button type="button" className={button('ghost')} onClick={() => downloadHistory(profile, events)}>
          <Icon name="download" size={17} />
          Download history
        </button>
        <button type="button" className={button('primary')} onClick={openUpload}>
          <Icon name="upload" size={17} />
          Upload record
        </button>
      </PageHeader>

      <div className="grid gap-5">
        <PatientSummaryCard profile={profile} onUpdatePermittedDetails={actions.updatePermittedDetails} />

        {/* On small screens the sections are reordered so the most important ones come first: who can see my
            records, then my allergies. From 1080px they sit in two columns in their natural order. */}
        <div className="grid items-start gap-5 min-[1080px]:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
          <div className="contents min-[1080px]:flex min-[1080px]:flex-col min-[1080px]:gap-5">
            <div className="order-1 min-[1080px]:order-none">
              <StatsSummary events={events} />
            </div>
            <div className="order-5 min-[1080px]:order-none">
              <PrescriptionsSection prescriptions={prescriptions} onAdd={openUpload} onDelete={actions.removePrescription} />
            </div>
            <div className="order-3 min-[1080px]:order-none">
              <AllergiesSection allergies={allergies} onAddAllergy={actions.addAllergy} />
            </div>
            <nav className="order-6 grid gap-3 sm:grid-cols-3 min-[1080px]:order-none" aria-label="Quick links">
              {quickLinks.map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-3.5 shadow-soft transition-colors hover:border-brand"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-brand-tint text-brand">
                    <Icon name={q.icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm font-semibold text-ink">{q.title}</strong>
                    <span className="block text-xs text-ink-faint">{q.hint}</span>
                  </span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="contents min-[1080px]:flex min-[1080px]:flex-col min-[1080px]:gap-5">
            <div className="order-4 min-[1080px]:order-none">
              <TimelineSection events={events} sampleLoaded={sampleLoaded} onUpload={openUpload} onToggleSample={actions.toggleSample} />
            </div>
            <div className="order-2 min-[1080px]:order-none">
              <ActiveAccessCard grants={grants} onRevoke={actions.revokeGrant} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
