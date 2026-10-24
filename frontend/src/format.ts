const UK = 'Europe/London'

const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: UK, weekday: 'short', day: 'numeric', month: 'short' })
const shortDayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: UK, day: 'numeric', month: 'short' })
const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

type Instant = string | number

export const ukTime = (t: Instant) => timeFormat.format(new Date(t))
export const ukDay = (t: Instant) => dayFormat.format(new Date(t))
export const ukShortDay = (t: Instant) => shortDayFormat.format(new Date(t))
export const ukDayTime = (t: Instant) => `${ukDay(t)}, ${ukTime(t)}`

// '2026-01-15' -> 'Thu 15 Jan'. Noon UTC keeps it on the right day in any browser time zone.
export const dayLabel = (day: string) => ukDay(`${day}T12:00:00Z`)

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const num = (v: number) => whole.format(v)
export const mw = (v: number) => `${whole.format(v)} MW`
export const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${whole.format(Math.abs(v))}`
export const signedMw = (v: number) => `${signed(v)} MW`
export const gwh = (mwh: number) => `${(mwh / 1000).toFixed(1)} GWh`
export const pct = (v: number) => `${(v * 100).toFixed(1)}%`
export const gwTick = (v: number) => `${Number((v / 1000).toFixed(1))}`

export function duration(ms: number) {
  const minutes = Math.round(ms / 60000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h}h ${m}m` : `${h}h`
}
