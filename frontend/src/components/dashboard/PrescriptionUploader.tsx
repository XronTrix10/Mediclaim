import { useImperativeHandle, useRef, useState } from 'react'
import type { FormEvent, Ref } from 'react'
import Icon from '../Icon'
import Modal from '../Modal'
import { button, input, label } from '../../lib/ui'
import { formatFileSize, todayISO } from '../../lib/format'
import { useHealthData } from '../../store/healthData'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp'

export interface UploaderHandle {
  openPicker: () => void
}

interface Pending {
  file: File
  fileType: 'pdf' | 'image'
}

/** Hidden file picker plus the details dialog. Open it from anywhere with a ref: ref.current?.openPicker(). */
export default function PrescriptionUploader({ ref }: { ref?: Ref<UploaderHandle> }) {
  const { actions } = useHealthData()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [doctor, setDoctor] = useState('')
  const [organization, setOrganization] = useState('')
  const [date, setDate] = useState(todayISO())

  useImperativeHandle(ref, () => ({ openPicker: () => inputRef.current?.click() }), [])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the same file be picked again
    if (!file) return
    const isPdf = file.type === 'application/pdf'
    const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    if (!isPdf && !isImage) return setError('Please choose a PDF, PNG or JPEG file.')
    if (file.size > MAX_BYTES) return setError(`That file is ${formatFileSize(file.size)}. The limit is 10 MB.`)
    setPending({ file, fileType: isPdf ? 'pdf' : 'image' })
    setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '))
    setDoctor('')
    setOrganization('')
    setDate(todayISO())
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!pending) return
    actions.addPrescription({
      kind: 'medication',
      title: title.trim() || 'Prescription',
      doctor: doctor.trim(),
      organization: organization.trim() || undefined,
      date,
      status: 'active',
      fileType: pending.fileType,
      fileName: pending.file.name,
      fileSize: formatFileSize(pending.file.size),
      fileUrl: URL.createObjectURL(pending.file),
    })
    setPending(null)
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} aria-label="Choose a prescription file" tabIndex={-1} />

      <Modal open={!!error} onClose={() => setError(null)} title="That file can't be used" size="md">
        <p role="alert" className="text-[0.95rem] text-ink-soft">
          {error}
        </p>
        <div className="mt-5 flex justify-end">
          <button type="button" className={button('primary', 'sm')} onClick={() => setError(null)}>
            OK
          </button>
        </div>
      </Modal>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Prescription details"
        description="These details help your doctors find it later."
      >
        {pending && (
          <>
            <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-brand-tint/70 p-3 text-xs text-brand-deep">
              <Icon name={pending.fileType === 'pdf' ? 'file' : 'image'} size={16} />
              <span className="min-w-0 truncate">
                <strong>{pending.file.name}</strong> ({formatFileSize(pending.file.size)})
              </span>
            </div>
            <form onSubmit={save} className="grid gap-4">
              <div className="grid gap-1.5">
                <label htmlFor="rx-title" className={label}>
                  Title
                </label>
                <input id="rx-title" data-autofocus className={input} value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="rx-doc" className={label}>
                  Prescribing doctor
                </label>
                <input id="rx-doc" className={input} placeholder="For example, Dr. Rohan Kulkarni" value={doctor} onChange={(e) => setDoctor(e.target.value)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label htmlFor="rx-org" className={label}>
                    Clinic or hospital (optional)
                  </label>
                  <input id="rx-org" className={input} value={organization} onChange={(e) => setOrganization(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="rx-date" className={label}>
                    Consultation date
                  </label>
                  <input id="rx-date" type="date" max={todayISO()} className={input} value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={button('ghost', 'sm')} onClick={() => setPending(null)}>
                  Cancel
                </button>
                <button type="submit" className={button('primary', 'sm')}>
                  Save prescription
                </button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </>
  )
}
