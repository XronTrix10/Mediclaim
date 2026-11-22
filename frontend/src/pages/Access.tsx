import { useState } from 'react'
import type { FormEvent } from 'react'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import CardHeader from '../components/CardHeader'
import CaregiverDialog from '../components/records/CaregiverDialog'
import { KindTag } from '../components/Kind'
import { kindOrder, kinds } from '../data/mock'
import { formatDate, formatRemaining, formatWhen, initials } from '../lib/format'
import { useNow } from '../lib/useNow'
import { avatar, button, card, input, label, select } from '../lib/ui'
import { useHealthData } from '../store/healthData'
import type { Kind } from '../types'

const DOCTOR_ID = /^[A-Za-z0-9][A-Za-z0-9-]{3,23}$/

export default function Access() {
  const { grants, requests, caregivers, audit, actions } = useHealthData()
  const now = useNow()
  const [caregiverOpen, setCaregiverOpen] = useState(false)

  const activeGrants = grants.filter(
    (g) => (g.grantStatus === 'active' || !g.grantStatus) && Date.parse(g.expiresAt) > now
  )

  const [doctorId, setDoctorId] = useState('')
  const [scope, setScope] = useState<Kind[]>(['allergy', 'medication'])
  const [hours, setHours] = useState('2')
  const [formError, setFormError] = useState('')
  const [granted, setGranted] = useState('')

  const toggleScope = (k: Kind) => setScope((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  function onGive(e: FormEvent) {
    e.preventDefault()
    setGranted('')
    const id = doctorId.trim().toUpperCase()
    if (!DOCTOR_ID.test(id)) return setFormError('Enter a valid doctor or hospital ID, for example DR-204518.')
    if (scope.length === 0) return setFormError('Choose at least one type of record to share.')
    setFormError('')
    const grant = actions.giveAccess({ name: id, scope, hours: Number(hours) })
    setGranted(`${id} can now see your ${scope.map((k) => kinds[k].plural.toLowerCase()).join(', ')}. ${formatRemaining(grant.expiresAt, Date.now())}.`)
    setDoctorId('')
  }

  return (
    <>
      <CaregiverDialog open={caregiverOpen} onClose={() => setCaregiverOpen(false)} />

      <PageHeader title="Access" subtitle="Choose who can see your records. Doctor access always ends on its own." />

      <div className="mb-5 grid items-start gap-5 min-[1001px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid gap-5">
          <section className={card} aria-labelledby="active-h">
            <CardHeader id="active-h" title="Active access" count={activeGrants.length} />
            {activeGrants.length === 0 ? (
              <div className="grid justify-items-start gap-1.5 px-1 py-4 text-ink-soft">
                <strong className="text-[1.05rem] font-semibold text-ink">No one has access right now</strong>
                <p>Doctors you approve will show up here with the time they have left.</p>
              </div>
            ) : (
              <ul>
                {activeGrants.map((g) => (
                  <li key={g.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-3 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                    <span className={avatar}>{initials(g.name)}</span>
                    <div className="min-w-0">
                      <strong className="block leading-[1.35] font-semibold [overflow-wrap:anywhere]">{g.name}</strong>
                      <small className="block text-[0.86rem] leading-[1.45] text-ink-faint">{g.role}</small>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {g.scope.map((k) => (
                          <KindTag key={k} kind={k} />
                        ))}
                      </div>
                    </div>
                    <div className="col-span-full flex items-center justify-between gap-3 sm:col-span-1 sm:grid sm:justify-items-end">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-[11px] py-1 text-[0.85rem] font-semibold whitespace-nowrap text-brand-deep">
                        <Icon name="clock" size={15} />
                        {formatRemaining(g.expiresAt, now)}
                      </span>
                      <button className={button('danger', 'sm')} type="button" onClick={() => actions.revokeGrant(g.id)}>
                        Revoke
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={card} aria-labelledby="pending-h">
            <CardHeader id="pending-h" title="Waiting for your approval" count={requests.length} />
            {requests.length === 0 ? (
              <div className="grid justify-items-start gap-1.5 px-1 py-4 text-ink-soft">
                <strong className="text-[1.05rem] font-semibold text-ink">No pending requests</strong>
                <p>New requests from doctors will appear here.</p>
              </div>
            ) : (
              <ul>
                {requests.map((r) => {
                  const scopeNames = (r.scope || [])
                    .map((k) => (kinds[k as Kind]?.plural || k).toLowerCase())
                    .join(' and ')
                  return (
                    <li key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-3 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">
                      <span className={avatar}>{initials(r.name)}</span>
                      <div className="min-w-0">
                        <strong className="block leading-[1.35] font-semibold [overflow-wrap:anywhere]">{r.name}</strong>
                        <small className="block text-[0.86rem] leading-[1.45] text-ink-faint">
                          {r.role}. Asking for {scopeNames || 'all records'} for {r.durationHours}{' '}
                          {r.durationHours === 1 ? 'hour' : 'hours'}.
                        </small>
                        {r.purpose && (
                          <p className="mt-1 text-xs text-ink-soft">
                            <span className="font-medium text-ink-faint">Purpose:</span> {r.purpose}
                          </p>
                        )}
                      </div>
                      <div className="col-span-full grid grid-cols-2 gap-2 sm:col-span-1 sm:col-start-2 sm:flex">
                        <button className={button('ghost', 'sm')} type="button" onClick={() => actions.declineRequest(r.id)}>
                          Decline
                        </button>
                        <button className={button('primary', 'sm')} type="button" onClick={() => actions.approveRequest(r.id)}>
                          Approve
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="grid gap-5">
          <section className={card} aria-labelledby="give-h">
            <CardHeader id="give-h" title="Give access" />
            <form className="grid gap-[18px]" onSubmit={onGive} noValidate>
              <div className="grid gap-[7px]">
                <label htmlFor="doctor-id" className="text-[0.9rem] font-semibold">
                  Doctor or hospital ID
                </label>
                <input
                  id="doctor-id"
                  className={input}
                  placeholder="For example, DR-204518"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  aria-invalid={!!formError}
                  aria-describedby={formError ? 'give-err' : undefined}
                />
              </div>
              <fieldset className="grid min-w-0 gap-[7px]">
                <legend className="mb-[7px] p-0 text-[0.9rem] font-semibold">What can they see?</legend>
                <div className="flex flex-wrap gap-2">
                  {kindOrder.map((k) => (
                    <label className="relative cursor-pointer" data-kind={k} key={k}>
                      <input
                        type="checkbox"
                        checked={scope.includes(k)}
                        onChange={() => toggleScope(k)}
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
                <label htmlFor="duration" className={label}>
                  For how long?
                </label>
                <select id="duration" className={select} value={hours} onChange={(e) => setHours(e.target.value)}>
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="6">6 hours</option>
                  <option value="24">24 hours</option>
                </select>
              </div>
              {formError && (
                <p id="give-err" role="alert" className="text-sm text-allergy-ink">
                  {formError}
                </p>
              )}
              {granted && (
                <p role="status" className="rounded-[14px] bg-vaccination-tint px-4 py-2.5 text-[0.88rem] font-medium text-vaccination-ink">
                  {granted}
                </p>
              )}
              <button className={`${button('primary')} w-full`} type="submit">
                Give access
              </button>
              <p className="text-[0.85rem] text-ink-faint">You can revoke access earlier at any time.</p>
            </form>
          </section>

          <section className={card} aria-labelledby="care-h">
            <CardHeader id="care-h" title="Caregivers" />
            {caregivers.length === 0 ? (
              <p className="text-[0.92rem] text-ink-soft">No caregivers yet. Add someone you trust to help manage your records.</p>
            ) : (
              <ul>
                {caregivers.map((c) => (
                  <li key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-3 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">
                    <span className={avatar}>{initials(c.name)}</span>
                    <div className="min-w-0">
                      <strong className="block leading-[1.35] font-semibold [overflow-wrap:anywhere]">
                        {c.name}, {c.relation.toLowerCase()}
                      </strong>
                      <small className="block text-[0.86rem] leading-[1.45] text-ink-faint">
                        Can see {c.scope.map((k) => kinds[k].plural.toLowerCase()).join(', ')}. Since {formatDate(c.since)}.
                      </small>
                    </div>
                    <button className={`${button('danger', 'sm')} col-span-full justify-self-start sm:col-span-1 sm:col-start-2`} type="button" onClick={() => actions.removeCaregiver(c.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className={`${button('soft')} mt-4 w-full`} type="button" onClick={() => setCaregiverOpen(true)}>
              <Icon name="plus" size={18} />
              Add a caregiver
            </button>
          </section>
        </div>
      </div>

      <section className={card} aria-labelledby="log-h">
        <CardHeader id="log-h" title="Access history" className="mb-4" />
        <ul className="grid gap-4">
          {audit.slice(0, 12).map((l) => (
            <li key={l.id} className="flex items-start gap-3.5">
              <span className="mt-[7px] size-2.5 shrink-0 rounded-full bg-brand ring-4 ring-brand-tint" />
              <div className="min-w-0">
                <p className="text-[0.95rem] [overflow-wrap:anywhere]">
                  <strong className="font-semibold">{l.who}</strong> {l.what}
                </p>
                <small className="text-[0.84rem] text-ink-faint">{formatWhen(l.at, now)}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
