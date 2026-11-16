import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { button, input } from '../lib/ui'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'

interface FormProps {
  onSwitch: () => void
  onSuccess: () => void
}

export function LoginForm({ onSwitch, onSuccess }: FormProps) {
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
    if (!mediclaimId.trim()) {
      setError('Please enter your Mediclaim ID first.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await authApi.requestOtp(mediclaimId.trim())
      setMaskedPhone(res.maskedPhone)
      setOtpSent(true)
      if (res.debugOtp) {
        setDebugOtp(res.debugOtp)
      }
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Could not send verification code.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.login({ mediclaimId: mediclaimId.trim(), otp: otp.trim() })
      onSuccess()
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_PENDING_APPROVAL') {
        setError('Your account is awaiting administrator verification. Once approved, your Mediclaim ID will be sent via SMS/email so you can sign in.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Invalid verification code.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={useOtp ? 'Sign in with a one-time code sent to your phone.' : 'Sign in with your Mediclaim ID.'}
      footer={
        <>
          New to Mediclaim?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="cursor-pointer font-semibold text-brand hover:underline hover:underline-offset-4"
          >
            Create an account
          </button>
        </>
      }
    >
      {error && (
        <div role="alert" className="mt-4 rounded-xl bg-allergy-tint p-3 text-sm font-medium text-allergy-ink">
          {error}
        </div>
      )}

      {!useOtp ? (
        <form className="mt-7 grid gap-4.5" onSubmit={handlePasswordSubmit}>
          <Field label="Mediclaim ID" htmlFor="id">
            <input
              id="id"
              className={input}
              inputMode="numeric"
              autoComplete="username"
              placeholder="0000 0000 0000"
              value={mediclaimId}
              onChange={(e) => setMediclaimId(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            aside={
              <button
                type="button"
                onClick={() => setUseOtp(true)}
                className="text-sm font-semibold text-brand hover:underline hover:underline-offset-4"
              >
                Sign in with OTP
              </button>
            }
          >
            <input
              id="password"
              type="password"
              className={input}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div className="flex items-center gap-3.5 text-sm text-ink-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            or
          </div>
          <button
            className={`${button('ghost', 'lg')} w-full`}
            type="button"
            onClick={() => {
              setUseOtp(true)
              setError(null)
            }}
          >
            Get a one-time code by SMS
          </button>
        </form>
      ) : (
        <div className="mt-7 grid gap-4.5">
          <Field label="Mediclaim ID" htmlFor="id">
            <input
              id="id"
              className={input}
              inputMode="numeric"
              autoComplete="username"
              placeholder="0000 0000 0000"
              value={mediclaimId}
              onChange={(e) => setMediclaimId(e.target.value)}
              required
            />
          </Field>

          {!otpSent ? (
            <button
              className={`${button('primary', 'lg')} w-full`}
              type="button"
              onClick={handleRequestOtp}
              disabled={loading}
            >
              {loading ? 'Sending code...' : 'Send SMS code'}
            </button>
          ) : (
            <form onSubmit={handleOtpSubmit} className="grid gap-4.5">
              <p className="text-sm text-ink-soft">
                Code sent to <span className="font-semibold text-ink">{maskedPhone}</span>.
                {debugOtp && <span className="ml-2 font-mono text-xs text-brand font-bold">(OTP: {debugOtp})</span>}
              </p>
              <Field label="6-digit verification code" htmlFor="otp">
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className={input}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  autoFocus
                  required
                />
              </Field>
              <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify and sign in'}
              </button>
              <button
                type="button"
                onClick={handleRequestOtp}
                className="text-sm font-semibold text-brand hover:underline"
              >
                Resend code
              </button>
            </form>
          )}

          <div className="flex items-center gap-3.5 text-sm text-ink-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            or
          </div>
          <button
            className={`${button('ghost', 'lg')} w-full`}
            type="button"
            onClick={() => {
              setUseOtp(false)
              setOtpSent(false)
              setError(null)
            }}
          >
            Sign in with password instead
          </button>
        </div>
      )}
    </AuthShell>
  )
}

export function RegisterForm({ onSwitch }: FormProps) {
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)

  // OTP Verification state
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false)
  const [otp, setOtp] = useState('')
  const [debugOtp, setDebugOtp] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setError(null)

    // Format phone to E.164 if +91 prefix is omitted
    let formattedPhone = phone.trim()
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+91${formattedPhone.replace(/^0+/, '')}`
    }

    setLoading(true)
    try {
      const res = await authApi.register({
        fullName: fullName.trim(),
        dateOfBirth,
        phone: formattedPhone,
        aadhaarNumber: aadhaarNumber.replace(/\s+/g, ''),
        password,
      })
      setPendingUserId(res.userId)
      if (res.debugOtp) {
        setDebugOtp(res.debugOtp)
      }
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please check your details.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    if (!pendingUserId) return
    setError(null)
    setLoading(true)
    try {
      await authApi.verifyOtp(pendingUserId, otp.trim())
      setIsAwaitingApproval(true)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Invalid verification code.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!pendingUserId) return
    setError(null)
    try {
      const res = await authApi.resendOtp(pendingUserId)
      if (res.debugOtp) {
        setDebugOtp(res.debugOtp)
      }
    } catch (err: any) {
      setError('Could not resend OTP.')
    }
  }

  if (isAwaitingApproval) {
    return (
      <AuthShell
        title="Account Submitted"
        subtitle="Your mobile number has been verified successfully."
        footer={
          <>
            Already have your ID?{' '}
            <button
              type="button"
              onClick={onSwitch}
              className="cursor-pointer font-semibold text-brand hover:underline hover:underline-offset-4"
            >
              Sign in
            </button>
          </>
        }
      >
        <div className="mt-6 grid gap-5">
          <div className="rounded-[20px] border border-line bg-mist/60 p-5 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
              </svg>
            </div>
            <h3 className="mt-3 text-base font-semibold text-ink">Awaiting Admin Verification</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Please wait until an administrator verifies your account with all your details.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Once approved, you will receive your <strong className="font-semibold text-ink">Mediclaim ID</strong> via email or SMS. You can then use your Mediclaim ID to sign in.
            </p>
          </div>

          <button
            type="button"
            onClick={onSwitch}
            className={`${button('primary', 'lg')} w-full`}
          >
            Back to Sign in
          </button>
        </div>
      </AuthShell>
    )
  }

  if (pendingUserId) {
    return (
      <AuthShell
        title="Verify your number"
        subtitle={`We sent a 6-digit code to ${phone}. Enter it below to verify your account.`}
        footer={
          <>
            Entered the wrong phone?{' '}
            <button
              type="button"
              onClick={() => {
                setPendingUserId(null)
                setError(null)
              }}
              className="cursor-pointer font-semibold text-brand hover:underline"
            >
              Start over
            </button>
          </>
        }
      >
        {error && (
          <div role="alert" className="mt-4 rounded-xl bg-allergy-tint p-3 text-sm font-medium text-allergy-ink">
            {error}
          </div>
        )}

        {debugOtp && (
          <div className="mt-3 rounded-lg bg-brand-tint px-3 py-2 text-center text-xs text-brand-deep font-mono font-medium">
            Dev Mode OTP: <strong>{debugOtp}</strong>
          </div>
        )}

        <form className="mt-6 grid gap-4.5" onSubmit={handleVerifyOtp}>
          <Field label="6-digit verification code" htmlFor="reg-otp">
            <input
              id="reg-otp"
              className={input}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>
            {loading ? 'Verifying code...' : 'Verify mobile number'}
          </button>
          <button
            type="button"
            onClick={handleResend}
            className="text-center text-sm font-semibold text-brand hover:underline"
          >
            Resend verification code
          </button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="We will send a one-time code to your mobile number to verify it."
      footer={
        <>
          Already registered?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="cursor-pointer font-semibold text-brand hover:underline hover:underline-offset-4"
          >
            Sign in
          </button>
        </>
      }
    >
      {error && (
        <div role="alert" className="mt-4 rounded-xl bg-allergy-tint p-3 text-sm font-medium text-allergy-ink">
          {error}
        </div>
      )}

      <form className="mt-7 grid gap-4.5" onSubmit={handleRegister}>
        <Field label="Full name" htmlFor="name">
          <input
            id="name"
            className={input}
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Aarav Sharma"
            required
          />
        </Field>
        <div className="grid gap-4.5 sm:grid-cols-2">
          <Field label="Date of birth" htmlFor="dob">
            <input
              id="dob"
              type="date"
              className={input}
              autoComplete="bday"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              required
            />
          </Field>
          <Field label="Mobile number" htmlFor="phone">
            <input
              id="phone"
              type="tel"
              className={input}
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Aadhaar number" htmlFor="aadhaar" hint="Your 12-digit Aadhaar number.">
          <input
            id="aadhaar"
            className={input}
            inputMode="numeric"
            maxLength={14}
            placeholder="0000 0000 0000"
            value={aadhaarNumber}
            onChange={(e) => setAadhaarNumber(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" htmlFor="new-password" hint="At least 8 characters.">
          <input
            id="new-password"
            type="password"
            className={input}
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-ink-soft cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 size-4.5 accent-brand"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
          />
          <span>I agree to the Terms of Use and the Privacy Policy.</span>
        </label>
        <button className={`${button('primary', 'lg')} w-full`} type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'register' ? 'register' : 'login'
  const navigate = useNavigate()

  const setMode = (nextMode: 'login' | 'register') => {
    setSearchParams(nextMode === 'register' ? { mode: 'register' } : {})
  }

  return mode === 'login' ? (
    <LoginForm onSwitch={() => setMode('register')} onSuccess={() => navigate('/app')} />
  ) : (
    <RegisterForm onSwitch={() => setMode('login')} onSuccess={() => navigate('/app')} />
  )
}
