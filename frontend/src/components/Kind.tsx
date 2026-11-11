import Icon from './Icon'
import { kinds } from '../data/mock'
import type { Kind } from '../data/mock'

export function KindTag({ kind }: { kind: Kind }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-(--kt) px-[11px] py-[3px] text-[0.78rem] font-semibold whitespace-nowrap text-(--ki)"
      data-kind={kind}
    >
      {kinds[kind].label}
    </span>
  )
}

export function KindBubble({ kind, size = 20 }: { kind: Kind; size?: number }) {
  return (
    <span
      className="grid size-[42px] shrink-0 place-items-center rounded-[14px] bg-(--kt) text-(--ki)"
      data-kind={kind}
    >
      <Icon name={kinds[kind].icon} size={size} />
    </span>
  )
}
