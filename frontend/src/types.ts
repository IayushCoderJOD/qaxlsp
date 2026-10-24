export type ErrorStats = {
  count: number
  mae: number
  rmse: number
  bias: number
  p10: number
  p50: number
  p90: number
  p90_abs: number
  max_abs: number
  nmae: number
}

export type Meta = {
  first_delivery_day: string
  last_delivery_day: string
  max_horizon: number
  default_decision_time: string
}

export type Point = {
  time: string
  actual?: number
  forecast?: number
  low?: number
  high?: number
}

export type Run = {
  published_at: string
  available: boolean
  used: boolean
}

export type DayAhead = {
  delivery_day: string
  decided_at: string
  forecast_published_at?: string
  runs: Run[]
  points: Point[]
  summary: {
    forecast_mwh?: number
    p10_mwh?: number
    actual_mwh?: number
    forecast_min?: number
    forecast_max?: number
    errors?: ErrorStats
  }
  month?: ErrorStats
}

export type Accuracy = {
  horizon: number
  points: Point[]
  stats?: ErrorStats
  by_level: { lower: number; upper: number; stats: ErrorStats }[]
  by_horizon: { horizon: number; stats: ErrorStats }[]
}
