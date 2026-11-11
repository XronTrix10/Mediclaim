import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { button, input } from '../lib/ui'

interface FormProps {
  onSwitch: () => void
  onSuccess: () => void
}

export function LoginForm({ onSwitch, onSuccess }: FormProps) {
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    // TODO: call POST /api/v1/auth/login, store the token, then navigate.
    onSuccess()
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your Mediclaim ID."
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
      <form className="mt-7 grid gap-4.5" onSubmit={onSubmit}>
        <Field label="Mediclaim ID" htmlFor="id">
          <input
            id="id"
            className={input}
            inputMode="numeric"
            autoComplete="username"
            placeholder="0000 0000 0000"
            required
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          aside={
            <a className="text-sm font-semibold text-brand hover:underline hover:underline-offset-4" href="#forgot">
              Forgot password?
            </a>
          }
        >
          <input id="password" type="password" className={input} autoComplete="current-password" required />
        </Field>
        <button className={`${button('primary', 'lg')} w-full`} type="submit">
          Sign in
        </button>
        <div className="flex items-center gap-3.5 text-sm text-ink-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
          or
        </div>
        <button className={`${button('ghost', 'lg')} w-full`} type="button">
          Get a one-time code by SMS
        </button>
      </form>
    </AuthShell>
  )
}

export function RegisterForm({ onSwitch, onSuccess }: FormProps) {
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    // TODO: call POST /api/v1/auth/register, then send the user to OTP verification.
    onSuccess()
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
      <form className="mt-7 grid gap-4.5" onSubmit={onSubmit}>
        <Field label="Full name" htmlFor="name">
          <input id="name" className={input} autoComplete="name" required />
        </Field>
        <div className="grid gap-4.5 sm:grid-cols-2">
          <Field label="Date of birth" htmlFor="dob">
            <input id="dob" type="date" className={input} autoComplete="bday" required />
          </Field>
          <Field label="Mobile number" htmlFor="phone">
            <input id="phone" type="tel" className={input} autoComplete="tel" placeholder="+91" required />
          </Field>
        </div>
        <Field label="Aadhaar number" htmlFor="aadhaar" hint="Your 12-digit Aadhaar number.">
          <input
            id="aadhaar"
            className={input}
            inputMode="numeric"
            maxLength={12}
            placeholder="0000 0000 0000"
            required
          />
        </Field>
        <Field label="Password" htmlFor="new-password" hint="At least 10 characters.">
          <input
            id="new-password"
            type="password"
            className={input}
            autoComplete="new-password"
            minLength={10}
            required
          />
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-ink-soft">
          <input type="checkbox" className="mt-0.5 size-4.5 accent-brand" required />
          <span>I agree to the Terms of Use and the Privacy Policy.</span>
        </label>
        <button className={`${button('primary', 'lg')} w-full`} type="submit">
          Create account
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

