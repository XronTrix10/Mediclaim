import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import AuthShell from '../../components/AuthShell'
import Field from '../../components/Field'
import Icon from '../../components/Icon'
import { button, input } from '../../lib/ui'
import { authApi } from '../../api/auth'
import { ApiError } from '../../api/client'

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from || '/admin'

  const [username, setUsername] = useState('admin@mediclaim.gov.in')
  const [password, setPassword] = useState('Admin@123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function fillDefaultCredentials() {
    setUsername('admin@mediclaim.gov.in')
    setPassword('Admin@123')
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await authApi.adminLogin({
        username: username.trim(),
        password,
      })
      navigate(from, { replace: true })
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message || 'Invalid administrator credentials.')
      } else {
        setError('Unable to authenticate as administrator. Check backend service.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Administrator Portal"
      subtitle="Authorized government and hospital administrators only."
      footer={
        <>
          Patient or doctor account?{' '}
          <Link to="/auth" className="cursor-pointer font-semibold text-brand hover:underline hover:underline-offset-4">
            Return to User Sign In
          </Link>
        </>
      }
    >
      {/* Quick credentials hint banner */}
      <div className="mt-5 rounded-2xl border border-brand/20 bg-brand-tint/60 p-4 text-xs sm:text-sm text-brand-deep">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="font-semibold block flex items-center gap-1.5">
              <Icon name="shield" size={16} />
              Fixed Default Credentials (Dev / Admin)
            </span>
            <div className="font-mono text-xs text-ink-soft">
              Email: <span className="font-semibold text-ink">admin@mediclaim.gov.in</span>
              <br />
              Password: <span className="font-semibold text-ink">Admin@123</span>
            </div>
          </div>
          <button
            type="button"
            onClick={fillDefaultCredentials}
            className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-brand shadow-xs hover:bg-mist cursor-pointer"
          >
            Auto Fill
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-center gap-2.5 rounded-xl bg-allergy-tint p-3 text-sm font-medium text-allergy-ink">
          <Icon name="alert" size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form className="mt-6 grid gap-4.5" onSubmit={handleSubmit}>
        <Field label="Admin Username or Email" htmlFor="admin-username">
          <input
            id="admin-username"
            type="text"
            className={input}
            autoComplete="username"
            placeholder="admin@mediclaim.gov.in"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            data-autofocus
          />
        </Field>

        <Field label="Password" htmlFor="admin-password">
          <input
            id="admin-password"
            type="password"
            className={input}
            autoComplete="current-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <div className="mt-2">
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className={`${button('primary', 'lg')} w-full cursor-pointer justify-center`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in…
              </span>
            ) : (
              'Sign In as Administrator'
            )}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}
