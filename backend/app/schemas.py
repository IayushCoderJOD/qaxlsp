from datetime import date, datetime

from pydantic import BaseModel

from .forecasts import ErrorStats


class Meta(BaseModel):
    first_delivery_day: date
    last_delivery_day: date
    max_horizon: int
    default_decision_time: str


class Point(BaseModel):
    time: datetime
    actual: int | None = None
    forecast: int | None = None
    low: int | None = None
    high: int | None = None


class Run(BaseModel):
    published_at: datetime
    available: bool
    used: bool


class DaySummary(BaseModel):
    forecast_mwh: float | None = None
    p10_mwh: float | None = None
    actual_mwh: float | None = None
    forecast_min: int | None = None
    forecast_max: int | None = None
    errors: ErrorStats | None = None


class DayAhead(BaseModel):
    delivery_day: date
    decided_at: datetime
    forecast_published_at: datetime | None = None
    runs: list[Run]
    points: list[Point]
    summary: DaySummary
    month: ErrorStats | None = None


class LevelStats(BaseModel):
    lower: int
    upper: int
    stats: ErrorStats


class HorizonStats(BaseModel):
    horizon: int
    stats: ErrorStats


class Accuracy(BaseModel):
    horizon: int
    points: list[Point]
    stats: ErrorStats | None = None
    by_level: list[LevelStats]
    by_horizon: list[HorizonStats]
