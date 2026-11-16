import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import type { IconName } from './Icon'

let scrollLocks = 0
function lockScroll() {
  if (scrollLocks++ === 0) document.body.style.overflow = 'hidden'
}
function unlockScroll() {
  if (--scrollLocks === 0) document.body.style.overflow = ''
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  icon?: IconName
  /** When false there is no close button, Escape or backdrop dismissal (used for required steps). */
  dismissible?: boolean
  size?: 'md' | 'lg'
  onClose?: () => void
  children: ReactNode
}

/**
 * Accessible dialog: bottom sheet on phones, centred card on larger screens.
 * Scrolls inside itself, locks page scroll, closes on Escape, traps Tab and restores focus.
 */
export default function Modal({
  open,
  title,
  description,
  icon,
  dismissible = true,
  size = 'md',
  onClose,
  children,
}: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    lockScroll()
    // Focus the first field on desktop only. On touch screens that would open the keyboard and hide the form.
    const wantsField = window.matchMedia('(pointer: fine)').matches
    ;((wantsField && panel?.querySelector<HTMLElement>('[data-autofocus]')) || panel)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation()
        closeRef.current?.()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlockScroll()
      previous?.focus?.()
    }
  }, [open, dismissible])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) closeRef.current?.()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-[calc(100dvh-0.75rem)] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-white shadow-soft outline-none sm:max-h-[calc(100dvh-3rem)] sm:rounded-[26px] ${
          size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-md'
        }`}
      >
        <header className="flex items-start gap-3 border-b border-line bg-mist/60 px-5 py-4 sm:px-6">
          {icon && (
            <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-brand-tint text-brand">
              <Icon name={icon} size={22} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[1.25rem] leading-tight sm:text-[1.4rem]">
              {title}
            </h2>
            {description && <p className="mt-1 text-[0.9rem] text-ink-soft">{description}</p>}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={() => closeRef.current?.()}
              aria-label="Close dialog"
              className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-mist-2 hover:text-ink"
            >
              <Icon name="x" size={20} />
            </button>
          )}
        </header>
        <div className="overflow-y-auto overscroll-contain px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
