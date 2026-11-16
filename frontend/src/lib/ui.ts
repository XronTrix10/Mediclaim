// Shared Tailwind class strings, so pages stay readable.
// Keep class names literal: Tailwind finds them by scanning the source.

export const wrap = 'mx-auto w-[min(1120px,100%-2rem)] sm:w-[min(1120px,100%-3rem)]'

export const lead = 'max-w-[34rem] text-[1.15rem] leading-relaxed text-ink-soft'

const base =
  'inline-flex max-w-full items-center justify-center gap-2 rounded-full border font-semibold leading-tight whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const variants = {
  primary: 'border-transparent bg-brand text-white hover:bg-brand-deep',
  soft: 'border-transparent bg-brand-tint text-brand-deep hover:bg-[#d3e8eb]',
  ghost: 'border-line-strong bg-white text-ink hover:border-brand hover:text-brand',
  danger: 'border-transparent bg-allergy-tint text-allergy-ink hover:bg-[#f3d6d8]',
} as const

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-[22px] py-[11px] text-[0.95rem]',
  lg: 'px-7 py-[15px] text-base',
} as const

export function button(variant: keyof typeof variants, size: keyof typeof sizes = 'md') {
  return `${base} ${variants[variant]} ${sizes[size]}`
}

export const input =
  'w-full rounded-[14px] border border-line-strong bg-white px-4 py-[13px] transition placeholder:text-[#85999f] focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none'

// The chevron image is defined once as the select-chevron utility in index.css.
export const select = `${input} appearance-none pr-11 select-chevron`

export const card = 'rounded-[26px] border border-line bg-white p-[22px] sm:p-7 shadow-soft'

export const cardFlush = 'rounded-[26px] border border-line bg-white px-[18px] py-1.5 sm:px-6 sm:py-2 shadow-soft'

export const cardTitle = 'mb-4.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[1.25rem] sm:text-[1.35rem]'

export const chip =
  'rounded-full border border-line-strong bg-white px-4 py-[7px] text-[0.88rem] font-medium text-ink-soft transition-colors hover:border-brand aria-pressed:border-brand aria-pressed:bg-brand-tint aria-pressed:font-semibold aria-pressed:text-brand-deep'

export const avatar =
  'grid size-[42px] shrink-0 place-items-center rounded-full bg-brand-tint text-[0.88rem] font-semibold text-brand-deep'

export const textLink =
  'font-sans text-[0.88rem] font-semibold text-brand hover:underline hover:underline-offset-[3px]'

export const label = 'text-[0.82rem] font-semibold text-ink'

export const textarea = `${input} resize-none py-2.5 text-[0.95rem]`

export const emptyBox =
  'rounded-[18px] border-2 border-dashed border-line-strong px-5 py-8 text-center sm:px-6'

export const countChip = {
  brand: 'rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-deep',
  allergy: 'rounded-full bg-allergy-tint px-2.5 py-0.5 text-xs font-semibold text-allergy-ink',
} as const
