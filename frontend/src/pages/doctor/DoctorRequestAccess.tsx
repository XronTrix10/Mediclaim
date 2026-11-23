import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import Field from '../../components/Field'
import { card, button, input, select, textarea } from '../../lib/ui'
import { submitAccessRequest } from '../../api/doctor'
import {
  triggerEmergencyAccess,
  type EmergencyType,
  type EmergencyAccessData,
} from '../../api/emergency'
import { ApiError } from '../../api/client'

const SCOPES = [
  { value: 'vaccination', label: 'Vaccinations' },
  { value: 'condition', label: 'Conditions' },
  { value: 'medication', label: 'Medications' },
  { value: 'allergy', label: 'Allergies' },
  { value: 'report', label: 'Reports' },
  { value: 'document', label: 'Documents & Files' },
]

const DURATIONS = [
  { value: '2', label: '2 hours' },
  { value: '6', label: '6 hours' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
  { value: '48', label: '48 hours' },
  { value: '168', label: '7 days' },
]

const EMERGENCY_TYPES: Array<{ value: EmergencyType; label: string }> = [
  { value: 'TRAUMA_RESUSCITATION', label: 'Trauma Resuscitation (Code Red)' },
  { value: 'ACUTE_CORONARY', label: 'Acute Coronary Syndrome (STEMI / Cardiac Arrest)' },
  { value: 'STROKE_THROMBOLYSIS', label: 'Acute Stroke / Thrombolysis Window' },
  { value: 'MASS_CASUALTY', label: 'Mass Casualty / Disaster Triage' },
  { value: 'OTHER_LIFE_THREATENING', label: 'Other Immediate Life-Threatening Emergency' },
]

type Step = 'search' | 'configure' | 'sent'
type Mode = 'standard' | 'emergency'

export default function DoctorRequestAccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialMode = searchParams.get('mode') === 'emergency' ? 'emergency' : 'standard'
  const [mode, setMode] = useState<Mode>(initialMode)

  // Standard request state
  const [step, setStep] = useState<Step>('search')
  const [mediclaimId, setMediclaimId] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'vaccination', 'condition', 'medication', 'allergy', 'report', 'document'
  ])
  const [duration, setDuration] = useState('24')
  const [purpose, setPurpose] = useState('')

  // Emergency request state
  const [emergencyMediclaimId, setEmergencyMediclaimId] = useState('')
  const [emergencyType, setEmergencyType] = useState<EmergencyType>('TRAUMA_RESUSCITATION')
  const [clinicalJustification, setClinicalJustification] = useState('')
  const [emergencyResult, setEmergencyResult] = useState<EmergencyAccessData | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('mode') === 'emergency') {
      setMode('emergency')
    }
  }, [searchParams])

  function toggleScope(value: string) {
    setSelectedScopes((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
  }

  async function handleStandardSubmit() {
    if (!mediclaimId.trim()) { setError('Please enter a Mediclaim ID.'); return }
    if (selectedScopes.length === 0) { setError('Please select at least one scope.'); return }
    setError(null); setLoading(true)
    try {
      await submitAccessRequest({
        patientMediclaimId: mediclaimId.trim(),
        scope: selectedScopes,
        durationHours: parseInt(duration, 10),
        purpose: purpose.trim() || 'General consultation',
      })
      setStep('sent')
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit request. Please try again.')
    } finally { setLoading(false) }
  }

  async function handleEmergencySubmit() {
    if (!emergencyMediclaimId.trim()) {
      setError('Please enter the patient Mediclaim ID.')
      return
    }
    if (clinicalJustification.trim().length < 20) {
      setError('Clinical justification must be at least 20 characters detailing the medical emergency.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const data = await triggerEmergencyAccess({
        patientMediclaimId: emergencyMediclaimId.trim(),
        emergencyType,
        clinicalJustification: clinicalJustification.trim(),
      })
      setEmergencyResult(data)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to trigger emergency break-glass access. Please check the Mediclaim ID.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-7">
      <PageHeader
        title={mode === 'emergency' ? 'Emergency Break-Glass Override' : 'Request Patient Access'}
        subtitle={
          mode === 'emergency'
            ? 'Statutory emergency override for acute, life-threatening clinical presentations.'
            : 'Enter a patient\'s Mediclaim ID to request consent for their clinical records.'
        }
      />

      {/* Mode Switcher */}
      <div className="flex border-b border-line gap-2">
        <button
          type="button"
          onClick={() => { setMode('standard'); setError(null); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            mode === 'standard'
              ? 'border-brand text-brand'
              : 'border-transparent text-ink-soft hover:text-ink'
          }`}
        >
          Standard Consent Request
        </button>
        <button
          type="button"
          onClick={() => { setMode('emergency'); setError(null); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            mode === 'emergency'
              ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-lg'
              : 'border-transparent text-amber-700 hover:text-amber-900'
          }`}
        >
          <span className="grid size-4 place-items-center rounded-full bg-amber-600 text-white text-[10px]">!</span>
          Emergency Break-Glass
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-allergy-tint px-4 py-3 text-sm font-medium text-allergy-ink flex items-center gap-2">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* -------------------- EMERGENCY BREAK-GLASS MODE -------------------- */}
      {mode === 'emergency' && (
        <div className="grid gap-6">
          {!emergencyResult ? (
            <div className="grid gap-6">
              {/* Emergency Warning */}
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5 text-amber-950">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-600 text-white">
                    <Icon name="alert" size={18} />
                  </div>
                  <div className="text-sm">
                    <h3 className="font-semibold text-amber-950">Statutory Emergency Exception Notice</h3>
                    <p className="mt-1 text-amber-900 leading-relaxed">
                      This protocol immediately grants emergency access without prior patient OTP approval.
                      In accordance with clinical data governance:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-amber-900 text-xs font-medium">
                      <li>An immutable audit entry will be permanently written to the audit log.</li>
                      <li>Access is strictly bounded to <strong>1 hour</strong> for critical triage data (Blood Group, High-Risk Allergies, Active Conditions).</li>
                      <li>This event is flagged for mandatory <strong>24-hour administrative review</strong>.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className={card}>
                <h2 className="mb-5 text-[1.1rem] font-semibold text-ink">Emergency Clinical Protocol</h2>
                <div className="grid gap-5 max-w-xl">
                  <Field
                    label="Patient Mediclaim ID"
                    htmlFor="emg-mid"
                    hint="Enter the 12-digit Mediclaim ID or public ID of the patient in acute distress."
                  >
                    <input
                      id="emg-mid"
                      className={input}
                      placeholder="e.g. 4821 9306 1175"
                      value={emergencyMediclaimId}
                      onChange={(e) => setEmergencyMediclaimId(e.target.value)}
                    />
                  </Field>

                  <Field label="Emergency Classification" htmlFor="emg-type">
                    <select
                      id="emg-type"
                      className={select}
                      value={emergencyType}
                      onChange={(e) => setEmergencyType(e.target.value as EmergencyType)}
                    >
                      {EMERGENCY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Clinical Justification (Mandatory &ge; 20 characters)"
                    htmlFor="emg-justification"
                    hint="Document clinical presentation and reason why standard consent is impossible (e.g. unconscious, severe trauma, shock)."
                  >
                    <textarea
                      id="emg-justification"
                      className={textarea}
                      rows={4}
                      placeholder="e.g. Patient brought in unconscious via ambulance following severe motor vehicle collision. Unresponsive with massive hemorrhage; immediate blood group and allergy verification required for emergency surgery."
                      value={clinicalJustification}
                      onChange={(e) => setClinicalJustification(e.target.value)}
                    />
                    <div className="mt-1 flex justify-between text-xs text-ink-soft">
                      <span>Minimum 20 characters required</span>
                      <span className={clinicalJustification.trim().length < 20 ? 'text-amber-700 font-semibold' : 'text-brand font-semibold'}>
                        {clinicalJustification.trim().length} / 1000
                      </span>
                    </div>
                  </Field>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleEmergencySubmit}
                      disabled={loading || clinicalJustification.trim().length < 20 || !emergencyMediclaimId.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Icon name="shield" size={18} />
                      {loading ? 'Authorizing Break-Glass...' : 'Authorize Emergency Break-Glass Access'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Emergency Result Display */
            <div className="grid gap-6">
              {/* Authorized Header */}
              <div className="rounded-2xl border border-brand bg-brand-tint/30 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-12 place-items-center rounded-2xl bg-brand text-white">
                      <Icon name="shield" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-ink">Emergency Access Granted</h2>
                      <p className="text-xs text-ink-soft">
                        Audit Tracking ID: <span className="font-mono font-semibold text-ink">{emergencyResult.auditTrackingId}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-brand-tint px-3 py-1 font-semibold text-brand-deep">
                      Expires: {new Date(emergencyResult.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (1 Hour)
                    </span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">
                      Audit Review By: {new Date(emergencyResult.reviewMandatoryBefore).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Critical Summary Card */}
              <div className={card}>
                <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Icon name="heart" size={20} className="text-rose-600" />
                    Life-Saving Critical Summary
                  </h3>
                  <span className="text-xs text-ink-soft font-mono">Patient: {emergencyMediclaimId}</span>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  {/* Blood Group */}
                  <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 flex flex-col justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">Blood Group</span>
                    <div className="my-3 text-4xl font-extrabold text-rose-950 font-display">
                      {emergencyResult.criticalSummary.bloodGroup || 'Unknown'}
                    </div>
                    <span className="text-[11px] text-rose-700">Verified from patient master profile</span>
                  </div>

                  {/* Critical Allergies */}
                  <div className="rounded-2xl bg-allergy-tint/50 border border-allergy-line p-5 md:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-allergy-ink flex items-center gap-1.5">
                        <Icon name="alert" size={14} />
                        High-Risk / Life-Threatening Allergies
                      </span>
                      <span className="text-xs font-bold text-allergy-ink">
                        {emergencyResult.criticalSummary.criticalAllergies.length} recorded
                      </span>
                    </div>

                    {emergencyResult.criticalSummary.criticalAllergies.length === 0 ? (
                      <p className="text-xs text-ink-soft py-3">No active severe or life-threatening allergies recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {emergencyResult.criticalSummary.criticalAllergies.map((a, i) => (
                          <div key={i} className="flex items-start justify-between rounded-xl bg-white p-2.5 text-xs shadow-xs border border-allergy-line">
                            <div>
                              <strong className="text-ink">{a.allergen}</strong>
                              {a.reaction && <span className="block text-ink-soft text-[11px]">Reaction: {a.reaction}</span>}
                            </div>
                            <span className="rounded-full bg-allergy-tint px-2 py-0.5 font-bold uppercase text-[10px] text-allergy-ink">
                              {a.severity}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Conditions */}
                <div className="mt-6 rounded-2xl bg-mist/60 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink flex items-center gap-1.5">
                      <Icon name="file" size={14} />
                      Active Medical Conditions
                    </span>
                    <span className="text-xs font-bold text-ink-soft">
                      {emergencyResult.criticalSummary.activeConditions.length} active
                    </span>
                  </div>

                  {emergencyResult.criticalSummary.activeConditions.length === 0 ? (
                    <p className="text-xs text-ink-soft py-2">No active chronic or acute conditions recorded.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {emergencyResult.criticalSummary.activeConditions.map((c, i) => (
                        <div key={i} className="rounded-xl bg-white p-2.5 text-xs shadow-xs border border-line flex items-center justify-between">
                          <strong className="text-ink">{c.conditionName}</strong>
                          <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold text-brand-deep">
                            {c.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex flex-wrap gap-3 pt-4 border-t border-line">
                  <button
                    onClick={() => navigate(`/app/doctor/patients/${emergencyMediclaimId.replace(/\s+/g, '')}`)}
                    className={`${button('primary', 'md')} gap-2`}
                  >
                    <Icon name="users" size={16} />
                    View Full Patient Record
                  </button>
                  <button
                    onClick={() => window.print()}
                    className={`${button('soft', 'md')} gap-2`}
                  >
                    <Icon name="download" size={16} />
                    Print Emergency Summary
                  </button>
                  <button
                    onClick={() => {
                      setEmergencyResult(null)
                      setClinicalJustification('')
                      setEmergencyMediclaimId('')
                    }}
                    className={`${button('ghost', 'md')}`}
                  >
                    Close Session / New Override
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------- STANDARD CONSENT MODE -------------------- */}
      {mode === 'standard' && (
        <div className="grid gap-6">
          {step === 'sent' && (
            <div className={`${card} text-center py-10`}>
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-tint text-brand">
                <Icon name="check" size={28} />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-ink">Request Sent!</h2>
              <p className="mt-2 text-sm text-ink-soft max-w-sm mx-auto">
                Your access request has been sent to patient <strong>{mediclaimId}</strong>. 
                You'll be notified once the patient approves your request.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setStep('search')
                    setMediclaimId('')
                    setPurpose('')
                    setSelectedScopes(['vaccination', 'condition', 'medication', 'allergy', 'report', 'document'])
                    setDuration('24')
                  }}
                  className={`${button('soft', 'md')}`}
                >
                  Request another
                </button>
              </div>
            </div>
          )}

          {step === 'search' && (
            <div className={card}>
              <h2 className="mb-5 text-[1.1rem] font-semibold text-ink">Patient Lookup</h2>
              <div className="grid gap-4 max-w-md">
                <Field label="Patient Mediclaim ID" htmlFor="req-mid" hint="Enter the 12-digit Mediclaim ID of the patient.">
                  <input
                    id="req-mid"
                    className={input}
                    inputMode="numeric"
                    placeholder="0000 0000 0000"
                    value={mediclaimId}
                    onChange={(e) => setMediclaimId(e.target.value)}
                  />
                </Field>
                <button
                  className={`${button('primary', 'md')} w-fit gap-2`}
                  onClick={() => {
                    if (mediclaimId.trim()) {
                      setError(null)
                      setStep('configure')
                    } else setError('Please enter a Mediclaim ID.')
                  }}
                >
                  <Icon name="search" size={16} />
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'configure' && (
            <div className="grid gap-5">
              <div className={card}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-[1.1rem] font-semibold text-ink">Configure Request</h2>
                    <p className="text-sm text-ink-soft mt-0.5">Patient: <span className="font-semibold text-ink">{mediclaimId}</span></p>
                  </div>
                  <button onClick={() => setStep('search')} className="text-sm text-brand hover:underline font-semibold cursor-pointer">Change</button>
                </div>

                <div className="grid gap-5">
                  <div>
                    <p className="text-sm font-semibold text-ink mb-3">Record types to access</p>
                    <div className="flex flex-wrap gap-2">
                      {SCOPES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => toggleScope(s.value)}
                          aria-pressed={selectedScopes.includes(s.value)}
                          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                            selectedScopes.includes(s.value)
                              ? 'border-brand bg-brand-tint text-brand-deep'
                              : 'border-line-strong bg-white text-ink-soft hover:border-brand/50'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field label="Access duration" htmlFor="req-duration">
                    <select id="req-duration" className={select} value={duration} onChange={(e) => setDuration(e.target.value)}>
                      {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </Field>

                  <Field label="Purpose (optional)" htmlFor="req-purpose" hint="Briefly describe the reason for requesting access.">
                    <textarea
                      id="req-purpose"
                      className={textarea}
                      rows={3}
                      placeholder="e.g. Follow-up consultation for cardiac evaluation"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                    />
                  </Field>

                  <div className="flex gap-3">
                    <button onClick={handleStandardSubmit} disabled={loading} className={`${button('primary', 'md')} gap-2`}>
                      {loading ? 'Sending...' : 'Send Access Request'}
                    </button>
                    <button onClick={() => setStep('search')} className={`${button('ghost', 'md')}`}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] bg-mist px-5 py-4 text-sm text-ink-soft">
                <p className="font-semibold text-ink mb-1">How it works</p>
                <ul className="list-disc list-inside space-y-1 text-[0.88rem]">
                  <li>The patient will receive a notification with your request details.</li>
                  <li>Once approved, you'll gain access to the selected record types.</li>
                  <li>Access automatically expires after the selected duration.</li>
                  <li>The patient can revoke access at any time.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
