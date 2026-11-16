import { useState } from 'react'
import type { FormEvent } from 'react'
import Modal from '../Modal'
import { button, label, select, textarea } from '../../lib/ui'
import { formatDate } from '../../lib/format'
import { useHealthData } from '../../store/healthData'

interface CorrectionDialogProps {
  open: boolean
  /** Record to preselect, when opened from a record's detail view */
  recordId?: string
  onClose: () => void
}

export default function CorrectionDialog({ open, recordId, onClose }: CorrectionDialogProps) {
  const { events, actions } = useHealthData()
  const [chosen, setChosen] = useState('')
  const [reason, setReason] = useState('')
  const [proposed, setProposed] = useState('')
  const [sent, setSent] = useState(false)

  const selected = chosen || recordId || events[0]?.id || ''

  const close = () => {
    setChosen('')
    setReason('')
    setProposed('')
    setSent(false)
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const record = events.find((r) => r.id === selected)
    if (!record || reason.trim().length < 10) return
    actions.requestCorrection({ recordId: record.id, recordTitle: record.title, reason: reason.trim(), proposed: proposed.trim() || undefined })
    setSent(true)
  }

  return (
    <Modal open={open} onClose={close} title={sent ? 'Request sent' : 'Request a correction'} description={sent ? undefined : 'Your doctor reviews the request. The original record stays in your history.'}>
      {sent ? (
        <>
          <p role="status" className="text-[0.95rem] text-ink-soft">
            Your request is now under review. You will see its status on the Records page.
          </p>
          <div className="mt-5 flex justify-end">
            <button type="button" className={button('primary', 'sm')} onClick={close}>
              Done
            </button>
          </div>
        </>
      ) : events.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">There are no records to correct yet.</p>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="corr-record" className={label}>
              Which record?
            </label>
            <select id="corr-record" data-autofocus className={select} value={selected} onChange={(e) => setChosen(e.target.value)}>
              {events.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({formatDate(r.date)})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="corr-reason" className={label}>
              What is wrong?
            </label>
            <textarea id="corr-reason" rows={3} className={textarea} placeholder="For example, the start date should be 2020, not 2022." value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} required />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="corr-fix" className={label}>
              What should it say? (optional)
            </label>
            <textarea id="corr-fix" rows={2} className={textarea} value={proposed} onChange={(e) => setProposed(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={button('ghost', 'sm')} onClick={close}>
              Cancel
            </button>
            <button type="submit" className={button('primary', 'sm')}>
              Send request
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
