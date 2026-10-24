import math
from bisect import bisect_right
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Callable, Iterable, NamedTuple

from .config import MAX_HORIZON_HOURS, UK

HOUR = timedelta(hours=1)
HALF_HOUR = timedelta(minutes=30)


class Forecast(NamedTuple):
    published: datetime
    mw: int


@dataclass
class ErrorStats:
    """Errors are forecast minus actual, so a positive error means wind came in short."""

    count: int
    mae: float
    rmse: float
    bias: float
    p10: float
    p50: float
    p90: float
    p90_abs: float
    max_abs: float
    nmae: float


def day_window(day: date) -> tuple[datetime, datetime]:
    """UTC start and end of a UK calendar day."""
    start = datetime.combine(day, time(), UK).astimezone(timezone.utc)
    end = datetime.combine(day + timedelta(days=1), time(), UK).astimezone(timezone.utc)
    return start, end


def steps(start: datetime, end: datetime, step: timedelta):
    t = start
    while t < end:
        yield t
        t += step


class WindData:
    def __init__(self, actuals: dict[datetime, int], forecasts: Iterable[tuple[datetime, datetime, int]]):
        self.actuals = actuals

        max_horizon = timedelta(hours=MAX_HORIZON_HOURS)
        by_target: dict[datetime, dict[datetime, int]] = defaultdict(dict)
        for published, target, mw in forecasts:
            if timedelta(0) <= target - published <= max_horizon:
                by_target[target][published] = mw

        self._forecasts = {t: [Forecast(p, mw) for p, mw in sorted(runs.items())] for t, runs in by_target.items()}
        self._publish_times = {t: [f.published for f in runs] for t, runs in self._forecasts.items()}
        self.runs = sorted({p for runs in by_target.values() for p in runs})

    def latest_forecast(self, target: datetime, published_by: datetime) -> Forecast | None:
        times = self._publish_times.get(target)
        if not times:
            return None
        i = bisect_right(times, published_by)
        return self._forecasts[target][i - 1] if i else None

    def forecast_series(
        self, start: datetime, end: datetime, published_by: Callable[[datetime], datetime]
    ) -> dict[datetime, Forecast]:
        """Hourly forecasts in [start, end). published_by(target) is the cut-off for that target."""
        series = {}
        for target in steps(start, end, HOUR):
            forecast = self.latest_forecast(target, published_by(target))
            if forecast:
                series[target] = forecast
        return series

    def at_horizon(self, start: datetime, end: datetime, hours: int) -> dict[datetime, Forecast]:
        lead = timedelta(hours=hours)
        return self.forecast_series(start, end, lambda target: target - lead)

    def actuals_between(self, start: datetime, end: datetime) -> dict[datetime, int]:
        return {t: mw for t, mw in self.actuals.items() if start <= t < end}

    def pairs(self, forecasts: dict[datetime, Forecast]) -> list[tuple[int, int]]:
        return [(self.actuals[t], f.mw) for t, f in forecasts.items() if t in self.actuals]


def percentile(ordered: list[float], q: float) -> float:
    # linear interpolation between closest ranks, same as numpy's default
    pos = (len(ordered) - 1) * q
    lo = math.floor(pos)
    hi = min(lo + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)


def error_stats(pairs: list[tuple[int, int]]) -> ErrorStats | None:
    if not pairs:
        return None
    errors = sorted(forecast - actual for actual, forecast in pairs)
    abs_errors = sorted(abs(e) for e in errors)
    n = len(errors)
    mae = sum(abs_errors) / n
    mean_actual = sum(actual for actual, _ in pairs) / n
    return ErrorStats(
        count=n,
        mae=round(mae, 1),
        rmse=round(math.sqrt(sum(e * e for e in errors) / n), 1),
        bias=round(sum(errors) / n, 1),
        p10=round(percentile(errors, 0.1), 1),
        p50=round(percentile(errors, 0.5), 1),
        p90=round(percentile(errors, 0.9), 1),
        p90_abs=round(percentile(abs_errors, 0.9), 1),
        max_abs=abs_errors[-1],
        nmae=round(mae / mean_actual, 4) if mean_actual else 0.0,
    )


class ErrorBands:
    """P10/P90 errors for forecasts of a similar size.

    Errors grow with wind level (big forecasts tend to come in well short), so a single
    band is too narrow on windy hours and too wide on calm ones. The history is split
    into equal-sized groups by forecast MW, each group gets its own quantiles, and we
    interpolate between groups so the band doesn't jump when the forecast crosses one.
    """

    def __init__(self, pairs: list[tuple[int, int]], groups: int = 5):
        ordered = sorted(pairs, key=lambda pair: pair[1])
        size = math.ceil(len(ordered) / groups)
        self.centres, self.p10s, self.p90s = [], [], []
        for i in range(0, len(ordered), size):
            chunk = ordered[i : i + size]
            errors = sorted(forecast - actual for actual, forecast in chunk)
            self.centres.append(chunk[len(chunk) // 2][1])
            self.p10s.append(percentile(errors, 0.1))
            self.p90s.append(percentile(errors, 0.9))

    def _interpolate(self, values: list[float], forecast_mw: int) -> float:
        if forecast_mw <= self.centres[0]:
            return values[0]
        if forecast_mw >= self.centres[-1]:
            return values[-1]
        i = bisect_right(self.centres, forecast_mw)
        x0, x1 = self.centres[i - 1], self.centres[i]
        weight = (forecast_mw - x0) / (x1 - x0) if x1 > x0 else 0
        return values[i - 1] + (values[i] - values[i - 1]) * weight

    def actual_range(self, forecast_mw: int) -> tuple[int, int]:
        # actual = forecast - error, so the high error quantile gives the low end
        low = forecast_mw - self._interpolate(self.p90s, forecast_mw)
        high = forecast_mw - self._interpolate(self.p10s, forecast_mw)
        return max(0, round(low)), round(high)


def by_level(pairs: list[tuple[int, int]], width: int = 3000) -> list[tuple[int, int, ErrorStats]]:
    groups = defaultdict(list)
    for actual, forecast in pairs:
        groups[forecast // width * width].append((actual, forecast))
    return [(lower, lower + width, error_stats(groups[lower])) for lower in sorted(groups)]
