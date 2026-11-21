import { useEffect, useState } from 'react'
import Icon from './Icon'
import { button } from '../lib/ui'
import { getStoredToken } from '../api/client'

interface AuthenticatedFilePreviewProps {
  fileUrl?: string
  fileName?: string
  fileType?: 'pdf' | 'image' | string
  compact?: boolean
}

/**
 * Preview an uploaded PDF or image securely.
 * Works with both local session `blob:` URLs and JWT-protected `/api/v1/documents/{id}/content` endpoints.
 */
export default function AuthenticatedFilePreview({
  fileUrl,
  fileName,
  fileType,
  compact = false,
}: AuthenticatedFilePreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [detectedMime, setDetectedMime] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fileUrl) {
      setObjectUrl(null)
      return
    }

    // Local blob URLs can be rendered directly
    if (fileUrl.startsWith('blob:') || fileUrl.startsWith('data:')) {
      setObjectUrl(fileUrl)
      setError(null)
      return
    }

    let revoked = false
    let createdUrl: string | null = null
    setLoading(true)
    setError(null)

    const headers: Record<string, string> = {}
    const token = getStoredToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    fetch(fileUrl, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Unable to load file (${res.status})`)
        const blob = await res.blob()
        if (revoked) return
        setDetectedMime(blob.type || '')
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
      })
      .catch((err) => {
        if (!revoked) {
          setError(err instanceof Error ? err.message : 'Unable to preview document.')
        }
      })
      .finally(() => {
        if (!revoked) setLoading(false)
      })

    return () => {
      revoked = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [fileUrl])

  if (!fileUrl) {
    return (
      <div className="rounded-[16px] border border-line bg-mist p-4 text-center text-xs text-ink-soft">
        No preview available for this document.
      </div>
    )
  }

  const isPdf =
    fileType === 'pdf' ||
    detectedMime.includes('pdf') ||
    (fileName || '').toLowerCase().endsWith('.pdf')

  if (loading) {
    return (
      <div className="rounded-[16px] border border-line bg-mist p-6 text-center text-xs text-ink-soft">
        Loading document preview...
      </div>
    )
  }

  if (error || !objectUrl) {
    return (
      <div className="rounded-[16px] border border-line bg-mist p-4 text-center text-xs text-ink-soft">
        <p>{error || 'Preview unavailable.'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-[16px] border border-line bg-mist p-3">
      {isPdf ? (
        <div className="grid gap-2.5">
          <iframe
            src={objectUrl}
            title={fileName || 'Document preview'}
            className={`w-full rounded-[10px] border border-line bg-white ${compact ? 'h-56' : 'h-80'}`}
          />
          <div className="flex items-center justify-between gap-2 px-1 text-xs text-ink-faint">
            <span className="truncate font-medium text-ink">{fileName || 'Uploaded PDF'}</span>
            <a
              href={objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={button('ghost', 'sm')}
            >
              <Icon name="file" size={14} />
              Open in new tab
            </a>
          </div>
        </div>
      ) : (
        <div className="grid gap-2.5 text-center">
          <img
            src={objectUrl}
            alt={fileName || 'Uploaded medical document'}
            className={`mx-auto w-full rounded-[10px] bg-white object-contain ${compact ? 'max-h-56' : 'max-h-80'}`}
          />
          <div className="flex items-center justify-between gap-2 px-1 text-xs text-ink-faint">
            <span className="truncate font-medium text-ink">{fileName || 'Uploaded image'}</span>
            <a
              href={objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={button('ghost', 'sm')}
            >
              <Icon name="image" size={14} />
              Open full size
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
