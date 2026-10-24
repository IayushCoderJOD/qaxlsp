from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

from . import store
from .config import DEFAULT_DECISION_TIME, FIRST_DELIVERY_DAY, LAST_DELIVERY_DAY, MAX_HORIZON_HOURS, UK
from .forecasts import HALF_HOUR, ErrorBands, by_level, day_window, error_stats, steps
from .schemas import Accuracy, DayAhead, DaySummary, HorizonStats, LevelStats, Meta, Point, Run

app = FastAPI(title="Wind Forecast Monitor")


def check_day(day: date) -> None:
    if not FIRST_DELIVERY_DAY <= day <= LAST_DELIVERY_DAY:
        raise HTTPException(422, f"Pick a day between {FIRST_DELIVERY_DAY} and {LAST_DELIVERY_DAY}")


def decision_moment(delivery_day: date, decision_time: time) -> datetime:
    return datetime.combine(delivery_day - timedelta(days=1), decision_time, UK).astimezone(timezone.utc)


@lru_cache(maxsize=32)
def track_record(decision_time: time) -> tuple[tuple[int, int], ...]:
    """(actual, forecast) for every delivery hour, using what was available at this decision time."""
    data = store.load()
    pairs = []
    day = FIRST_DELIVERY_DAY
    while day <= LAST_DELIVERY_DAY:
        start, end = day_window(day)
        decided_at = decision_moment(day, decision_time)
        pairs += data.pairs(data.forecast_series(start, end, lambda _: decided_at))
        day += timedelta(days=1)
    return tuple(pairs)


@app.get("/api/meta")
def meta() -> Meta:
    return Meta(
        first_delivery_day=FIRST_DELIVERY_DAY,
        last_delivery_day=LAST_DELIVERY_DAY,
        max_horizon=MAX_HORIZON_HOURS,
        default_decision_time=DEFAULT_DECISION_TIME.strftime("%H:%M"),
    )


@app.get("/api/day-ahead", response_model_exclude_none=True)
def day_ahead(day: date, decision_time: time = DEFAULT_DECISION_TIME) -> DayAhead:
    check_day(day)
    data = store.load()
    start, end = day_window(day)
    decided_at = decision_moment(day, decision_time)
    forecasts = data.forecast_series(start, end, lambda _: decided_at)
    history = list(track_record(decision_time))
    bands = ErrorBands(history) if history else None

    points = []
    for t in steps(start, end, HALF_HOUR):
        point = Point(time=t, actual=data.actuals.get(t))
        if t in forecasts:
            point.forecast = forecasts[t].mw
            if bands:
                point.low, point.high = bands.actual_range(point.forecast)
        points.append(point)

    used = {f.published for f in forecasts.values()}
    prev_start, prev_end = day_window(day - timedelta(days=1))
    runs = [
        Run(published_at=p, available=p <= decided_at, used=p in used)
        for p in data.runs
        if prev_start <= p < prev_end or p in used
    ]

    actuals = data.actuals_between(start, end)
    summary = DaySummary(errors=error_stats(data.pairs(forecasts)))
    if forecasts:
        values = [f.mw for f in forecasts.values()]
        summary.forecast_mwh = sum(values)
        summary.forecast_min = min(values)
        summary.forecast_max = max(values)
        if bands:
            summary.p10_mwh = sum(p.low for p in points if p.low is not None)
    if actuals:
        summary.actual_mwh = sum(actuals.values()) / 2

    return DayAhead(
        delivery_day=day,
        decided_at=decided_at,
        forecast_published_at=max(used) if used else None,
        runs=runs,
        points=points,
        summary=summary,
        month=error_stats(history),
    )


@app.get("/api/accuracy", response_model_exclude_none=True)
def accuracy(start: date, end: date, horizon: int = Query(24, ge=0, le=MAX_HORIZON_HOURS)) -> Accuracy:
    check_day(start)
    check_day(end)
    if end < start:
        raise HTTPException(422, "End date is before the start date")

    data = store.load()
    window_start, _ = day_window(start)
    _, window_end = day_window(end)

    forecasts = data.at_horizon(window_start, window_end, horizon)
    actuals = data.actuals_between(window_start, window_end)
    points = [
        Point(time=t, actual=actuals.get(t), forecast=forecasts[t].mw if t in forecasts else None)
        for t in sorted(actuals.keys() | forecasts.keys())
    ]

    pairs = data.pairs(forecasts)

    by_horizon = []
    for h in range(MAX_HORIZON_HOURS + 1):
        stats = error_stats(data.pairs(data.at_horizon(window_start, window_end, h)))
        if stats:
            by_horizon.append(HorizonStats(horizon=h, stats=stats))

    return Accuracy(
        horizon=horizon,
        points=points,
        stats=error_stats(pairs),
        by_level=[LevelStats(lower=lo, upper=hi, stats=stats) for lo, hi, stats in by_level(pairs)],
        by_horizon=by_horizon,
    )


# In the Docker image the built frontend sits next to the backend and FastAPI serves it.
# On Vercel the static files are served by the platform and this folder isn't bundled.
frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
