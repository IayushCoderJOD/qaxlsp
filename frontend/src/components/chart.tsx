import type { ReactNode } from 'react'

export const axisTick = { fill: 'var(--muted)', fontSize: 12 }

// round tick steps (1, 2, 2.5 or 5 x 10^n) so the axis reads 0 / 5 / 10 GW rather than 5.5 / 11
export function niceTicks(min: number, max: number, count = 5) {
  const raw = (max - min) / count || 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!
  const ticks = []
  for (let v = Math.floor(min / step) * step; v < max + step; v += step) ticks.push(v)
  return ticks
}

export const seriesColor = {
  actual: 'var(--actual)',
  forecast: 'var(--forecast)',
  mae: 'var(--mae)',
  bias: 'var(--bias)',
}

type LegendItem = { label: string; color: string; kind?: 'line' | 'band' | 'bar' }

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className={`key key-${item.kind ?? 'line'}`} style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function TooltipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="tooltip">
      <div className="tooltip-title">{title}</div>
      {children}
    </div>
  )
}

export function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="tooltip-row">
      {color ? <span className="key key-line" style={{ background: color }} /> : <span className="key" />}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export function StatTile({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {note && <div className="tile-note">{note}</div>}
    </div>
  )
}
