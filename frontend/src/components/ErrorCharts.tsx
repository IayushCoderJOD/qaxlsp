import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { gwTick, mw, num, signedMw } from '../format'
import type { Accuracy } from '../types'
import { TooltipBox, TooltipRow, axisTick, niceTicks, seriesColor } from './chart'

const activeDot = { r: 4, strokeWidth: 2, stroke: 'var(--surface)' }
const margin = { top: 16, right: 8, bottom: 0, left: 0 }

type HorizonProps = {
  rows: Accuracy['by_horizon']
  selected: number
  dayAheadRange: [number, number]
  onPick: (horizon: number) => void
}

export function HorizonChart({ rows, selected, dayAheadRange, onPick }: HorizonProps) {
  const data = rows.map(({ horizon, stats }) => ({ horizon, ...stats }))
  const yTicks = niceTicks(Math.min(0, ...data.map((d) => d.bias)), Math.max(...data.map((d) => d.mae)), 4)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart
        data={data}
        margin={margin}
        style={{ cursor: 'pointer' }}
        onClick={(state) => {
          if (state.activeLabel !== undefined) onPick(Number(state.activeLabel))
        }}
      >
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <ReferenceArea
          x1={dayAheadRange[0]}
          x2={dayAheadRange[1]}
          fill="var(--text)"
          fillOpacity={0.05}
          label={{ value: 'Day-ahead', position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 11 }}
        />
        <XAxis
          dataKey="horizon"
          type="number"
          domain={[0, 48]}
          ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
          tickFormatter={(h) => `${h}h`}
          tick={axisTick}
          stroke="var(--axis)"
          tickLine={false}
        />
        <YAxis
          domain={[yTicks[0], yTicks[yTicks.length - 1]]}
          ticks={yTicks}
          tickFormatter={gwTick}
          tick={axisTick}
          width={36}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine x={selected} stroke="var(--text-2)" />
        <Tooltip
          isAnimationActive={false}
          cursor={{ stroke: 'var(--axis)' }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as (typeof data)[number] | undefined
            if (!active || !row) return null
            return (
              <TooltipBox title={`${row.horizon} h ahead`}>
                <TooltipRow color={seriesColor.mae} label="MAE" value={mw(row.mae)} />
                <TooltipRow color={seriesColor.bias} label="Mean error" value={signedMw(row.bias)} />
                <TooltipRow label="P90 abs. error" value={mw(row.p90_abs)} />
                <TooltipRow label="hours compared" value={num(row.count)} />
              </TooltipBox>
            )
          }}
        />
        <Line
          dataKey="mae"
          stroke={seriesColor.mae}
          strokeWidth={2}
          dot={false}
          activeDot={activeDot}
          isAnimationActive={false}
        />
        <Line
          dataKey="bias"
          stroke={seriesColor.bias}
          strokeWidth={2}
          dot={false}
          activeDot={activeDot}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function LevelChart({ rows }: { rows: Accuracy['by_level'] }) {
  // a handful of hours in a bucket says nothing useful
  const data = rows
    .filter((row) => row.stats.count >= 10)
    .map(({ lower, upper, stats }) => ({
      label: `${lower / 1000}–${upper / 1000}`,
      ...stats,
      spread: [stats.bias - stats.p10, stats.p90 - stats.bias],
    }))
  const yTicks = niceTicks(Math.min(0, ...data.map((d) => d.p10)), Math.max(0, ...data.map((d) => d.p90)), 4)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={margin}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="label" tick={axisTick} stroke="var(--axis)" tickLine={false} />
        <YAxis
          domain={[yTicks[0], yTicks[yTicks.length - 1]]}
          ticks={yTicks}
          tickFormatter={gwTick}
          tick={axisTick}
          width={36}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine y={0} stroke="var(--axis)" />
        <Tooltip
          isAnimationActive={false}
          cursor={{ fill: 'var(--text)', fillOpacity: 0.04 }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as (typeof data)[number] | undefined
            if (!active || !row) return null
            return (
              <TooltipBox title={`Forecast ${row.label} GW`}>
                <TooltipRow color={seriesColor.bias} label="Mean error" value={signedMw(row.bias)} />
                <TooltipRow label="P10 to P90" value={`${signedMw(row.p10)} to ${signedMw(row.p90)}`} />
                <TooltipRow label="hours" value={num(row.count)} />
              </TooltipBox>
            )
          }}
        />
        <Bar dataKey="bias" fill={seriesColor.bias} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
          <ErrorBar dataKey="spread" stroke="var(--text-2)" strokeWidth={1.5} width={8} isAnimationActive={false} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
