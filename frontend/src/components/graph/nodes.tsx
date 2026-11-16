import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import Icon from '../Icon'
import { kinds } from '../../data/mock'
import type { HealthEvent, Kind } from '../../types'
import type { LayoutMode } from '../../lib/graphLayout'

type Mode = { mode: LayoutMode }

export type PatientNodeType = Node<{ name: string; since: string } & Mode, 'patient'>
export type CategoryNodeType = Node<{ kind: Kind; label: string; total: number; expanded: boolean; canToggle: boolean } & Mode, 'category'>
export type RecordNodeType = Node<{ event: HealthEvent; label: string; selected: boolean } & Mode, 'record'>
export type MoreNodeType = Node<{ kind: Kind; hidden: number } & Mode, 'more'>
export type GraphNode = PatientNodeType | CategoryNodeType | RecordNodeType | MoreNodeType

/* Clicks are handled once, by <ReactFlow onNodeClick>. That also keeps keyboard activation working,
   because pressing Enter on a button inside a node produces a click that bubbles up to the node. */

/** Radial layouts connect through the centre of each node; trees connect left to right. */
function Handles({ mode, target = true, source = true }: Mode & { target?: boolean; source?: boolean }) {
  const centred = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: 0, pointerEvents: 'none' as const, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 }
  const hidden = { opacity: 0, pointerEvents: 'none' as const, border: 0 }
  return (
    <>
      {target && <Handle type="target" position={Position.Left} isConnectable={false} style={mode === 'radial' ? centred : hidden} />}
      {source && <Handle type="source" position={Position.Right} isConnectable={false} style={mode === 'radial' ? centred : hidden} />}
    </>
  )
}

export function PatientNodeView({ data }: NodeProps<PatientNodeType>) {
  return (
    <div className="grid size-full place-items-center rounded-full bg-brand p-2 text-center text-white shadow-soft ring-8 ring-brand-tint">
      <div className="min-w-0">
        <p className="truncate font-display text-[1.05rem] leading-tight font-medium">{data.name}</p>
        <p className="text-[0.68rem] text-[#cfe4e8]">{data.since}</p>
      </div>
      <Handles mode={data.mode} target={false} />
    </div>
  )
}

export function CategoryNodeView({ data }: NodeProps<CategoryNodeType>) {
  const body = (
    <>
      <Icon name={kinds[data.kind].icon} size={16} />
      <span className="truncate">{data.label}</span>
      <span className="rounded-full bg-white/80 px-1.5 text-[0.7rem] leading-5">{data.total}</span>
    </>
  )
  const cls =
    'flex size-full items-center justify-center gap-1.5 rounded-full border-[1.5px] border-(--k) bg-(--kt) px-3 text-[0.82rem] font-semibold text-(--ki)'
  return (
    <div data-kind={data.kind} className="size-full">
      {data.canToggle ? (
        <button
          type="button"
          aria-expanded={data.expanded}
          title={data.expanded ? 'Show fewer' : 'Show all'}
          className={`${cls} cursor-pointer transition-shadow hover:shadow-soft`}
        >
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
      <Handles mode={data.mode} />
    </div>
  )
}

export function RecordNodeView({ data }: NodeProps<RecordNodeType>) {
  const { event: e } = data
  return (
    <div data-kind={e.kind} className="size-full">
      <button
        type="button"
        aria-pressed={data.selected}
        aria-label={`${kinds[e.kind].label}: ${e.title}`}
        title={e.title}
        className={`flex size-full cursor-pointer items-center gap-2 rounded-full border bg-white px-3 text-left text-[0.8rem] font-medium text-(--ki) transition-shadow hover:shadow-soft ${
          data.selected ? 'border-2 border-(--k) shadow-soft ring-4 ring-(--kt)' : 'border-(--k)/60'
        }`}
      >
        <span
          className={`size-2 shrink-0 rounded-full ${e.status === 'resolved' ? 'border border-(--k) bg-white' : 'bg-(--k)'}`}
          aria-hidden="true"
        />
        <span className="truncate">{data.label}</span>
      </button>
      <Handles mode={data.mode} source={false} />
    </div>
  )
}

export function MoreNodeView({ data }: NodeProps<MoreNodeType>) {
  return (
    <div data-kind={data.kind} className="size-full">
      <button
        type="button"
        className="flex size-full cursor-pointer items-center justify-center rounded-full border border-dashed border-(--k) bg-white/70 text-[0.78rem] font-semibold text-(--ki) hover:bg-(--kt)"
      >
        +{data.hidden} more
      </button>
      <Handles mode={data.mode} source={false} />
    </div>
  )
}

export const nodeTypes = {
  patient: PatientNodeView,
  category: CategoryNodeView,
  record: RecordNodeView,
  more: MoreNodeView,
}
