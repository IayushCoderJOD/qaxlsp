import { Fragment } from 'react'
import { addDays, dayLabel, duration, gwh, mw, num, pct, signed, signedMw, ukDay, ukDayTime, ukTime } from '../format'
import { useApi } from '../hooks'
import type { DayAhead, Meta } from '../types'
import GenerationChart from './GenerationChart'
import { Legend, StatTile, seriesColor } from './chart'

export type DayAheadSettings = { day: string; decisionTime: string }

const GATE_CLOSURES = [
  { label: 'EPEX 09:20', time: '09:20' },
  { label: 'N2EX 09:50', time: '09:50' },
]

type Props = {
  meta: Meta
  settings: DayAheadSettings
  onChange: (next: DayAheadSettings) => void
}

export default function DayAheadView({ meta, settings, onChange }: Props) {
  const { day, decisionTime } = settings
  const { data, error, loading } = useApi<DayAhead>(`/api/day-ahead?day=${day}&decision_time=${decisionTime}`)

  const setDay = (next: string) => onChange({ ...settings, day: next })
  const setTime = (next: string) => onChange({ ...settings, decisionTime: next })

  return (
    <>
      <div className="controls">
        <div className="field">
          <label htmlFor="delivery-day">Delivery day</label>
          <div className="stepper">
            <button
              type="button"
              aria-label="Previous day"
              disabled={day <= meta.first_delivery_day}
              onClick={() => setDay(addDays(day, -1))}
            >
              ‹
            </button>
            <input
              id="delivery-day"
              type="date"
              value={day}
              min={meta.first_delivery_day}
              max={meta.last_delivery_day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
            <button
              type="button"
              aria-label="Next day"
              disabled={day >= meta.last_delivery_day}
              onClick={() => setDay(addDays(day, 1))}
            >
              ›
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="decision-time">Decision time on {dayLabel(addDays(day, -1))}</label>
          <div className="inline">
            <input
              id="decision-time"
              type="time"
              step={300}
              value={decisionTime}
              onChange={(e) => e.target.value && setTime(e.target.value)}
            />
            {GATE_CLOSURES.map((gate) => (
              <button
                key={gate.time}
                type="button"
                className={decisionTime === gate.time ? 'chip selected' : 'chip'}
                onClick={() => setTime(gate.time)}
              >
                {gate.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="notice">{error}</p>}
      {data && <DayAheadReport data={data} decisionTime={decisionTime} stale={loading} />}
    </>
  )
}

function DayAheadReport({ data, decisionTime, stale }: { data: DayAhead; decisionTime: string; stale: boolean }) {
  const { summary, month } = data
  const used = data.forecast_published_at
  const forecastLabel = used ? `Forecast (${ukTime(used)} run)` : 'Forecast'
  const energyGap =
    summary.forecast_mwh && summary.actual_mwh ? summary.forecast_mwh / summary.actual_mwh - 1 : undefined
  const hourly = data.points.filter((p) => p.forecast !== undefined)

  return (
    <div className={stale ? 'stale' : undefined}>
      <RunTimeline data={data} />

      <div className="tiles">
        <StatTile
          label="Forecast wind energy"
          value={summary.forecast_mwh ? gwh(summary.forecast_mwh) : '–'}
          note={
            summary.forecast_min !== undefined &&
            summary.forecast_max !== undefined &&
            `Hourly ${num(summary.forecast_min)}–${mw(summary.forecast_max)}`
          }
        />
        <StatTile
          label="Wind to count on (P10)"
          value={summary.p10_mwh ? gwh(summary.p10_mwh) : '–'}
          note="If every hour came in at its P10"
        />
        <StatTile
          label="Actual wind energy"
          value={summary.actual_mwh ? gwh(summary.actual_mwh) : '–'}
          note={energyGap !== undefined && `Forecast was ${pct(Math.abs(energyGap))} too ${energyGap > 0 ? 'high' : 'low'}`}
        />
        <StatTile
          label="Error on the day (MAE)"
          value={summary.errors ? mw(summary.errors.mae) : '–'}
          note={summary.errors && `Mean error ${signedMw(summary.errors.bias)}`}
        />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Wind generation, {dayLabel(data.delivery_day)}</h2>
          <Legend
            items={[
              { label: 'Actual', color: seriesColor.actual },
              { label: forecastLabel, color: seriesColor.forecast },
              { label: 'Likely range (P10–P90)', color: seriesColor.forecast, kind: 'band' },
            ]}
          />
        </div>
        <div className="unit">GW</div>
        <GenerationChart points={data.points} forecastLabel={forecastLabel} scale="day" />
        <p className="caption">
          The shaded range is where actual wind landed 80% of the time in January, for forecasts of a similar size made
          at {decisionTime} the day before.
        </p>

        <details className="table-toggle">
          <summary>Hourly values (MW)</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hour</th>
                  <th>Forecast</th>
                  <th>P10</th>
                  <th>P90</th>
                  <th>Actual</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {hourly.map((p) => (
                  <tr key={p.time}>
                    <td>{ukTime(p.time)}</td>
                    <td>{num(p.forecast!)}</td>
                    <td>{p.low !== undefined ? num(p.low) : '–'}</td>
                    <td>{p.high !== undefined ? num(p.high) : '–'}</td>
                    <td>{p.actual !== undefined ? num(p.actual) : '–'}</td>
                    <td>{p.actual !== undefined ? signed(p.forecast! - p.actual) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {month && (
        <section className="card track-record">
          <h2>How far to trust the {decisionTime} forecast</h2>
          <p>
            Across {Math.round(month.count / 24)} delivery days in the period, the forecast available at {decisionTime} was
            off by <strong>{mw(month.mae)}</strong> per hour on average and ran{' '}
            <strong>{signedMw(month.bias)}</strong> {month.bias > 0 ? 'high' : 'low'}. In 1 hour in 10 it overshot actual
            wind by more than <strong>{mw(month.p90)}</strong>.
          </p>
        </section>
      )}
    </div>
  )
}

function RunTimeline({ data }: { data: DayAhead }) {
  const used = data.forecast_published_at
  const decisionDay = ukDay(data.decided_at)
  const firstLate = data.runs.findIndex((run) => !run.available)
  const marker = <li className="decision-marker">Decision {ukTime(data.decided_at)}</li>

  return (
    <section className="runs">
      <div>
        <h2>Forecast runs published {decisionDay}</h2>
        <p className="muted">
          {used ? (
            <>
              At {ukTime(data.decided_at)} the latest forecast was the <strong>{ukTime(used)}</strong> run
              {ukDay(used) !== decisionDay && ` from ${ukDay(used)}`}, published{' '}
              {duration(Date.parse(data.decided_at) - Date.parse(used))} earlier.
            </>
          ) : (
            'No forecast covering this day had been published yet.'
          )}
        </p>
      </div>
      <ol className="run-list">
        {data.runs.map((run, i) => (
          <Fragment key={run.published_at}>
            {i === firstLate && marker}
            <li
              className={run.used ? 'run used' : run.available ? 'run' : 'run late'}
              title={`Published ${ukDayTime(run.published_at)}`}
            >
              <span>{ukTime(run.published_at)}</span>
              <small>{run.used ? 'in use' : run.available ? 'older' : 'too late'}</small>
            </li>
          </Fragment>
        ))}
        {firstLate === -1 && marker}
      </ol>
    </section>
  )
}
