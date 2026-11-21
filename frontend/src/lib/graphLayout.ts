import { hierarchy, tree } from 'd3-hierarchy'
import type { HealthEvent, Kind } from '../types'
import { kindOrder } from '../data/mock'

export type LayoutMode = 'radial' | 'tree'

export interface TreeSpec {
  id: string
  children?: TreeSpec[]
}

export interface Branch {
  kind: Kind
  total: number
  shown: HealthEvent[]
  hidden: number
}

export const PATIENT_ID = 'patient'
export const categoryId = (k: Kind) => `cat:${k}`
export const moreId = (k: Kind) => `more:${k}`

/** Active records first, then newest. */
const byImportance = (a: HealthEvent, b: HealthEvent) =>
  (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0) || (b.date || '').localeCompare(a.date || '')

/** Groups records by type and decides which ones each branch shows. Empty types are left out. */
export function buildBranches(events: HealthEvent[] = [], expanded: ReadonlySet<Kind>, limit: number): Branch[] {
  return kindOrder
    .map((kind) => {
      const all = (events || []).filter((e) => e && e.kind === kind).sort(byImportance)
      const shown = expanded.has(kind) || all.length <= limit + 1 ? all : all.slice(0, limit)
      return { kind, total: all.length, shown, hidden: all.length - shown.length }
    })
    .filter((b) => b.total > 0)
}

export function toTreeSpec(branches: Branch[]): TreeSpec {
  return {
    id: PATIENT_ID,
    children: branches.map((b) => ({
      id: categoryId(b.kind),
      children: [
        ...b.shown.map((e) => ({ id: e.id })),
        ...(b.hidden > 0 ? [{ id: moreId(b.kind) }] : []),
      ],
    })),
  }
}

export interface Size {
  w: number
  h: number
}

export interface NodeSizes {
  patient: Size
  category: Size
  leaf: Size
}

export const SIZES: Record<'wide' | 'narrow', NodeSizes> = {
  wide: { patient: { w: 112, h: 112 }, category: { w: 160, h: 46 }, leaf: { w: 170, h: 44 } },
  narrow: { patient: { w: 96, h: 96 }, category: { w: 154, h: 42 }, leaf: { w: 150, h: 40 } },
}

/**
 * Computes top-left positions for every node. Pure and deterministic, so the graph always
 * reflects the current records: add an allergy and the layout is recomputed around it.
 */
export function layoutGraph(spec: TreeSpec, mode: LayoutMode, sizes: NodeSizes): Record<string, { x: number; y: number }> {
  const root = hierarchy(spec)
  const leafCount = Math.max(root.leaves().length, 1)
  const positions: Record<string, { x: number; y: number }> = {}

  const place = (id: string, depth: number, cx: number, cy: number) => {
    const size = depth === 0 ? sizes.patient : depth === 1 ? sizes.category : sizes.leaf
    positions[id] = { x: cx - size.w / 2, y: cy - size.h / 2 }
  }

  if (mode === 'tree') {
    const colGap = sizes.leaf.w + 56
    const rowGap = sizes.leaf.h + 14
    const laid = tree<TreeSpec>().nodeSize([rowGap, colGap]).separation((a, b) => (a.parent === b.parent ? 1 : 1.35))(root)
    // d3 treats x as the sibling axis and y as depth. Swap them for a left-to-right tree.
    laid.each((d) => place(d.data.id, d.depth, d.y, d.x))
    return positions
  }

  // Radial: an ellipse that grows with the number of records so labels never collide.
  const rx = Math.max(340, leafCount * 31)
  const ry = rx * 0.7
  const laid = tree<TreeSpec>().size([2 * Math.PI, 1]).separation((a, b) => (a.parent === b.parent ? 1 : 1.5))(root)
  laid.each((d) => {
    const angle = d.x - Math.PI / 2
    const r = d.depth === 0 ? 0 : d.depth === 1 ? 0.46 : 1
    place(d.data.id, d.depth, rx * r * Math.cos(angle), ry * r * Math.sin(angle))
  })
  return positions
}
