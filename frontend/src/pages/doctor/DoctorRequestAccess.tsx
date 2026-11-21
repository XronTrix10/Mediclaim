import { useState } from 'react'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import Field from '../../components/Field'
import { card, button, input, select, textarea } from '../../lib/ui'
import { submitAccessRequest } from '../../api/doctor'
import { ApiError } from '../../api/client'

const SCOPES = [
  { value: 'vaccination', label: 'Vaccinations' },
  { value: 'condition', label: 'Conditions' },
  { value: 'medication', label: 'Medications' },
  { value: 'allergy', label: 'Allergies' },
  { value: 'report', label: 'Reports' },
]

const DURATIONS = [
  { value: '2', label: '2 hours' },
  { value: '6', label: '6 hours' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
  { value: '48', label: '48 hours' },
  { value: '168', label: '7 days' },
]

type Step = 'search' | 'configure' | 'sent'

export default function DoctorRequestAccess() {
  const [step, setStep] = useState<Step>('search')
  const [mediclaimId, setMediclaimId] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['vaccination', 'condition', 'medication', 'allergy', 'report'])
  const [duration, setDuration] = useState('24')
  const [purpose, setPurpose] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleScope(value: string) {
    setSelectedScopes((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
  }

  async function handleSubmit() {
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

  if (step === 'sent') {
    return (
      <div className="grid gap-7">
        <PageHeader title="Request Access" subtitle="Request consent from a patient to view their records." />
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
            <button onClick={() => { setStep('search'); setMediclaimId(''); setPurpose(''); setSelectedScopes(['vaccination', 'condition', 'medication', 'allergy', 'report']); setDuration('24') }} className={`${button('soft', 'md')}`}>
              Request another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-7">
      <PageHeader
        title="Request Access"
        subtitle="Enter a patient's Mediclaim ID to request consent for their records."
      />

      {error && (
        <div role="alert" className="rounded-xl bg-allergy-tint px-4 py-3 text-sm font-medium text-allergy-ink">
          {error}
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
              onClick={() => { if (mediclaimId.trim()) { setError(null); setStep('configure') } else setError('Please enter a Mediclaim ID.') }}
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
              <button onClick={() => setStep('search')} className="text-sm text-brand hover:underline font-semibold">Change</button>
            </div>

            <div className="grid gap-5">
              {/* Scope */}
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

              {/* Duration */}
              <Field label="Access duration" htmlFor="req-duration">
                <select id="req-duration" className={select} value={duration} onChange={(e) => setDuration(e.target.value)}>
                  {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </Field>

              {/* Purpose */}
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
                <button onClick={handleSubmit} disabled={loading} className={`${button('primary', 'md')} gap-2`}>
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
  )
}

