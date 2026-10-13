import Icon from './Icon'
import { kinds } from '../data/mock'
import type { Kind } from '../data/mock'

export function KindTag({ kind }: { kind: Kind }) {
  return (
    <span className="tag" data-kind={kind}>
      {kinds[kind].label}
    </span>
  )
}

export function KindBubble({ kind, size = 20 }: { kind: Kind; size?: number }) {
  return (
    <span className="kind-bubble" data-kind={kind}>
      <Icon name={kinds[kind].icon} size={size} />
    </span>
  )
}
