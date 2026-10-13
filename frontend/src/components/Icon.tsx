const paths = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  timeline: 'M6 3v12 M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9a9 9 0 0 1-9 9',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6',
  shield: 'M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6z M9 12l2 2 4-4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14a6.5 6.5 0 0 1 3.5 6',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  download: 'M12 4v12 M7 11l5 5 5-5 M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  syringe: 'M18 2l4 4 M17 7l3-3 M19 9 8.7 19.3a1 1 0 0 1-1.4 0L4.7 16.7a1 1 0 0 1 0-1.4L15 5 M9 11l4 4 M5 19l-3 3 M14 4l6 6',
  pill: 'M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z M8.5 8.5l7 7',
  alert: 'M10.3 4 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  flask: 'M9 3h6 M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3 M7.5 15h9',
  logout: 'M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4 M16 17l5-5-5-5 M21 12H9',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M8 11V8a4 4 0 0 1 8 0v3',
  stethoscope: 'M5 3v6a4 4 0 0 0 8 0V3 M9 13v2.5a4.5 4.5 0 0 0 9 0V14 M18 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  plus: 'M12 5v14 M5 12h14',
  x: 'M6 6l12 12 M18 6 6 18',
  sparkle: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z',
} as const

export type IconName = keyof typeof paths

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export default function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
