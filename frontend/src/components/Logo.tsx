export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="13" className="fill-brand" />
        <path
          d="M20 30V18M20 18c0-4 4-6 8-7M20 18c0-4-4-6-8-7"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="20" cy="30" r="2.6" fill="#fff" />
        <circle cx="28" cy="11" r="2.6" fill="#fff" />
        <circle cx="12" cy="11" r="2.6" fill="#fff" />
      </svg>
      <span className="font-display text-[1.45rem] font-medium tracking-tight">Mediclame</span>
    </span>
  )
}
