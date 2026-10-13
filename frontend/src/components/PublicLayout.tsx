import { Link, Outlet } from 'react-router-dom'
import Logo from './Logo'
import { button, wrap } from '../lib/ui'

export default function PublicLayout() {
  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-md">
        <div className={`${wrap} flex h-18 items-center justify-between gap-6`}>
          <Link to="/" aria-label="Mediclame home">
            <Logo />
          </Link>
          <nav className="hidden gap-[30px] text-[0.95rem] font-medium text-ink-soft md:flex" aria-label="Main">
            <a className="hover:text-brand" href="#features">
              Features
            </a>
            <a className="hover:text-brand" href="#access">
              How access works
            </a>
            <a className="hover:text-brand" href="#privacy">
              Who sees what
            </a>
          </nav>
          <div className="flex gap-2.5">
            <Link className={`${button('ghost', 'sm')} max-sm:hidden`} to="/login">
              Sign in
            </Link>
            <Link className={button('primary', 'sm')} to="/register">
              Create account
            </Link>
          </div>
        </div>
      </header>

      <Outlet />

      <footer className="border-t border-line py-8 text-sm text-ink-faint">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-4`}>
          <Logo size={28} />
          <p>Built on HL7 FHIR. Your records are encrypted and every access is logged.</p>
        </div>
      </footer>
    </div>
  )
}
