import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Background, Controls, Position, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { KindTag } from '../Kind'
import Icon from '../Icon'
import { kindOrder, kinds } from '../../data/mock'
import { ageAt, formatDate } from '../../lib/format'
import { button, emptyBox } from '../../lib/ui'
import {
  PATIENT_ID,
  SIZES,
  buildBranches,
  categoryId,
  layoutGraph,
  moreId,
  toTreeSpec,
} from '../../lib/graphLayout'
import type { LayoutMode } from '../../lib/graphLayout'
import { nodeTypes } from './nodes'
import type { GraphNode } from './nodes'
import type { HealthEvent, Kind } from '../../types'

const LEAF_LIMIT = 4
const NARROW_QUERY = '(max-width: 767px)'

const kindColor = (k: Kind) => `var(--color-${k})`

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

interface HealthGraphFlowProps {
  events: HealthEvent[]
  patientName: string
  dateOfBirth: string
}

export default function HealthGraphFlow(props: HealthGraphFlowProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  )
}

function GraphInner({ events, patientName, dateOfBirth }: HealthGraphFlowProps) {
  const narrow = useIsNarrow()
  const [mode, setMode] = useState<LayoutMode>(() => (window.matchMedia(NARROW_QUERY).matches ? 'tree' : 'radial'))
  const [expanded, setExpanded] = useState<ReadonlySet<Kind>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const { fitView } = useReactFlow()

  const toggle = useCallback((k: Kind) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }, [])

  const { nodes, edges, signature } = useMemo(() => {
    const branches = buildBranches(events, expanded, LEAF_LIMIT)
    const sizes = SIZES[narrow ? 'narrow' : 'wide']
    const pos = layoutGraph(toTreeSpec(branches), mode, sizes)
    const handlesAt = mode === 'tree' ? { sourcePosition: Position.Right, targetPosition: Position.Left } : {}
    const edgeType = mode === 'radial' ? 'straight' : 'default'

    const firstName = (patientName || 'User').trim().split(/\s+/)[0] || 'User'
    const birthYear = dateOfBirth && dateOfBirth.length >= 4 ? dateOfBirth.slice(0, 4) : ''

    const nodes: GraphNode[] = [
      {
        id: PATIENT_ID,
        type: 'patient',
        position: pos[PATIENT_ID] ?? { x: 0, y: 0 },
        width: sizes.patient.w,
        height: sizes.patient.h,
        data: { mode, name: firstName, since: birthYear ? `since ${birthYear}` : '' },
        ...handlesAt,
      },
    ]
    const edges: Edge[] = []

    for (const b of branches) {
      const cid = categoryId(b.kind)
      const kindLabel = kinds[b.kind]?.plural ?? b.kind
      nodes.push({
        id: cid,
        type: 'category',
        position: pos[cid] ?? { x: 0, y: 0 },
        width: sizes.category.w,
        height: sizes.category.h,
        data: {
          mode,
          kind: b.kind,
          label: kindLabel,
          total: b.total,
          expanded: expanded.has(b.kind),
          canToggle: b.total > LEAF_LIMIT + 1,
        },
        ...handlesAt,
      })
      edges.push({ id: `e:${PATIENT_ID}-${cid}`, source: PATIENT_ID, target: cid, type: edgeType, style: { stroke: kindColor(b.kind), strokeOpacity: 0.55, strokeWidth: 2.2 } })

      for (const e of b.shown) {
        nodes.push({
          id: e.id,
          type: 'record',
          position: pos[e.id] ?? { x: 0, y: 0 },
          width: sizes.leaf.w,
          height: sizes.leaf.h,
          data: { mode, event: e, label: e.title || 'Untitled', selected: e.id === selectedId },
          ...handlesAt,
        })
        edges.push({ id: `e:${cid}-${e.id}`, source: cid, target: e.id, type: edgeType, style: { stroke: kindColor(b.kind), strokeOpacity: 0.4, strokeWidth: 1.5 } })
      }
      if (b.hidden > 0) {
        const mid = moreId(b.kind)
        nodes.push({
          id: mid,
          type: 'more',
          position: pos[mid] ?? { x: 0, y: 0 },
          width: sizes.leaf.w,
          height: sizes.leaf.h,
          data: { mode, kind: b.kind, hidden: b.hidden },
          ...handlesAt,
        })
        edges.push({ id: `e:${cid}-${mid}`, source: cid, target: mid, type: edgeType, style: { stroke: kindColor(b.kind), strokeOpacity: 0.3, strokeWidth: 1.5, strokeDasharray: '4 4' } })
      }
    }
    // Refit only when the shape of the graph changes, not when a node is merely selected.
    return { nodes, edges, signature: `${mode}|${narrow}|${nodes.map((n) => n.id).join(',')}` }
  }, [events, expanded, mode, narrow, patientName, dateOfBirth, selectedId])

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.type === 'record') setSelectedId(node.id)
      else if (node.type === 'category' || node.type === 'more') toggle((node.data as { kind: Kind }).kind)
    },
    [toggle],
  )

  const refit = useCallback(() => {
    requestAnimationFrame(() => {
      try {
        fitView({ padding: 0.12, duration: 250, maxZoom: 1.1 })
      } catch {
        // Safe fallback if fitView is called before canvas is ready
      }
    })
  }, [fitView])

  useEffect(() => {
    refit()
  }, [signature, refit])

  // Keep the graph framed when the window or the container changes size.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout>
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(refit, 150)
    })
    ro.observe(el)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
    }
  }, [refit])

  const selected = events.find((e) => e.id === selectedId) ?? null

  if (events.length === 0) {
    return (
      <div className={emptyBox}>
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-mist text-ink-faint">
          <Icon name="timeline" size={24} />
        </span>
        <p className="font-semibold text-ink">Nothing to draw yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[0.88rem] text-ink-soft">
          The graph is built from your records. Add an allergy or upload a prescription, or load the sample data from the overview page.
        </p>
        <Link to="/app" className={`${button('soft', 'sm')} mt-4`}>
          Go to overview
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-line bg-white p-1" role="group" aria-label="Graph layout">
            {(['radial', 'tree'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-full px-4 py-1.5 text-[0.85rem] font-semibold capitalize transition-colors ${mode === m ? 'bg-brand-tint text-brand-deep' : 'text-ink-soft hover:text-ink'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-[0.8rem] text-ink-faint">Drag to move. Pinch or use + and − to zoom.</p>
        </div>

        <div
          ref={frame}
          className="h-[62dvh] max-h-[720px] min-h-[380px] overflow-hidden rounded-[26px] border border-line bg-white shadow-soft"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            minZoom={0.2}
            maxZoom={1.6}
            fitView
            fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
            aria-label="Health graph. Use the Timeline tab for the same records as a list."
          >
            <Background gap={24} size={1.4} color="#e1eaed" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        </div>
      </div>

      <aside className="min-w-0 rounded-[26px] border border-line bg-white p-5 shadow-soft" aria-live="polite">
        {selected ? (
          <div data-kind={selected.kind}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <KindTag kind={selected.kind} />
              {selected.status && (
                <span className="rounded-full bg-mist-2 px-2.5 py-0.5 text-xs font-semibold text-ink-soft capitalize">{selected.status}</span>
              )}
            </div>
            <h3 className="mb-1 text-[1.25rem] [overflow-wrap:anywhere]">{selected.title}</h3>
            <p className="text-[0.9rem] text-ink-soft">{selected.detail}</p>
            <dl className="mt-4 grid gap-2 text-[0.85rem]">
              <div>
                <dt className="text-ink-faint">Date</dt>
                <dd className="font-medium">
                  {formatDate(selected.date)}
                  {dateOfBirth && selected.date ? `, ${ageAt(dateOfBirth, selected.date).toLowerCase()}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-ink-faint">Provider</dt>
                <dd className="font-medium [overflow-wrap:anywhere]">{selected.provider}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={`/app/records?kind=${selected.kind}&q=${encodeURIComponent(selected.title)}`} className={button('soft', 'sm')}>
                Open in records
              </Link>
              <button type="button" className={button('ghost', 'sm')} onClick={() => setSelectedId(null)}>
                Clear
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[0.9rem] text-ink-soft">Select a record in the graph to see its details here.</p>
        )}

        <ul className="mt-5 grid gap-2 border-t border-line pt-4 text-[0.85rem] text-ink-soft">
          {kindOrder.map((k) => {
            const count = events.filter((e) => e.kind === k).length
            return (
              <li key={k} data-kind={k} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-(--k)" />
                <span className="flex-1">{kinds[k]?.plural ?? k}</span>
                <span className="font-semibold text-ink">{count}</span>
              </li>
            )
          })}
        </ul>
      </aside>
    </div>
  )
}
