import { mw, num, pct, signedMw } from '../format'
import { useApi, useDebounced } from '../hooks'
import type { Accuracy, Meta } from '../types'
import { HorizonChart, LevelChart } from './ErrorCharts'
import GenerationChart from './GenerationChart'
import { Legend, StatTile, seriesColor } from './chart'

export type AccuracySettings = { start: string; end: string; horizon: number }

type Props = {
  meta: Meta
  settings: AccuracySettings
  onChange: (next: AccuracySettings) => void
}

export default function AccuracyView({ meta, settings, onChange }: Props) {
  const query = useDebounced(settings)
  const { data, error, loading } = useApi<Accuracy>(
    `/api/accuracy?start=${query.start}&end=${query.end}&horizon=${query.horizon}`,
  )

  // lead times covered by a day-ahead decision: from D-1 at the gate to the last hour of D
  const [hh, mm] = meta.default_decision_time.split(':').map(Number)
  const gate = hh + mm / 60
  const dayAheadRange: [number, number] = [24 - gate, 47 - gate]

  const isWholePeriod = settings.start === meta.first_delivery_day && settings.end === meta.last_delivery_day

  return (
    <>
      <div className="controls">
        <div className="field">
          <label htmlFor="range-start">From</label>
          <input
            id="range-start"
            type="date"
            value={settings.start}
            min={meta.first_delivery_day}
            max={settings.end}
            onChange={(e) => e.target.value && onChange({ ...settings, start: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="range-end">To</label>
          <input
            id="range-end"
            type="date"
            value={settings.end}
            min={settings.start}
            max={meta.last_delivery_day}
            onChange={(e) => e.target.value && onChange({ ...settings, end: e.target.value })}
          />
        </div>
        <button
          type="button"
          className={isWholePeriod ? 'chip selected' : 'chip'}
          onClick={() => onChange({ ...settings, start: meta.first_delivery_day, end: meta.last_delivery_day })}
        >
          Whole period
        </button>
        <div className="field horizon">
          <label htmlFor="horizon">
            Forecast horizon <strong>{settings.horizon} h</strong>
          </label>
          <input
            id="horizon"
            type="range"
            min={0}
            max={meta.max_horizon}
            value={settings.horizon}
            onChange={(e) => onChange({ ...settings, horizon: Number(e.target.value) })}
          />
        </div>
      </div>

      {error && <p className="notice">{error}</p>}
      {data && (
        <AccuracyReport
          data={data}
          decisionTime={meta.default_decision_time}
          dayAheadRange={dayAheadRange}
          stale={loading || query !== settings}
          onPickHorizon={(horizon) => onChange({ ...settings, horizon })}
        />
      )}
    </>
  )
}

type ReportProps = {
  data: Accuracy
  decisionTime: string
  dayAheadRange: [number, number]
  stale: boolean
  onPickHorizon: (horizon: number) => void
}

function AccuracyReport({ data, decisionTime, dayAheadRange, stale, onPickHorizon }: ReportProps) {
  const { stats } = data
  const forecastLabel = `Forecast (${data.horizon} h ahead)`

  return (
    <div className={stale ? 'stale' : undefined}>
      <div className="tiles">
        <StatTile
          label="Mean absolute error"
          value={stats ? mw(stats.mae) : '–'}
          note={stats && `${pct(stats.nmae)} of average output`}
        />
        <StatTile
          label="Mean error (bias)"
          value={stats ? signedMw(stats.bias) : '–'}
          note={stats && `Forecast ran ${stats.bias > 0 ? 'high' : 'low'} on average`}
        />
        <StatTile label="RMSE" value={stats ? mw(stats.rmse) : '–'} note="Weighs big misses more heavily" />
        <StatTile
          label="P90 absolute error"
          value={stats ? mw(stats.p90_abs) : '–'}
          note="9 hours in 10 were closer than this"
        />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Actual vs forecast</h2>
          <Legend
            items={[
              { label: 'Actual', color: seriesColor.actual },
              { label: forecastLabel, color: seriesColor.forecast },
            ]}
          />
        </div>
        <p className="muted">
          Each hour uses the latest forecast published at least {data.horizon} h before it.{' '}
          {stats ? `${num(stats.count)} hours compared.` : 'No forecasts were published that far ahead.'}
        </p>
        <div className="unit">GW</div>
        <GenerationChart points={data.points} forecastLabel={forecastLabel} scale="range" />
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Error by forecast horizon</h2>
            <Legend
              items={[
                { label: 'MAE', color: seriesColor.mae },
                { label: 'Mean error', color: seriesColor.bias },
              ]}
            />
          </div>
          <p className="muted">
            Shaded: lead times behind a {decisionTime} day-ahead decision. Click to pick a horizon.
          </p>
          <div className="unit">GW</div>
          <HorizonChart
            rows={data.by_horizon}
            selected={data.horizon}
            dayAheadRange={dayAheadRange}
            onPick={onPickHorizon}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Error by forecast size</h2>
            <Legend
              items={[
                { label: 'Mean error', color: seriesColor.bias, kind: 'bar' },
                { label: 'P10–P90', color: 'var(--text-2)' },
              ]}
            />
          </div>
          <p className="muted">At {data.horizon} h ahead, grouped by the forecast value. Positive means wind came in short.</p>
          <div className="unit">GW</div>
          <LevelChart rows={data.by_level} />
          <div className="axis-caption">Forecast, GW</div>
        </section>
      </div>
    </div>
  )
}
