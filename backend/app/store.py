"""January snapshot of the Elexon data.

A month of WINDFOR takes anywhere from a few seconds to ~30s to come back, which
is too slow for a serverless cold start, and January is history anyway, so the
data lives in data/*.csv. Re-pull it with:

    python -m app.store
"""

import csv
from datetime import datetime, time, timedelta
from functools import lru_cache

import httpx

from .config import DATA_DIR, FIRST_DELIVERY_DAY, LAST_DELIVERY_DAY, MAX_HORIZON_HOURS, UK
from .elexon import fetch_actuals, fetch_forecasts, format_time, parse_time
from .forecasts import WindData

ACTUALS_CSV = DATA_DIR / "actuals.csv"
FORECASTS_CSV = DATA_DIR / "forecasts.csv"


def refresh() -> None:
    window_start = datetime.combine(FIRST_DELIVERY_DAY, time(), UK)
    window_end = datetime.combine(LAST_DELIVERY_DAY + timedelta(days=1), time(), UK)

    with httpx.Client(timeout=120) as client:
        actuals = fetch_actuals(client, FIRST_DELIVERY_DAY, LAST_DELIVERY_DAY)
        forecasts = fetch_forecasts(client, window_start - timedelta(hours=MAX_HORIZON_HOURS), window_end)

    DATA_DIR.mkdir(exist_ok=True)
    with ACTUALS_CSV.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["start_time", "generation"])
        writer.writerows((format_time(t), mw) for t, mw in sorted(actuals))
    with FORECASTS_CSV.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["publish_time", "start_time", "generation"])
        writer.writerows((format_time(p), format_time(t), mw) for p, t, mw in sorted(forecasts))

    print(f"saved {len(actuals)} actuals and {len(forecasts)} forecast rows to {DATA_DIR}")


@lru_cache
def load() -> WindData:
    if not ACTUALS_CSV.exists() or not FORECASTS_CSV.exists():
        refresh()

    with ACTUALS_CSV.open() as f:
        actuals = {parse_time(row["start_time"]): int(row["generation"]) for row in csv.DictReader(f)}
    with FORECASTS_CSV.open() as f:
        forecasts = [
            (parse_time(row["publish_time"]), parse_time(row["start_time"]), int(row["generation"]))
            for row in csv.DictReader(f)
        ]
    return WindData(actuals, forecasts)


if __name__ == "__main__":
    refresh()
