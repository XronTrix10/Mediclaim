import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import type { IconName } from './Icon'
import Logo from './Logo'

const reassurance: { icon: IconName; title: string; body: string }[] = [
  { icon: 'lock', title: 'Encrypted records', body: 'Your records are encrypted before they are stored.' },
  { icon: 'clock', title: 'Access that expires', body: 'Doctors see only what you share, and only for a few hours.' },
  { icon: 'shield', title: 'Every view is logged', body: 'You can always see who opened your records and when.' },
]

interface AuthShellProps {
  title: string
  subtitle: string
  footer: ReactNode
  children: ReactNode
}

export default function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:p-4">
      <div className="flex flex-col px-6 pt-5 pb-10 lg:px-12 lg:pt-4 lg:pb-8">
        <Link to="/" aria-label="Mediclaim home" className="w-fit">
          <Logo />
        </Link>
        <div className="m-auto w-[min(440px,100%)] py-8">
          <h1 className="mb-2.5 text-4xl">{title}</h1>
          <p className="text-ink-faint">{subtitle}</p>
          {children}
          <p className="mt-7 text-center text-[0.95rem] text-ink-soft [&_a]:font-semibold [&_a]:text-brand [&_a:hover]:underline [&_a:hover]:underline-offset-4">
            {footer}
          </p>
        </div>
      </div>

      <aside className="hidden flex-col justify-center gap-8 rounded-[2.25rem] bg-mist p-14 lg:flex">
        <h2 className="text-[clamp(2rem,3vw,2.6rem)]">Your records stay yours.</h2>
        <ul className="grid gap-5.5">
          {reassurance.map((item) => (
            <li key={item.title} className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-white text-brand">
                <Icon name={item.icon} size={20} />
              </span>
              <div>
                <strong className="block font-semibold">{item.title}</strong>
                <p className="text-[0.95rem] text-ink-soft">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
