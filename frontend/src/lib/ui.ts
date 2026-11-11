// Shared Tailwind class strings, so pages stay readable.
// Keep class names literal: Tailwind finds them by scanning the source.

export const wrap = 'mx-auto w-[min(1120px,100%-2rem)] sm:w-[min(1120px,100%-3rem)]'

export const lead = 'max-w-[34rem] text-[1.15rem] leading-relaxed text-ink-soft'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full border font-semibold leading-tight whitespace-nowrap transition-colors'

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

export const select =
  `${input} appearance-none pr-11 bg-[url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235e7882' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>")] bg-no-repeat bg-[right_16px_center]`

export const card = 'rounded-[26px] border border-line bg-white p-[22px] sm:p-7 shadow-soft'

export const cardFlush = 'rounded-[26px] border border-line bg-white px-[18px] py-1.5 sm:px-6 sm:py-2 shadow-soft'

export const cardTitle = 'mb-4.5 flex items-baseline justify-between gap-3 text-[1.35rem]'

export const chip =
  'rounded-full border border-line-strong bg-white px-4 py-[7px] text-[0.88rem] font-medium text-ink-soft transition-colors hover:border-brand aria-pressed:border-brand aria-pressed:bg-brand-tint aria-pressed:font-semibold aria-pressed:text-brand-deep'

export const avatar =
  'grid size-[42px] shrink-0 place-items-center rounded-full bg-brand-tint text-[0.88rem] font-semibold text-brand-deep'
