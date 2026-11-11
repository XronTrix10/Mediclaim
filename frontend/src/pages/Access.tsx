import { useState } from 'react'
import type { FormEvent } from 'react'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { KindTag } from '../components/Kind'
import { accessLog, caregivers, initialGrants, initialRequests, kindOrder, kinds } from '../data/mock'
import { initials } from '../lib/format'
import { avatar, button, card, cardTitle, input, select } from '../lib/ui'

export default function Access() {
  const [grants, setGrants] = useState(initialGrants)
  const [requests, setRequests] = useState(initialRequests)

  const revoke = (id: string) => setGrants((g) => g.filter((x) => x.id !== id))
  const decline = (id: string) => setRequests((r) => r.filter((x) => x.id !== id))
  const approve = (id: string) => {
    const req = requests.find((r) => r.id === id)
    if (!req) return
    setGrants((g) => [
      ...g,
      { id: `g-${req.id}`, name: req.name, role: req.role, scope: req.scope, remaining: `${req.duration} left` },
    ])
    decline(id)
  }

  function onGive(e: FormEvent) {
    e.preventDefault()
    // TODO: call POST /api/v1/consent with the doctor ID, selected record types and duration.
  }

  return (
    <>
      <PageHeader
        title="Access"
        subtitle="Choose who can see your records. Doctor access always ends on its own."
      />

      <div className="mb-5 grid grid-cols-1 items-start gap-5 min-[1001px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid gap-5">
          <section className={card} aria-labelledby="active-h">
            <h2 className={cardTitle} id="active-h">
              Active access
            </h2>
            {grants.length === 0 ? (
              <div className="grid justify-items-start gap-1.5 px-2 py-7 text-ink-soft">
                <strong className="text-[1.05rem] font-semibold text-ink">No one has access right now</strong>
                <p>Doctors you approve will show up here with the time they have left.</p>
              </div>
            ) : (
              <ul>
                {grants.map((g) => (
                  <li
                    className="flex items-start gap-3.5 border-t border-line py-3.5 first:border-t-0 first:pt-0 last:pb-0"
                    key={g.id}
                  >
                    <span className={avatar}>{initials(g.name)}</span>
                    <div className="min-w-0 flex-1">
                      <strong className="block font-semibold leading-[1.35]">{g.name}</strong>
                      <small className="block text-[0.86rem] leading-[1.45] text-ink-faint">{g.role}</small>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {g.scope.map((k) => (
                          <KindTag key={k} kind={k} />
                        ))}
                      </div>
                    </div>
                    <div className="grid justify-items-end gap-1.5 text-right text-[0.85rem] text-ink-faint whitespace-normal sm:whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-[11px] py-1 text-[0.85rem] font-semibold whitespace-nowrap text-brand-deep">
                        <Icon name="clock" size={15} />
                        {g.remaining}
                      </span>
                      <button className={button('danger', 'sm')} type="button" onClick={() => revoke(g.id)}>
                        Revoke
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={card} aria-labelledby="pending-h">
            <h2 className={cardTitle} id="pending-h">
              Waiting for your approval
            </h2>
            {requests.length === 0 ? (
              <div className="grid justify-items-start gap-1.5 px-2 py-7 text-ink-soft">
                <strong className="text-[1.05rem] font-semibold text-ink">No pending requests</strong>
                <p>New requests from doctors will appear here.</p>
              </div>
            ) : (
              <ul>
                {requests.map((r) => (
                  <li
                    className="flex items-start gap-3.5 border-t border-line py-3.5 first:border-t-0 first:pt-0 last:pb-0"
                    key={r.id}
                  >
                    <span className={avatar}>{initials(r.name)}</span>
                    <div className="min-w-0 flex-1">
                      <strong className="block font-semibold leading-[1.35]">{r.name}</strong>
                      <small className="block text-[0.86rem] leading-[1.45] text-ink-faint">
                        {r.role}. Asking for {r.scope.map((k) => kinds[k].plural.toLowerCase()).join(' and ')} for{' '}
                        {r.duration}.
                      </small>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className={button('ghost', 'sm')} type="button" onClick={() => decline(r.id)}>
                        Decline
                      </button>
                      <button className={button('primary', 'sm')} type="button" onClick={() => approve(r.id)}>
                        Approve
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid gap-5">
          <section className={card} aria-labelledby="give-h">
            <h2 className={cardTitle} id="give-h">
              Give access
            </h2>
            <form className="grid gap-4.5" onSubmit={onGive}>
              <div className="grid gap-[7px]">
                <label htmlFor="doctor-id" className="text-[0.9rem] font-semibold">
                  Doctor or hospital ID
                </label>
                <input id="doctor-id" className={input} placeholder="For example, DR-204518" required />
              </div>
              <fieldset className="m-0 grid min-w-0 gap-[7px] border-0 p-0">
                <legend className="mb-[7px] p-0 text-[0.9rem] font-semibold">What can they see?</legend>
                <div className="flex flex-wrap gap-2">
                  {kindOrder.map((k) => (
                    <label className="relative cursor-pointer" data-kind={k} key={k}>
                      <input
                        type="checkbox"
                        defaultChecked={k === 'allergy' || k === 'medication'}
                        className="peer absolute inset-0 size-full cursor-pointer opacity-0"
                      />
                      <span className="inline-flex items-center rounded-full border border-line-strong bg-white px-3.5 py-[7px] text-[0.88rem] font-medium text-ink-soft transition-colors peer-checked:border-(--k) peer-checked:bg-(--kt) peer-checked:font-semibold peer-checked:text-(--ki) peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand/45">
                        {kinds[k].plural}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-[7px]">
                <label htmlFor="duration" className="text-[0.9rem] font-semibold">
                  For how long?
                </label>
                <select id="duration" className={select} defaultValue="2">
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="6">6 hours</option>
                  <option value="24">24 hours</option>
                </select>
              </div>
              <button className={`${button('primary')} w-full`} type="submit">
                Give access
              </button>
              <p className="text-[0.85rem] text-ink-faint">You can revoke access earlier at any time.</p>
            </form>
          </section>

          <section className={card} aria-labelledby="care-h">
            <h2 className={cardTitle} id="care-h">
              Caregivers
            </h2>
            <ul>
              {caregivers.map((c) => (
                <li
                  className="flex items-start gap-3.5 border-t border-line py-3.5 first:border-t-0 first:pt-0 last:pb-0"
                  key={c.id}
                >
                  <span className={avatar}>{initials(c.name)}</span>
                  <div className="min-w-0 flex-1">
                    <strong className="block font-semibold leading-[1.35]">
                      {c.name}, {c.relation.toLowerCase()}
                    </strong>
                    <small className="block text-[0.86rem] leading-[1.45] text-ink-faint">
                      {c.scope}. {c.since}.
                    </small>
                  </div>
                  <button className={button('danger', 'sm')} type="button">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button className={`${button('soft')} mt-4 w-full`} type="button">
              <Icon name="plus" size={18} />
              Add a caregiver
            </button>
          </section>
        </div>
      </div>

      <section className={card} aria-labelledby="log-h">
        <h2 className={cardTitle} id="log-h">
          Access history
        </h2>
        <ul className="grid gap-4">
          {accessLog.map((l) => (
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
    </>
  )
}
