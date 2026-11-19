import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { button, input, select } from '../lib/ui'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'

// ─── Types ─────────────────────────────────────────────────────
type UserKind = 'patient' | 'doctor' | 'hospital'
type AuthMode = 'login' | 'register'

interface FormProps {
  onSwitch: () => void
  onSuccess: () => void
}

// ─── Shared error banner ───────────────────────────────────────
function ErrorBanner({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <div role="alert" className="mt-4 rounded-xl bg-allergy-tint p-3 text-sm font-medium text-allergy-ink">
      {msg}
    </div>
  )
}

// ─── User-kind selector step ──────────────────────────────────
interface KindCardProps {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  description: string
}
function KindCard({ selected, onClick, icon, label, description }: KindCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-[20px] border-2 p-5 text-center transition-all cursor-pointer ${
        selected
          ? 'border-brand bg-brand-tint text-brand-deep'
          : 'border-line bg-white text-ink-soft hover:border-brand/50'
      }`}
    >
      <span className={`flex size-12 items-center justify-center rounded-full ${selected ? 'bg-brand text-white' : 'bg-mist text-ink-soft'}`}>
        {icon}
      </span>
      <strong className="text-[0.95rem] font-semibold">{label}</strong>
      <span className="text-xs leading-snug">{description}</span>
    </button>
  )
}

// ─── PATIENT LOGIN ─────────────────────────────────────────────
function PatientLoginForm({ onSwitch, onSuccess }: FormProps) {
  const [useOtp, setUseOtp] = useState(false)
  const [mediclaimId, setMediclaimId] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState('')
  const [debugOtp, setDebugOtp] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.login({ mediclaimId: mediclaimId.trim(), password })
      onSuccess()
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_PENDING_APPROVAL') {
        setError('Your account is awaiting administrator verification. Once approved, your Mediclaim ID will be sent via SMS/email so you can sign in.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Sign in failed. Check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestOtp() {
    if (!mediclaimId.trim()) { setError('Please enter your Mediclaim ID first.'); return }
    setError(null); setLoading(true)
    try {
      const res = await authApi.requestOtp(mediclaimId.trim())
      setMaskedPhone(res.maskedPhone); setOtpSent(true)
      if (res.debugOtp) setDebugOtp(res.debugOtp)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Could not send verification code.')
    } finally { setLoading(false) }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      await authApi.login({ mediclaimId: mediclaimId.trim(), otp: otp.trim() })
      onSuccess()
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_PENDING_APPROVAL') {
        setError('Your account is awaiting administrator verification.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Invalid verification code.')
      }
    } finally { setLoading(false) }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={useOtp ? 'Sign in with a one-time code sent to your phone.' : 'Sign in with your Mediclaim ID.'}
      footer={<>New to Mediclaim?{' '}<button type="button" onClick={onSwitch} className="cursor-pointer font-semibold text-brand hover:underline hover:underline-offset-4">Create an account</button></>}
    >
      <ErrorBanner msg={error} />

      {!useOtp ? (
        <form className="mt-7 grid gap-4.5" onSubmit={handlePasswordSubmit}>
          <Field label="Mediclaim ID" htmlFor="id">
            <input id="id" className={input} inputMode="numeric" autoComplete="username" placeholder="0000 0000 0000" value={mediclaimId} onChange={(e) => setMediclaimId(e.target.value)} required />
          </Field>
          <Field label="Password" htmlFor="password" aside={<button type="button" onClick={() => setUseOtp(true)} className="text-sm font-semibold text-brand hover:underline hover:underline-offset-4">Sign in with OTP</button>}>
            <input id="password" type="password" className={input} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
          <div className="flex items-center gap-3.5 text-sm text-ink-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or</div>
          <button className={`${button('ghost', 'lg')} w-full`} type="button" onClick={() => { setUseOtp(true); setError(null) }}>Get a one-time code by SMS</button>
        </form>
      ) : (
        <div className="mt-7 grid gap-4.5">
          <Field label="Mediclaim ID" htmlFor="id">
            <input id="id" className={input} inputMode="numeric" autoComplete="username" placeholder="0000 0000 0000" value={mediclaimId} onChange={(e) => setMediclaimId(e.target.value)} required />
          </Field>
          {!otpSent ? (
            <button className={`${button('primary', 'lg')} w-full`} type="button" onClick={handleRequestOtp} disabled={loading}>{loading ? 'Sending code...' : 'Send SMS code'}</button>
          ) : (
            <form onSubmit={handleOtpSubmit} className="grid gap-4.5">
              <p className="text-sm text-ink-soft">Code sent to <span className="font-semibold text-ink">{maskedPhone}</span>.{debugOtp && <span className="ml-2 font-mono text-xs text-brand font-bold">(OTP: {debugOtp})</span>}</p>
              <Field label="6-digit verification code" htmlFor="otp">
                <input id="otp" type="text" inputMode="numeric" maxLength={6} className={input} placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value)} autoFocus required />
              </Field>
              <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify and sign in'}</button>
              <button type="button" onClick={handleRequestOtp} className="text-sm font-semibold text-brand hover:underline">Resend code</button>
            </form>
          )}
          <div className="flex items-center gap-3.5 text-sm text-ink-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or</div>
          <button className={`${button('ghost', 'lg')} w-full`} type="button" onClick={() => { setUseOtp(false); setOtpSent(false); setError(null) }}>Sign in with password instead</button>
        </div>
      )}
    </AuthShell>
  )
}

// ─── PATIENT REGISTER ──────────────────────────────────────────
function PatientRegisterForm({ onSwitch }: FormProps) {
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false)
  const [otp, setOtp] = useState('')
  const [debugOtp, setDebugOtp] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegister(e: FormEvent) {
    e.preventDefault(); setError(null)
    let formattedPhone = phone.trim()
    if (!formattedPhone.startsWith('+')) formattedPhone = `+91${formattedPhone.replace(/^0+/, '')}`
    setLoading(true)
    try {
      const res = await authApi.register({ fullName: fullName.trim(), dateOfBirth, phone: formattedPhone, aadhaarNumber: aadhaarNumber.replace(/\s+/g, ''), password })
      setPendingUserId(res.userId)
      if (res.debugOtp) setDebugOtp(res.debugOtp)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please check your details.')
    } finally { setLoading(false) }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    if (!pendingUserId) return
    setError(null); setLoading(true)
    try { await authApi.verifyOtp(pendingUserId, otp.trim()); setIsAwaitingApproval(true) }
    catch (err: any) { setError(err instanceof ApiError ? err.message : 'Invalid verification code.') }
    finally { setLoading(false) }
  }

  async function handleResend() {
    if (!pendingUserId) return; setError(null)
    try { const res = await authApi.resendOtp(pendingUserId); if (res.debugOtp) setDebugOtp(res.debugOtp) }
    catch { setError('Could not resend OTP.') }
  }

  if (isAwaitingApproval) {
    return (
      <AuthShell title="Account Submitted" subtitle="Your mobile number has been verified successfully." footer={<>Already have your ID?{' '}<button type="button" onClick={onSwitch} className="cursor-pointer font-semibold text-brand hover:underline hover:underline-offset-4">Sign in</button></>}>
        <div className="mt-6 grid gap-5">
          <div className="rounded-[20px] border border-line bg-mist/60 p-5 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>
            </div>
            <h3 className="mt-3 text-base font-semibold text-ink">Awaiting Admin Verification</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">Please wait until an administrator verifies your account with all your details.</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">Once approved, you will receive your <strong className="font-semibold text-ink">Mediclaim ID</strong> via email or SMS.</p>
          </div>
          <button type="button" onClick={onSwitch} className={`${button('primary', 'lg')} w-full`}>Back to Sign in</button>
        </div>
      </AuthShell>
    )
  }

  if (pendingUserId) {
    return (
      <AuthShell title="Verify your number" subtitle={`We sent a 6-digit code to ${phone}.`} footer={<>Entered the wrong phone?{' '}<button type="button" onClick={() => { setPendingUserId(null); setError(null) }} className="cursor-pointer font-semibold text-brand hover:underline">Start over</button></>}>
        <ErrorBanner msg={error} />
        {debugOtp && <div className="mt-3 rounded-lg bg-brand-tint px-3 py-2 text-center text-xs text-brand-deep font-mono font-medium">Dev Mode OTP: <strong>{debugOtp}</strong></div>}
        <form className="mt-6 grid gap-4.5" onSubmit={handleVerifyOtp}>
          <Field label="6-digit verification code" htmlFor="reg-otp">
            <input id="reg-otp" className={input} inputMode="numeric" maxLength={6} placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value)} autoFocus required />
          </Field>
          <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>{loading ? 'Verifying code...' : 'Verify mobile number'}</button>
          <button type="button" onClick={handleResend} className="text-center text-sm font-semibold text-brand hover:underline">Resend verification code</button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create your account" subtitle="We will send a one-time code to your mobile number to verify it." footer={<>Already registered?{' '}<button type="button" onClick={onSwitch} className="cursor-pointer font-semibold text-brand hover:underline hover:underline-offset-4">Sign in</button></>}>
      <ErrorBanner msg={error} />
      <form className="mt-7 grid gap-4.5" onSubmit={handleRegister}>
        <Field label="Full name" htmlFor="name"><input id="name" className={input} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aarav Sharma" required /></Field>
        <div className="grid gap-4.5 sm:grid-cols-2">
          <Field label="Date of birth" htmlFor="dob"><input id="dob" type="date" className={input} autoComplete="bday" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required /></Field>
          <Field label="Mobile number" htmlFor="phone"><input id="phone" type="tel" className={input} autoComplete="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
        </div>
        <Field label="Aadhaar number" htmlFor="aadhaar" hint="Your 12-digit Aadhaar number."><input id="aadhaar" className={input} inputMode="numeric" maxLength={14} placeholder="0000 0000 0000" value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value)} required /></Field>
        <Field label="Password" htmlFor="new-password" hint="At least 8 characters."><input id="new-password" type="password" className={input} autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <label className="flex items-start gap-2.5 text-sm text-ink-soft cursor-pointer">
          <input type="checkbox" className="mt-0.5 size-4.5 accent-brand" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
          <span>I agree to the Terms of Use and the Privacy Policy.</span>
        </label>
        <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
      </form>
    </AuthShell>
  )
}

// ─── DOCTOR LOGIN ──────────────────────────────────────────────
function DoctorLoginForm({ onSwitch, onSuccess }: FormProps) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState('')
  const [debugOtp, setDebugOtp] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRequestOtp() {
    if (!phone.trim()) { setError('Please enter your registered phone number.'); return }
    setError(null); setLoading(true)
    let formattedPhone = phone.trim()
    if (!formattedPhone.startsWith('+')) formattedPhone = `+91${formattedPhone.replace(/^0+/, '')}`
    try {
      const res = await authApi.doctorRequestOtp({ phone: formattedPhone })
      setMaskedPhone(res.maskedPhone); setOtpSent(true)
      if (res.debugOtp) setDebugOtp(res.debugOtp)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Could not send verification code.')
    } finally { setLoading(false) }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    let formattedPhone = phone.trim()
    if (!formattedPhone.startsWith('+')) formattedPhone = `+91${formattedPhone.replace(/^0+/, '')}`
    try {
      await authApi.doctorVerifyOtp({ phone: formattedPhone, otp: otp.trim() })
      onSuccess()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Invalid verification code.')
    } finally { setLoading(false) }
  }

  return (
    <AuthShell
      title="Doctor sign in"
      subtitle="Sign in with your registered phone number."
      footer={<>New doctor?{' '}<button type="button" onClick={onSwitch} className="cursor-pointer font-semibold text-brand hover:underline hover:underline-offset-4">Register here</button></>}
    >
      <ErrorBanner msg={error} />
      <div className="mt-7 grid gap-4.5">
        <Field label="Registered mobile number" htmlFor="doc-phone">
          <input id="doc-phone" type="tel" className={input} autoComplete="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={otpSent} required />
        </Field>
        {!otpSent ? (
          <button className={`${button('primary', 'lg')} w-full`} type="button" onClick={handleRequestOtp} disabled={loading}>{loading ? 'Sending code...' : 'Send verification code'}</button>
        ) : (
          <form onSubmit={handleOtpSubmit} className="grid gap-4.5">
            <p className="text-sm text-ink-soft">Code sent to <span className="font-semibold text-ink">{maskedPhone}</span>.{debugOtp && <span className="ml-2 font-mono text-xs text-brand font-bold">(OTP: {debugOtp})</span>}</p>
            <Field label="6-digit verification code" htmlFor="doc-otp">
              <input id="doc-otp" type="text" inputMode="numeric" maxLength={6} className={input} placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value)} autoFocus required />
            </Field>
            <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify and sign in'}</button>
            <button type="button" onClick={handleRequestOtp} className="text-sm font-semibold text-brand hover:underline">Resend code</button>
          </form>
        )}
      </div>
    </AuthShell>
  )
}

// ─── DOCTOR REGISTER ───────────────────────────────────────────
const SPECIALIZATIONS = [
  'General Physician', 'Cardiologist', 'Pulmonologist', 'Dermatologist',
  'Neurologist', 'Orthopedic', 'Pediatrician', 'Gynecologist', 'Oncologist',
  'Psychiatrist', 'Ophthalmologist', 'ENT Specialist', 'Other',
]

function DoctorRegisterForm({ onSwitch, onSuccess }: FormProps) {
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [password, setPassword] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [yearsExp, setYearsExp] = useState('')
  const [hospitalName, setHospitalName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setLoading(true)
    let formattedPhone = phone.trim()
    if (!formattedPhone.startsWith('+')) formattedPhone = `+91${formattedPhone.replace(/^0+/, '')}`
    try {
      await authApi.registerDoctor({
        fullName: fullName.trim(), dateOfBirth, phone: formattedPhone,
        aadhaarNumber: aadhaarNumber.replace(/\s+/g, ''), password,
        medicalLicenseNumber: licenseNumber.trim(), specialization,
        yearsOfExperience: yearsExp ? parseInt(yearsExp, 10) : undefined,
        hospitalName: hospitalName.trim() || undefined,
      })
      setRegistered(true)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please check your details.')
    } finally { setLoading(false) }
  }

  if (registered) {
    return (
      <AuthShell title="Registration Submitted" subtitle="Your application is under review." footer={<>Ready to sign in?{' '}<button type="button" onClick={onSwitch} className="cursor-pointer font-semibold text-brand hover:underline">Sign in</button></>}>
        <div className="mt-6 rounded-[20px] border border-line bg-mist/60 p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
          </div>
          <h3 className="mt-3 text-base font-semibold text-ink">Awaiting Verification</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">An administrator will verify your medical license and credentials. You'll receive an SMS once your account is approved.</p>
        </div>
        <button type="button" onClick={onSwitch} className={`${button('primary', 'lg')} mt-5 w-full`}>Back to Sign in</button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Register as Doctor" subtitle="Create your practitioner account to manage patient records." footer={<>Already registered?{' '}<button type="button" onClick={onSwitch} className="cursor-pointer font-semibold text-brand hover:underline">Sign in</button></>}>
      <ErrorBanner msg={error} />
      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <Field label="Full name" htmlFor="d-name"><input id="d-name" className={input} autoComplete="name" placeholder="Dr. Priya Nair" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" htmlFor="d-dob"><input id="d-dob" type="date" className={input} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required /></Field>
          <Field label="Mobile number" htmlFor="d-phone"><input id="d-phone" type="tel" className={input} placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
        </div>
        <Field label="Aadhaar number" htmlFor="d-aadhaar" hint="Your 12-digit Aadhaar number."><input id="d-aadhaar" className={input} inputMode="numeric" maxLength={14} placeholder="0000 0000 0000" value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value)} required /></Field>
        <Field label="Medical license number" htmlFor="d-license" hint="As issued by the Medical Council of India or State Medical Council."><input id="d-license" className={input} placeholder="MCI-12345" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Specialization" htmlFor="d-spec">
            <select id="d-spec" className={select} value={specialization} onChange={(e) => setSpecialization(e.target.value)} required>
              <option value="">Select…</option>
              {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Years of experience" htmlFor="d-exp"><input id="d-exp" type="number" min="0" max="60" className={input} placeholder="5" value={yearsExp} onChange={(e) => setYearsExp(e.target.value)} /></Field>
        </div>
        <Field label="Hospital / Clinic (optional)" htmlFor="d-hospital"><input id="d-hospital" className={input} placeholder="Apollo Hospitals, Chennai" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} /></Field>
        <Field label="Password" htmlFor="d-pass" hint="At least 8 characters."><input id="d-pass" type="password" className={input} autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <label className="flex items-start gap-2.5 text-sm text-ink-soft cursor-pointer">
          <input type="checkbox" className="mt-0.5 size-4.5 accent-brand" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
          <span>I agree to the Terms of Use and Privacy Policy.</span>
        </label>
        <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register as Doctor'}</button>
      </form>
    </AuthShell>
  )
}

// ─── HOSPITAL LOGIN ────────────────────────────────────────────
function HospitalLoginForm({ onSwitch, onSuccess }: FormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setLoading(true)
    try {
      await authApi.hospitalLogin({ email: email.trim(), password })
      onSuccess()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed. Check your credentials.')
    } finally { setLoading(false) }
  }

  return (
    <AuthShell title="Hospital / Org sign in" subtitle="Sign in to manage patients and practitioners." footer={<>New organization?{' '}<button type="button" onClick={onSwitch} className="cursor-pointer font-semibold text-brand hover:underline">Register here</button></>}>
      <ErrorBanner msg={error} />
      <form className="mt-7 grid gap-4.5" onSubmit={handleSubmit}>
        <Field label="Email address" htmlFor="h-email"><input id="h-email" type="email" className={input} autoComplete="username email" placeholder="admin@hospital.org" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password" htmlFor="h-pass"><input id="h-pass" type="password" className={input} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </AuthShell>
  )
}

// ─── HOSPITAL REGISTER ─────────────────────────────────────────
const ORG_TYPES = ['hospital', 'clinic', 'lab', 'pharmacy']

function HospitalRegisterForm({ onSwitch }: FormProps) {
  const [name, setName] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [type, setType] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setLoading(true)
    let formattedPhone = phone.trim()
    if (!formattedPhone.startsWith('+')) formattedPhone = `+91${formattedPhone.replace(/^0+/, '')}`
    try {
      await authApi.registerHospital({ name: name.trim(), registrationNumber: regNumber.trim(), type, address: address.trim(), phone: formattedPhone, email: email.trim(), password })
      setRegistered(true)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Registration failed.')
    } finally { setLoading(false) }
  }

  if (registered) {
    return (
      <AuthShell title="Registration Submitted" subtitle="Your organization profile is under review." footer={<>Ready to sign in?{' '}<button type="button" onClick={onSwitch} className="cursor-pointer font-semibold text-brand hover:underline">Sign in</button></>}>
        <div className="mt-6 rounded-[20px] border border-line bg-mist/60 p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
          </div>
          <h3 className="mt-3 text-base font-semibold text-ink">Awaiting Admin Approval</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">An administrator will verify your registration documents and approve your account. You'll receive an email once approved.</p>
        </div>
        <button type="button" onClick={onSwitch} className={`${button('primary', 'lg')} mt-5 w-full`}>Back to Sign in</button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Register Organization" subtitle="Create your hospital or clinic account." footer={<>Already registered?{' '}<button type="button" onClick={onSwitch} className="cursor-pointer font-semibold text-brand hover:underline">Sign in</button></>}>
      <ErrorBanner msg={error} />
      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <Field label="Organization name" htmlFor="h-name"><input id="h-name" className={input} placeholder="Apollo Hospitals" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registration number" htmlFor="h-reg"><input id="h-reg" className={input} placeholder="KA-HOSP-2024-001" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} required /></Field>
          <Field label="Type" htmlFor="h-type">
            <select id="h-type" className={select} value={type} onChange={(e) => setType(e.target.value)} required>
              <option value="">Select…</option>
              {ORG_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Address" htmlFor="h-addr"><input id="h-addr" className={input} placeholder="123 MG Road, Bengaluru, KA 560001" value={address} onChange={(e) => setAddress(e.target.value)} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="h-phone"><input id="h-phone" type="tel" className={input} placeholder="+91 80 1234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
          <Field label="Email" htmlFor="h-email"><input id="h-email" type="email" className={input} placeholder="admin@hospital.org" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        </div>
        <Field label="Password" htmlFor="h-pass" hint="At least 8 characters."><input id="h-pass" type="password" className={input} autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <label className="flex items-start gap-2.5 text-sm text-ink-soft cursor-pointer">
          <input type="checkbox" className="mt-0.5 size-4.5 accent-brand" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
          <span>I agree to the Terms of Use and Privacy Policy.</span>
        </label>
        <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register Organization'}</button>
      </form>
    </AuthShell>
  )
}

// ─── KIND SELECTOR ─────────────────────────────────────────────
interface KindSelectorProps {
  kind: UserKind
  mode: AuthMode
  onKindChange: (k: UserKind) => void
  onModeChange: (m: AuthMode) => void
  onContinue: () => void
}

function KindSelector({ kind, mode, onKindChange, onModeChange, onContinue }: KindSelectorProps) {
  return (
    <AuthShell
      title={mode === 'login' ? 'Welcome back' : 'Create account'}
      subtitle="Who are you? Select your role to continue."
      footer={
        mode === 'login'
          ? <>New to Mediclaim?{' '}<button type="button" onClick={() => onModeChange('register')} className="cursor-pointer font-semibold text-brand hover:underline hover:underline-offset-4">Create an account</button></>
          : <>Already have an account?{' '}<button type="button" onClick={() => onModeChange('login')} className="cursor-pointer font-semibold text-brand hover:underline hover:underline-offset-4">Sign in</button></>
      }
    >
      <div className="mt-7 grid gap-4">
        <div className="grid grid-cols-3 gap-3">
          <KindCard
            selected={kind === 'patient'}
            onClick={() => onKindChange('patient')}
            label="Patient"
            description="Manage your health records"
            icon={
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-6 8a6 6 0 0 1 12 0" />
              </svg>
            }
          />
          <KindCard
            selected={kind === 'doctor'}
            onClick={() => onKindChange('doctor')}
            label="Doctor"
            description="Practitioner / Clinician"
            icon={
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v6a4 4 0 0 0 8 0V3M9 13v2.5a4.5 4.5 0 0 0 9 0V14M18 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
              </svg>
            }
          />
          <KindCard
            selected={kind === 'hospital'}
            onClick={() => onKindChange('hospital')}
            label="Hospital"
            description="Organization / Clinic"
            icon={
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 7l9-4 9 4M4 7v14h16V7M9 21v-6h6v6M12 7v4m-2-2h4" />
              </svg>
            }
          />
        </div>
        <button className={`${button('primary', 'lg')} w-full`} onClick={onContinue}>
          Continue as {kind === 'patient' ? 'Patient' : kind === 'doctor' ? 'Doctor' : 'Organization'}
        </button>
      </div>
    </AuthShell>
  )
}

// ─── ROOT AUTH PAGE ────────────────────────────────────────────
export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const urlMode = searchParams.get('mode') === 'register' ? 'register' : 'login'
  const urlKind = (searchParams.get('kind') as UserKind) || 'patient'

  const [step, setStep] = useState<'select' | 'form'>('select')
  const [kind, setKind] = useState<UserKind>(urlKind)
  const [mode, setMode] = useState<AuthMode>(urlMode)

  function handleContinue() {
    setStep('form')
  }

  function handleKindChange(k: UserKind) {
    setKind(k)
    setSearchParams({ ...(mode === 'register' ? { mode: 'register' } : {}), kind: k })
  }

  function handleModeChange(m: AuthMode) {
    setMode(m)
    setSearchParams({ ...(m === 'register' ? { mode: 'register' } : {}), kind })
    setStep('select')
  }

  function handleSuccess() {
    navigate('/app')
  }

  function handleSwitch() {
    handleModeChange(mode === 'login' ? 'register' : 'login')
  }

  if (step === 'select') {
    return (
      <KindSelector
        kind={kind}
        mode={mode}
        onKindChange={handleKindChange}
        onModeChange={handleModeChange}
        onContinue={handleContinue}
      />
    )
  }

  // ── Form step ──────────────────────────────────────────────
  if (kind === 'patient') {
    return mode === 'login'
      ? <PatientLoginForm onSwitch={handleSwitch} onSuccess={handleSuccess} />
      : <PatientRegisterForm onSwitch={handleSwitch} onSuccess={handleSuccess} />
  }

  if (kind === 'doctor') {
    return mode === 'login'
      ? <DoctorLoginForm onSwitch={handleSwitch} onSuccess={handleSuccess} />
      : <DoctorRegisterForm onSwitch={handleSwitch} onSuccess={handleSuccess} />
  }

  // hospital
  return mode === 'login'
    ? <HospitalLoginForm onSwitch={handleSwitch} onSuccess={handleSuccess} />
    : <HospitalRegisterForm onSwitch={handleSwitch} onSuccess={handleSuccess} />
}

// Keep named exports for compatibility
export { PatientLoginForm as LoginForm, PatientRegisterForm as RegisterForm }
