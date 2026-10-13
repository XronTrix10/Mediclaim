import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { button, input } from '../lib/ui'

export default function Login() {
  const navigate = useNavigate()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    // TODO: call POST /api/v1/auth/login, store the token, then navigate.
    navigate('/app')
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your Mediclame ID."
      footer={
        <>
          New to Mediclame? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="mt-7 grid gap-4.5" onSubmit={onSubmit}>
        <Field label="Mediclame ID" htmlFor="id">
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
