import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../../components/PageHeader'
import Icon from '../../components/Icon'
import { card, avatar, emptyBox, button } from '../../lib/ui'
import { formatDate, initials } from '../../lib/format'
import { getAllPatients } from '../../api/admin'

interface Patient {
  userId: string
  fullName: string
  phone: string
  mediclaimId?: string
  adminVerified: boolean
  registeredAt: string
  bloodGroup?: string
  gender?: string
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3.5 animate-pulse">
      <div className="size-10 rounded-full bg-line shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-40 rounded bg-line" />
        <div className="h-3 w-28 rounded bg-line" />
      </div>
      <div className="hidden sm:block h-3 w-24 rounded bg-line" />
      <div className="h-6 w-20 rounded-full bg-line" />
    </div>
  )
}

export default function AdminPatients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Reset page when search changes
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAllPatients({ page, limit, query: debouncedSearch || undefined })
      setPatients(res.patients as Patient[])
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <PageHeader title="All Patients" subtitle={`${total} patient${total !== 1 ? 's' : ''} registered`} />

      {/* Search */}
      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            placeholder="Search by name, phone, or Mediclaim ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[14px] border border-line-strong bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-[#85999f] focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className={card}>
        {loading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : patients.length === 0 ? (
          <div className={emptyBox}>
            <Icon name="users" size={32} className="mx-auto mb-3 text-ink-faint" />
            <p className="font-semibold text-ink">No patients found</p>
            <p className="mt-1 text-sm text-ink-faint">Try a different search query.</p>
          </div>
        ) : (
          <>
            {/* Desktop header */}
            <div className="mb-2 hidden grid-cols-[2fr_1.5fr_1.5fr_1fr_auto] gap-4 px-1 text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint sm:grid">
              <span>Patient</span>
              <span>Mediclaim ID</span>
              <span>Phone</span>
              <span>Registered</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-line">
              {patients.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center gap-4 py-3.5 sm:grid sm:grid-cols-[2fr_1.5fr_1.5fr_1fr_auto]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`${avatar} shrink-0`}>{initials(p.fullName)}</span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[0.95rem] font-semibold text-ink">
                        {p.fullName}
                      </strong>
                      <span className="block text-[0.78rem] text-ink-faint sm:hidden">{p.phone}</span>
                    </div>
                  </div>
                  <span className="hidden font-mono text-[0.88rem] text-ink-soft sm:block">
                    {p.mediclaimId || '—'}
                  </span>
                  <span className="hidden text-[0.9rem] text-ink-soft sm:block">{p.phone}</span>
                  <span className="hidden text-[0.88rem] text-ink-soft sm:block">
                    {formatDate(p.registeredAt)}
                  </span>
                  <span>
                    {p.adminVerified ? (
                      <span className="rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-xs font-semibold text-[#2e7d32]">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#fff7e6] px-2.5 py-0.5 text-xs font-semibold text-[#b45309]">
                        Pending
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-ink-faint">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={button('ghost', 'sm')}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={button('ghost', 'sm')}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
