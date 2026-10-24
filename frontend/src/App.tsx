import { useEffect, useState } from 'react'
import AccuracyView, { type AccuracySettings } from './components/AccuracyView'
import DayAheadView, { type DayAheadSettings } from './components/DayAheadView'
import { dayLabel } from './format'
import { useApi } from './hooks'
import type { Meta } from './types'

type Tab = 'day-ahead' | 'accuracy'

const tabFromHash = (): Tab => (window.location.hash === '#accuracy' ? 'accuracy' : 'day-ahead')

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const { data: meta, error } = useApi<Meta>('/api/meta')

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Wind Forecast Monitor</h1>
          <p className="muted">
            GB national wind for day-ahead buying
            {meta && ` · deliveries ${dayLabel(meta.first_delivery_day)} – ${dayLabel(meta.last_delivery_day)}`}
          </p>
        </div>
        <nav className="tabs">
          <a href="#day-ahead" aria-current={tab === 'day-ahead' ? 'page' : undefined}>
            Day-ahead view
          </a>
          <a href="#accuracy" aria-current={tab === 'accuracy' ? 'page' : undefined}>
            Forecast accuracy
          </a>
        </nav>
      </header>

      <main>
        {error && <p className="notice">Could not load data: {error}</p>}
        {meta && <Views meta={meta} tab={tab} />}
      </main>

      <footer className="muted">
        Data from Elexon BMRS: actual generation (FUELHH, fuel type WIND) and wind forecasts (WINDFOR). Forecasts more
        than 48 h ahead are ignored. All times are UK local time.
      </footer>
    </div>
  )
}

function Views({ meta, tab }: { meta: Meta; tab: Tab }) {
  // kept up here so switching tabs doesn't throw away what was picked
  const [dayAhead, setDayAhead] = useState<DayAheadSettings>({
    day: meta.last_delivery_day,
    decisionTime: meta.default_decision_time,
  })
  const [accuracy, setAccuracy] = useState<AccuracySettings>({
    start: meta.first_delivery_day,
    end: meta.last_delivery_day,
    horizon: 24,
  })

  return tab === 'day-ahead' ? (
    <DayAheadView meta={meta} settings={dayAhead} onChange={setDayAhead} />
  ) : (
    <AccuracyView meta={meta} settings={accuracy} onChange={setAccuracy} />
  )
}
