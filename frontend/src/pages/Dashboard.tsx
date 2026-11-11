import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { KindTag } from '../components/Kind'
import PageHeader from '../components/PageHeader'
import { events, kinds, patient } from '../data/mock'
import type { Kind, Severity } from '../data/mock'
import { formatDate } from '../lib/format'
import { avatar, button, card, cardTitle, input, select } from '../lib/ui'

// ─── helpers ────────────────────────────────────────────────────────────────

const activeOf = (kind: Kind) => events.filter((e) => e.kind === kind && e.status === 'active')
const countOf = (kind: Kind) => events.filter((e) => e.kind === kind).length
const allergies = events.filter((e) => e.kind === 'allergy' && e.status === 'active')
const sortedEvents = [...events].sort((a, b) => b.date.localeCompare(a.date))

function severityBadge(severity?: Severity) {
  if (!severity) return null
  const cls: Record<Severity, string> = {
    mild: 'bg-vaccination-tint text-vaccination-ink',
    moderate: 'bg-report-tint text-report-ink',
    severe: 'bg-allergy-tint text-allergy-ink',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold capitalize ${cls[severity]}`}>
      {severity}
    </span>
  )
}

// ─── Profile completion modal ────────────────────────────────────────────────

const PROFILE_KEY = 'mediclaim_profile_complete'

interface ProfileForm {
  gender: string
  blood_group: string
  address: string
  emergency_name: string
  emergency_phone: string
  emergency_relation: string
}

function ProfileModal({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState<ProfileForm>({
    gender: '',
    blood_group: '',
    address: '',
    emergency_name: '',
    emergency_phone: '',
    emergency_relation: '',
  })

  const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: POST /api/v1/patients/profile with form data
    localStorage.setItem(PROFILE_KEY, 'true')
    onComplete()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="w-full max-w-lg rounded-[28px] bg-white shadow-soft overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-line">
          <div className="mb-1 flex size-11 items-center justify-center rounded-[14px] bg-brand-tint text-brand">
            <Icon name="user" size={22} />
          </div>
          <h2 id="profile-modal-title" className="mt-3 text-[1.6rem]">
            Complete your profile
          </h2>
          <p className="text-[0.95rem] text-ink-soft">
            We need a few details to set up your health record. This takes under a minute.
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-5 px-7 py-6">
          {/* Row: gender + blood group */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="p-gender" className="text-sm font-semibold">
                Gender <span className="text-allergy">*</span>
              </label>
              <select id="p-gender" className={select} value={form.gender} onChange={set('gender')} required>
                <option value="" disabled>Select…</option>
                <option>Male</option>
                <option>Female</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="p-blood" className="text-sm font-semibold">
                Blood group <span className="text-allergy">*</span>
              </label>
              <select id="p-blood" className={select} value={form.blood_group} onChange={set('blood_group')} required>
                <option value="" disabled>Select…</option>
                {['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Unknown'].map((bg) => (
                  <option key={bg}>{bg}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div className="grid gap-1.5">
            <label htmlFor="p-address" className="text-sm font-semibold">
              Address <span className="text-allergy">*</span>
            </label>
            <textarea
              id="p-address"
              rows={2}
              className="w-full rounded-[14px] border border-line-strong bg-white px-4 py-3 text-[0.95rem] transition placeholder:text-[#85999f] focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none resize-none"
              placeholder="House/flat, street, city, state – PIN"
              value={form.address}
              onChange={set('address')}
              required
            />
          </div>

          {/* Emergency contact */}
          <div>
            <p className="mb-3 text-sm font-semibold text-ink">
              Emergency contact <span className="text-allergy">*</span>
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="p-ename" className="text-sm text-ink-soft">
                  Full name
                </label>
                <input
                  id="p-ename"
                  className={input}
                  placeholder="e.g. Lakshmi Rao"
                  value={form.emergency_name}
                  onChange={set('emergency_name')}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="p-ephone" className="text-sm text-ink-soft">
                  Phone number
                </label>
                <input
                  id="p-ephone"
                  type="tel"
                  className={input}
                  placeholder="+91 98765 43210"
                  value={form.emergency_phone}
                  onChange={set('emergency_phone')}
                  required
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <label htmlFor="p-erel" className="text-sm text-ink-soft">
                  Relation
                </label>
                <select
                  id="p-erel"
                  className={select}
                  value={form.emergency_relation}
                  onChange={set('emergency_relation')}
                  required
                >
                  <option value="" disabled>Select relation…</option>
                  {['Parent', 'Spouse', 'Sibling', 'Child', 'Friend', 'Other'].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button className={`${button('primary', 'lg')} w-full mt-1`} type="submit">
            Save and continue
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

interface StatCardProps {
  kind: Kind
  value: number
  label: string
  note: string
}

function StatCard({ kind, value, label, note }: StatCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-[20px] bg-(--kt) p-4" data-kind={kind}>
      <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-white text-(--ki)">
        <Icon name={kinds[kind].icon} size={18} />
      </span>
      <div className="min-w-0">
        <strong className="block font-display text-[1.9rem] font-medium leading-none text-(--ki)">
          {value}
        </strong>
        <span className="mt-1.5 block text-[0.82rem] font-semibold leading-tight">{label}</span>
        <small className="mt-0.5 block truncate text-[0.78rem] leading-[1.4] text-ink-soft">{note}</small>
      </div>
    </div>
  )
}

// ─── Allergies section ───────────────────────────────────────────────────────

function AllergiesSection() {
  return (
    <section className={card} aria-labelledby="allergies-h">
      <h2 className={cardTitle} id="allergies-h">
        Allergies &amp; sensitivities
        <Link
          className="font-sans text-[0.88rem] font-semibold tracking-normal text-brand hover:underline hover:underline-offset-[3px]"
          to="/app/records?kind=allergy"
        >
          View all →
        </Link>
      </h2>

      {allergies.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-[14px] bg-mist px-5 py-6 text-ink-soft">
          <Icon name="alert" size={22} className="text-ink-faint" />
          <strong className="text-[0.95rem] font-semibold text-ink">No allergies on record</strong>
          <p className="text-[0.88rem]">Add an allergy to keep your doctors informed.</p>
          <button className={`${button('soft', 'sm')} mt-1`} type="button">
            <Icon name="plus" size={15} />
            Add allergy
          </button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {allergies.map((a) => (
            <li
              key={a.id}
              data-kind="allergy"
              className="flex items-start gap-3 rounded-[16px] border border-line bg-mist p-3.5"
            >
              {/* Colored dot */}
              <span className="mt-1 size-2.5 shrink-0 rounded-full bg-(--k) ring-4 ring-(--kt)" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[0.95rem] font-semibold">{a.title}</strong>
                  {severityBadge(a.severity)}
                </div>
                {a.reaction && (
                  <p className="mt-0.5 text-[0.84rem] text-ink-soft">{a.reaction}</p>
                )}
                <p className="mt-1 text-[0.82rem] text-ink-faint">
                  Since {formatDate(a.date)} · {a.provider}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── Prescriptions section ───────────────────────────────────────────────────

interface Prescription {
  id: string
  title: string
  date: string
  doctor: string
  fileType: 'pdf' | 'image'
}

function PrescriptionsSection() {
  // Starts empty; wired to real API later
  const [prescriptions] = useState<Prescription[]>([])
  const pdfRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  return (
    <section className={card} aria-labelledby="rx-h">
      <div className={cardTitle} id="rx-h">
        <h2>Prescriptions</h2>
        <button className={button('soft', 'sm')} type="button" onClick={() => pdfRef.current?.click()}>
          <Icon name="upload" size={15} />
          Upload
        </button>
      </div>

      {/* Hidden file inputs */}
      <input ref={pdfRef} type="file" accept=".pdf" className="hidden" aria-label="Upload PDF prescription" />
      <input ref={imgRef} type="file" accept="image/*" className="hidden" aria-label="Upload image prescription" />

      {prescriptions.length === 0 ? (
        <div className="rounded-[18px] border-2 border-dashed border-line-strong px-6 py-10 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-mist text-ink-faint">
            <Icon name="file" size={22} />
          </span>
          <p className="mb-1 font-semibold text-ink">No prescriptions yet</p>
          <p className="mb-5 text-[0.88rem] text-ink-soft">
            Upload PDF or image files from your old prescriptions.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              className={button('ghost', 'sm')}
              type="button"
              onClick={() => pdfRef.current?.click()}
            >
              <Icon name="file" size={15} />
              Upload PDF
            </button>
            <button
              className={button('ghost', 'sm')}
              type="button"
              onClick={() => imgRef.current?.click()}
            >
              <Icon name="image" size={15} />
              Upload image
            </button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-2">
          {prescriptions.map((rx) => (
            <li
              key={rx.id}
              className="flex items-center gap-3 rounded-[14px] border border-line px-4 py-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-report-tint text-report-ink">
                <Icon name={rx.fileType === 'pdf' ? 'file' : 'image'} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-[0.9rem] font-semibold">{rx.title}</strong>
                <small className="text-[0.8rem] text-ink-faint">
                  {rx.doctor} · {formatDate(rx.date)}
                </small>
              </div>
              <button className={button('ghost', 'sm')} type="button">
                View
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── Mini timeline ───────────────────────────────────────────────────────────

function MiniTimeline() {
  // Build year-grouped entries outside of render (pure computation, not state mutation)
  const grouped = sortedEvents.reduce<{ year: string; first: boolean; event: typeof sortedEvents[number] }[]>(
    (acc, e) => {
      const year = e.date.slice(0, 4)
      const isFirst = acc.length === 0 || acc[acc.length - 1].year !== year
      acc.push({ year, first: isFirst, event: e })
      return acc
    },
    [],
  )

  return (
    <section
      className={`${card} flex flex-col`}
      aria-labelledby="mini-tl-h"
      style={{ minHeight: 0 }}
    >
      <div className={cardTitle}>
        <h2 id="mini-tl-h">Your timeline</h2>
        <Link
          className="font-sans text-[0.88rem] font-semibold tracking-normal text-brand hover:underline hover:underline-offset-[3px]"
          to="/app/timeline"
        >
          Full timeline →
        </Link>
      </div>

      {sortedEvents.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-[14px] bg-mist px-5 py-8 text-ink-soft">
          <Icon name="timeline" size={22} className="text-ink-faint" />
          <strong className="text-[0.95rem] font-semibold text-ink">Your timeline is empty</strong>
          <p className="text-[0.88rem]">Records you add will appear here in order.</p>
        </div>
      ) : (
        <ol className="relative overflow-y-auto pr-1 -mr-1" style={{ maxHeight: 'calc(100vh - 240px)' }}>
          {/* Vertical track */}
          <span className="pointer-events-none absolute left-[11px] top-0 bottom-0 w-0.5 rounded-full bg-line-strong" />

          {grouped.map(({ year, first, event: e }) => {

            return (
              <li key={e.id} data-kind={e.kind} className="relative pl-7">
                {/* Year label */}
                {first && (
                  <div className="sticky top-0 z-10 -mx-1 mb-1 mt-3 bg-white/90 py-0.5 backdrop-blur-sm first:mt-0">
                    <span className="font-display text-[1.05rem] text-ink-faint">{year}</span>
                  </div>
                )}

                {/* Dot */}
                <span className="absolute left-1.5 top-[18px] size-2.5 rounded-full border-2 border-(--k) bg-white ring-2 ring-(--kt)" />

                {/* Card */}
                <div className="mb-2 rounded-[14px] border border-line bg-mist px-3.5 py-2.5">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <KindTag kind={e.kind} />
                    {e.status === 'active' && (
                      <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[0.72rem] font-semibold text-brand-deep">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[0.88rem] font-semibold leading-snug text-ink">{e.title}</p>
                  <p className="mt-0.5 text-[0.78rem] text-ink-faint">
                    {formatDate(e.date)}
                    {e.provider ? ` · ${e.provider.split(',')[0]}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [profileComplete, setProfileComplete] = useState(
    () => localStorage.getItem(PROFILE_KEY) === 'true',
  )

  const activeAllergies = activeOf('allergy')
  const activeMeds = activeOf('medication')
  const activeConditions = activeOf('condition')

  return (
    <>
      {/* Profile completion gate */}
      {!profileComplete && <ProfileModal onComplete={() => setProfileComplete(true)} />}

      <PageHeader
        title={`Welcome, ${patient.firstName}`}
        subtitle="Your health story, all in one place."
      >
        <Link className={button('ghost')} to="/app/records">
          <Icon name="download" size={17} />
          Download history
        </Link>
        <button className={button('primary')} type="button">
          <Icon name="upload" size={17} />
          Upload record
        </button>
      </PageHeader>

      {/* Profile completion nudge (after partial dismiss via dev tools) */}
      {!profileComplete && (
        <div className="mb-5 flex items-center gap-3 rounded-[16px] bg-brand-tint px-5 py-3.5">
          <Icon name="user" size={18} className="shrink-0 text-brand" />
          <p className="flex-1 text-[0.9rem] text-brand-deep">
            Complete your profile so your records are set up correctly.
          </p>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">

        {/* ── LEFT COLUMN ── */}
        <div className="grid gap-5">

          {/* Stats strip */}
          <section
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            aria-label="Health summary"
          >
            <StatCard
              kind="allergy"
              value={activeAllergies.length}
              label="Active allergies"
              note={activeAllergies.map((a) => a.title).join(', ') || 'None recorded'}
            />
            <StatCard
              kind="condition"
              value={activeConditions.length}
              label="Active conditions"
              note={activeConditions.map((c) => c.title).join(', ') || 'None recorded'}
            />
            <StatCard
              kind="medication"
              value={activeMeds.length}
              label="Current medicines"
              note={activeMeds.map((m) => m.title.split(' ')[0]).join(', ') || 'None recorded'}
            />
            <StatCard
              kind="vaccination"
              value={countOf('vaccination')}
              label="Vaccinations"
              note="Total on record"
            />
          </section>

          {/* Allergies */}
          <AllergiesSection />

          {/* Prescriptions */}
          <PrescriptionsSection />

          {/* Quick access */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Quick access">
            {(
              [
                { to: '/app/timeline', icon: 'timeline', label: 'Timeline', desc: 'Your full health history' },
                { to: '/app/records', icon: 'file', label: 'Records', desc: 'Reports & prescriptions' },
                { to: '/app/access', icon: 'shield', label: 'Access', desc: 'Who can see your data' },
              ] as const
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-[18px] border border-line bg-white px-4 py-3.5 shadow-soft transition-colors hover:border-brand hover:bg-brand-tint"
              >
                <span className={`${avatar} rounded-[12px]`}>
                  <Icon name={item.icon} size={18} />
                </span>
                <div>
                  <strong className="block text-[0.9rem] font-semibold">{item.label}</strong>
                  <small className="text-[0.8rem] text-ink-faint">{item.desc}</small>
                </div>
              </Link>
            ))}
          </section>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-5">
          <MiniTimeline />

          {/* Active access */}
          <section className="rounded-[26px] bg-brand-tint p-6" aria-labelledby="access-h">
            <h2 className={`${cardTitle} !text-[1.1rem]`} id="access-h">
              Who can see your records
              <Link
                className="font-sans text-[0.85rem] font-semibold tracking-normal text-brand hover:underline hover:underline-offset-[3px]"
                to="/app/access"
              >
                Manage →
              </Link>
            </h2>
            <ul className="grid gap-2">
              {[
                { id: 'g1', name: 'Dr. Rohan Kulkarni', role: 'Pulmonologist', remaining: '1 h 48 min' },
                { id: 'g2', name: 'Dr. Meera Iyer', role: 'General physician', remaining: '5 h 20 min' },
              ].map((g) => (
                <li key={g.id} className="flex items-center gap-3 rounded-[14px] bg-white px-3.5 py-3">
                  <span className={avatar}>{g.name.replace(/^Dr\.\s+/, '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[0.88rem] font-semibold">{g.name}</strong>
                    <small className="text-[0.78rem] text-ink-faint">{g.role}</small>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-[0.75rem] font-semibold text-brand-deep">
                    <Icon name="clock" size={12} />
                    {g.remaining}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
