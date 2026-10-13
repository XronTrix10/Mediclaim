import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import type { IconName } from '../components/Icon'
import HealthGraph from '../components/HealthGraph'
import { button, lead, wrap } from '../lib/ui'

const heroPoints: { icon: IconName; text: string }[] = [
  { icon: 'lock', text: 'Every record is encrypted before it is stored' },
  { icon: 'clock', text: 'Doctors get access for a few hours, then it ends' },
  { icon: 'shield', text: 'Every view of your records is logged' },
]

const steps = [
  { title: 'A doctor asks', body: 'They request access using your Mediclame ID.' },
  { title: 'You decide', body: 'Approve the request and choose which records they can see.' },
  { title: 'They see only that', body: 'Your doctor gets the relevant records, not your full history.' },
  { title: 'Access ends', body: 'It closes on its own after the time you set, and the visit is logged.' },
]

const audiences: { title: string; intro: string; points: string[] }[] = [
  {
    title: 'You',
    intro: 'The full picture, always.',
    points: ['Your whole timeline, from birth', 'Prescriptions, reports and vaccinations', 'Who viewed what, and when'],
  },
  {
    title: 'Your doctors',
    intro: 'Only what a visit needs.',
    points: ['Records you choose to share', 'Access for a few hours', 'No view of your wider history'],
  },
  {
    title: 'Authorised hospitals',
    intro: 'Full access, under oversight.',
    points: [
      'Government and government-approved only',
      'Every view is recorded in the audit log',
      'Emergency access is reviewed afterwards',
    ],
  },
]

const sample: { kind: 'allergy' | 'condition' | 'vaccination'; text: string; when: string }[] = [
  { kind: 'vaccination', text: 'Tdap booster', when: 'Sep 2026' },
  { kind: 'condition', text: 'Asthma, mild and persistent', when: 'Oct 2022' },
  { kind: 'allergy', text: 'Penicillin allergy', when: 'Aug 2003' },
]

const sectionHead = 'mb-11 max-w-160'
const h2 = 'text-[clamp(1.9rem,3.2vw,2.6rem)]'

export default function Landing() {
  return (
    <main>
      <section className={`${wrap} grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:pt-18 lg:pb-22`}>
        <div>
          <h1 className="mb-5.5 text-[clamp(2.6rem,5.2vw,4.2rem)] leading-[1.04]">
            Your whole health story, in one calm place.
          </h1>
          <p className={lead}>
            Mediclame keeps every record, medicine and vaccination from birth in a private timeline. You choose which
            doctor sees what, and for how long.
          </p>
          <div className="mt-8 mb-9 flex flex-wrap gap-3">
            <Link className={button('primary', 'lg')} to="/register">
              Create your account
            </Link>
            <Link className={button('ghost', 'lg')} to="/login">
              Sign in
            </Link>
          </div>
          <ul className="grid gap-3 text-[0.95rem] text-ink-soft">
            {heroPoints.map((p) => (
              <li key={p.text} className="flex items-center gap-3">
                <span className="grid size-7.5 shrink-0 place-items-center rounded-[10px] bg-brand-tint text-brand">
                  <Icon name={p.icon} size={16} />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        <figure className="rounded-[2.25rem] bg-mist px-4 pt-5 pb-4.5">
          <HealthGraph compact leaves={2} />
          <figcaption className="mt-1.5 text-center text-sm text-ink-faint">
            A sample health graph. Each branch opens into full details.
          </figcaption>
        </figure>
      </section>

      <section className="scroll-mt-20 py-14 md:py-22" id="features">
        <div className={wrap}>
          <div className={sectionHead}>
            <h2 className={`mb-3.5 ${h2}`}>Built around how health records are really used</h2>
            <p className={lead}>One place for the past, and a clear view for the next appointment.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-6 [&_h3]:mb-2.5 [&_h3]:text-2xl [&_p]:text-ink-soft">
            <article className="rounded-[2.25rem] bg-mist p-9 md:col-span-3 md:row-span-2">
              <h3>A timeline from birth</h3>
              <p>
                Conditions, medicines, vaccinations, allergies and reports sit on one line, so nothing gets lost
                between doctors or cities.
              </p>
              <ul className="mt-7 grid gap-2.5">
                {sample.map((s) => (
                  <li
                    key={s.text}
                    data-kind={s.kind}
                    className="flex items-center gap-3 rounded-[18px] bg-white px-4.5 py-3.5 font-medium"
                  >
                    <i className="size-2.5 shrink-0 rounded-full bg-(--k)" />
                    <span className="flex-1">{s.text}</span>
                    <small className="text-sm font-normal text-ink-faint">{s.when}</small>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[26px] border border-line p-7 md:col-span-3">
              <h3>Add your old paperwork</h3>
              <p>Upload past prescriptions and reports. You review the details we read before they are saved.</p>
            </article>

            <article className="rounded-[26px] bg-brand-tint p-7 md:col-span-3">
              <h3>Ask for corrections</h3>
              <p>Found a mistake? Send a correction request. The original stays in your history.</p>
            </article>

            <article className="flex flex-col items-start gap-6 rounded-[26px] border border-line px-8 py-7 md:col-span-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h3>Download your history any time</h3>
                <p>Take your records with you in a standard format, whichever doctor you see next.</p>
              </div>
              <Link className={button('soft')} to="/register">
                Get started
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="scroll-mt-20 pb-14 md:pb-22" id="access">
        <div className={wrap}>
          <div className={sectionHead}>
            <h2 className={h2}>Doctors see what they need, then access ends</h2>
          </div>
          <ol className="grid gap-6 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="relative pl-14.5 lg:pt-14.5 lg:pl-0">
                <span className="absolute top-0 left-0 grid size-10 place-items-center rounded-full bg-brand font-semibold text-white">
                  {i + 1}
                </span>
                {i < steps.length - 1 && (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute top-11 -bottom-5 left-4.75 w-0.5 rounded-full bg-line-strong lg:hidden"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute top-4.75 left-13.5 -right-3 hidden h-0.5 rounded-full bg-line-strong lg:block"
                    />
                  </>
                )}
                <h3 className="mb-1.5 text-[1.3rem]">{s.title}</h3>
                <p className="text-[0.96rem] text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="scroll-mt-20 pb-14 md:pb-22" id="privacy">
        <div className={wrap}>
          <div className={sectionHead}>
            <h2 className={h2}>Who can see what</h2>
          </div>
          <div className="grid overflow-hidden rounded-[2.25rem] bg-mist md:grid-cols-3">
            {audiences.map((a) => (
              <div key={a.title} className="border-line-strong p-9 not-first:border-t md:not-first:border-t-0 md:not-first:border-l">
                <h3 className="mb-1 text-2xl">{a.title}</h3>
                <p className="text-ink-faint">{a.intro}</p>
                <ul className="mt-5 grid gap-3 text-ink-soft">
                  {a.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5">
                      <Icon name="check" size={18} className="mt-0.75 text-brand" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${wrap} pb-14 md:pb-22`}>
        <div className="flex flex-col items-start justify-between gap-8 rounded-[2.25rem] bg-brand-tint px-7 py-9 md:flex-row md:items-center md:px-14 md:py-13">
          <div>
            <h2 className="mb-2 text-[clamp(1.8rem,3vw,2.4rem)]">Start your timeline today</h2>
            <p className={lead}>Create an account with your Mediclame ID and your mobile number.</p>
          </div>
          <Link className={`${button('primary', 'lg')} shrink-0`} to="/register">
            Create your account
          </Link>
        </div>
      </section>
    </main>
  )
}
