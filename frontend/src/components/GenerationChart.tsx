import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { gwTick, mw, num, ukDayTime, ukShortDay, ukTime } from '../format'
import type { Point } from '../types'
import { TooltipBox, TooltipRow, axisTick, niceTicks, seriesColor } from './chart'

type Row = { t: number; actual?: number; forecast?: number; range?: [number, number] }

type Props = {
  points: Point[]
  forecastLabel: string
  scale: 'day' | 'range'
}

const activeDot = { r: 4, strokeWidth: 2, stroke: 'var(--surface)' }

function hourAndMinute(t: number) {
  const [h, m] = ukTime(t).split(':').map(Number)
  return { h, m }
}

function pickTicks(times: number[], keep: (t: number) => boolean, max: number) {
  const candidates = times.filter(keep)
  const every = Math.max(1, Math.ceil(candidates.length / max))
  return candidates.filter((_, i) => i % every === 0)
}

export default function GenerationChart({ points, forecastLabel, scale }: Props) {
  const rows = useMemo<Row[]>(
    () =>
      points.map((p) => ({
        t: Date.parse(p.time),
        actual: p.actual,
        forecast: p.forecast,
        range: p.low !== undefined && p.high !== undefined ? [p.low, p.high] : undefined,
      })),
    [points],
  )

  const ticks = useMemo(() => {
    const times = rows.map((r) => r.t)
    if (scale === 'day') {
      return pickTicks(times, (t) => {
        const { h, m } = hourAndMinute(t)
        return m === 0 && h % 3 === 0
      }, 8)
    }
    return pickTicks(times, (t) => ukTime(t) === '00:00', 8)
  }, [rows, scale])

  const hasBand = rows.some((r) => r.range)
  const yTicks = useMemo(
    () => niceTicks(0, Math.max(...rows.map((r) => Math.max(r.actual ?? 0, r.forecast ?? 0, r.range?.[1] ?? 0)))),
    [rows],
  )

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          ticks={ticks}
          tickFormatter={scale === 'day' ? ukTime : ukShortDay}
          tick={axisTick}
          stroke="var(--axis)"
          tickLine={false}
        />
        <YAxis
          domain={[0, yTicks[yTicks.length - 1]]}
          ticks={yTicks}
          tickFormatter={gwTick}
          tick={axisTick}
          width={36}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          isAnimationActive={false}
          cursor={{ stroke: 'var(--axis)' }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as Row | undefined
            if (!active || !row) return null
            return (
              <TooltipBox title={ukDayTime(row.t)}>
                {row.actual !== undefined && <TooltipRow color={seriesColor.actual} label="Actual" value={mw(row.actual)} />}
                {row.forecast !== undefined && (
                  <TooltipRow color={seriesColor.forecast} label={forecastLabel} value={mw(row.forecast)} />
                )}
                {row.range && <TooltipRow label="Likely range" value={`${num(row.range[0])}–${mw(row.range[1])}`} />}
              </TooltipBox>
            )
          }}
        />
        {hasBand && (
          <Area
            dataKey="range"
            stroke="none"
            fill={seriesColor.forecast}
            fillOpacity={0.14}
            connectNulls
            activeDot={false}
            isAnimationActive={false}
          />
        )}
        <Line
          dataKey="actual"
          stroke={seriesColor.actual}
          strokeWidth={2}
          dot={false}
          activeDot={activeDot}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          dataKey="forecast"
          stroke={seriesColor.forecast}
          strokeWidth={2}
          dot={false}
          activeDot={activeDot}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
