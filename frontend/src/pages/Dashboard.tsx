import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { KindBubble, KindTag } from '../components/Kind'
import { accessLog, events, initialGrants, kinds, patient, suggestions } from '../data/mock'
import type { Kind } from '../data/mock'
import { formatDate } from '../lib/format'
import { button, card, cardTitle } from '../lib/ui'

const activeOf = (kind: Kind) => events.filter((e) => e.kind === kind && e.status === 'active')

interface StatProps {
  kind: Kind
  value: number
  label: string
  note: string
}

function Stat({ kind, value, label, note }: StatProps) {
  return (
    <div className="flex items-start gap-3.5 rounded-[26px] bg-(--kt) p-5" data-kind={kind}>
      <span className="grid size-[42px] shrink-0 place-items-center rounded-[14px] bg-white text-(--ki)">
        <Icon name={kinds[kind].icon} size={20} />
      </span>
      <div>
        <strong className="block font-display text-[2.1rem] font-medium leading-none text-(--ki)">{value}</strong>
        <span className="mt-2 block text-[0.9rem] font-semibold">{label}</span>
        <small className="mt-0.5 block text-[0.82rem] leading-[1.4] text-ink-soft">{note}</small>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const allergies = activeOf('allergy')
  const medicines = activeOf('medication')
  const recent = events.slice(0, 5)

  return (
    <>
      <PageHeader title={`Welcome back, ${patient.firstName}`} subtitle="A quick look at your health records.">
        <Link className={button('ghost')} to="/app/records">
          <Icon name="download" size={18} />
          Download history
        </Link>
        <Link className={button('primary')} to="/app/records">
          <Icon name="upload" size={18} />
          Upload a record
        </Link>
      </PageHeader>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1001px]:grid-cols-4" aria-label="Summary">
        <Stat kind="allergy" value={allergies.length} label="Active allergies" note={allergies.map((a) => a.title).join(', ')} />
        <Stat kind="medication" value={medicines.length} label="Current medicines" note="Both for asthma" />
        <Stat kind="vaccination" value={1} label="Vaccination due" note="Seasonal flu, this month" />
        <Stat kind="report" value={events.length} label="Records on file" note={`Last added ${formatDate(events[0].date)}`} />
      </section>

      <div className="mb-5 grid grid-cols-1 gap-5 min-[1001px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className={card} aria-labelledby="recent-h">
          <h2 className={cardTitle} id="recent-h">
            Recent records
            <Link
              className="font-sans text-[0.92rem] font-semibold tracking-normal text-brand hover:underline hover:underline-offset-[3px]"
              to="/app/records"
            >
              See all records
            </Link>
          </h2>
          <ul>
            {recent.map((e) => (
              <li
                className="flex items-center gap-3.5 border-t border-line py-3.5 first:border-t-0 first:pt-0 last:pb-0"
                key={e.id}
                data-kind={e.kind}
              >
                <KindBubble kind={e.kind} />
                <div className="min-w-0 flex-1">
                  <strong className="block font-semibold leading-[1.35]">{e.title}</strong>
                  <small className="block text-[0.86rem] leading-[1.45] text-ink-faint">{e.provider}</small>
                </div>
                <div className="grid justify-items-end gap-1.5 text-right text-[0.85rem] text-ink-faint whitespace-normal sm:whitespace-nowrap">
                  <KindTag kind={e.kind} />
                  <div>{formatDate(e.date)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="self-start rounded-[26px] bg-brand-tint p-7" aria-labelledby="access-h">
          <h2 className={cardTitle} id="access-h">
            Who can see your records now
          </h2>
          <ul className="space-y-2.5">
            {initialGrants.map((g) => (
              <li className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-3.5" key={g.id}>
                <div className="min-w-0 flex-1">
                  <strong className="block font-semibold leading-[1.35]">{g.name}</strong>
                  <small className="block text-[0.86rem] leading-[1.45] text-ink-faint">
                    {g.scope.map((k) => kinds[k].plural.toLowerCase()).join(', ')}
                  </small>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-[11px] py-1 text-[0.85rem] font-semibold whitespace-nowrap text-brand-deep">
                  <Icon name="clock" size={15} />
                  {g.remaining}
                </span>
              </li>
            ))}
          </ul>
          <Link className={`${button('ghost')} mt-4 w-full`} to="/app/access">
            Manage access
          </Link>
        </section>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 min-[1001px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className={card} aria-labelledby="tips-h">
          <h2 className={cardTitle} id="tips-h">
            Suggestions for you
          </h2>
          <ul>
            {suggestions.map((s) => (
              <li
                className="flex items-start gap-3.5 border-t border-line py-3.5 first:border-t-0 first:pt-0 last:pb-0"
                key={s.id}
              >
                <span className="grid size-[42px] shrink-0 place-items-center rounded-[14px] bg-brand-tint text-brand-deep">
                  <Icon name={s.icon} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block font-semibold leading-[1.35]">{s.title}</strong>
                  <small className="block text-[0.86rem] leading-[1.45] text-ink-faint">{s.body}</small>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4.5 rounded-[14px] bg-mist px-4 py-3 text-[0.86rem] text-ink-soft">
            Suggestions come from your records and do not replace advice from your doctor.
          </p>
        </section>

        <section className={card} aria-labelledby="activity-h">
          <h2 className={cardTitle} id="activity-h">
            Recent activity
          </h2>
          <ul className="grid gap-4">
            {accessLog.slice(0, 4).map((l) => (
              <li key={l.id} className="flex items-start gap-3.5">
                <span className="mt-[7px] size-2.5 shrink-0 rounded-full bg-brand ring-4 ring-brand-tint" />
                <div>
                  <p className="text-[0.95rem]">
                    <strong className="font-semibold">{l.who}</strong> {l.what}
                  </p>
                  <small className="text-[0.84rem] text-ink-faint">{l.when}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
