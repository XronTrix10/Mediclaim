import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { button, input } from '../lib/ui'

export default function Register() {
  const navigate = useNavigate()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    // TODO: call POST /api/v1/auth/register, then send the user to OTP verification.
    navigate('/app')
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="We will send a one-time code to your mobile number to verify it."
      footer={
        <>
          Already registered? <Link to="/login">Sign in</Link>
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
        <Field label="Mediclame ID" htmlFor="mid" hint="The 12-digit ID issued to you.">
          <input id="mid" className={input} inputMode="numeric" placeholder="0000 0000 0000" required />
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
