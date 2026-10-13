import { events, kindOrder, kinds, patient } from '../data/mock'

const W = 800
const H = 560
const CX = 400
const CY = 280
const rad = (deg: number) => (deg * Math.PI) / 180

interface HealthGraphProps {
  /** Maximum number of detail nodes per branch */
  leaves?: number
  /** Larger labels for small spaces such as the landing page */
  compact?: boolean
}

export default function HealthGraph({ leaves = 3, compact = false }: HealthGraphProps) {
  const leafFont = compact ? 16 : 12.5
  const catFont = compact ? 17 : 14

  const branches = kindOrder.map((kind, i) => {
    const angle = -90 + i * 72
    const cat = { x: CX + 140 * Math.cos(rad(angle)), y: CY + 100 * Math.sin(rad(angle)) }
    const items = events
      .filter((e) => e.kind === kind)
      .sort(
        (a, b) =>
          (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0) ||
          b.date.localeCompare(a.date),
      )
      .slice(0, leaves)
    const spread = 26
    const nodes = items.map((e, j) => {
      const a = angle + (j - (items.length - 1) / 2) * spread
      const label = e.short ?? e.title
      return {
        id: e.id,
        label,
        x: CX + 300 * Math.cos(rad(a)),
        y: CY + 215 * Math.sin(rad(a)),
        w: label.length * leafFont * 0.58 + leafFont * 2,
      }
    })
    const catLabel = kinds[kind].plural
    return { kind, cat, catLabel, catW: catLabel.length * catFont * 0.58 + catFont * 2, nodes }
  })

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Health graph for ${patient.name}, grouped into allergies, conditions, medicines, vaccinations and reports`}
    >
      {branches.map((b) => (
        <g key={`edges-${b.kind}`} data-kind={b.kind}>
          <line
            x1={CX}
            y1={CY}
            x2={b.cat.x}
            y2={b.cat.y}
            className="stroke-(--k) stroke-[2.2] [stroke-linecap:round] [stroke-opacity:0.55]"
          />
          {b.nodes.map((n) => (
            <line
              key={n.id}
              x1={b.cat.x}
              y1={b.cat.y}
              x2={n.x}
              y2={n.y}
              className="stroke-(--k) stroke-[1.5] [stroke-linecap:round] [stroke-opacity:0.35]"
            />
          ))}
        </g>
      ))}

      {branches.map((b) => (
        <g key={`nodes-${b.kind}`} data-kind={b.kind}>
          {b.nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
              <rect
                x={-n.w / 2}
                y={-leafFont * 1.1}
                width={n.w}
                height={leafFont * 2.2}
                rx={leafFont * 1.1}
                className="fill-white stroke-(--k) stroke-[1.2] [stroke-opacity:0.6]"
              />
              <text className="fill-(--ki) font-medium" style={{ fontSize: leafFont }} textAnchor="middle" dy="0.35em">
                {n.label}
              </text>
            </g>
          ))}
          <g transform={`translate(${b.cat.x} ${b.cat.y})`}>
            <rect
              x={-b.catW / 2}
              y={-catFont * 1.15}
              width={b.catW}
              height={catFont * 2.3}
              rx={catFont * 1.15}
              className="fill-(--kt) stroke-(--k) stroke-[1.5]"
            />
            <text className="fill-(--ki) font-semibold" style={{ fontSize: catFont }} textAnchor="middle" dy="0.35em">
              {b.catLabel}
            </text>
          </g>
        </g>
      ))}

      <circle cx={CX} cy={CY} r={46} className="fill-brand" />
      <text x={CX} y={CY - 3} textAnchor="middle" className="fill-white font-display text-[19px] font-medium">
        {patient.firstName}
      </text>
      <text x={CX} y={CY + 17} textAnchor="middle" className="fill-[#cfe4e8] text-[11px] font-medium">
        since 1994
      </text>
    </svg>
  )
}
