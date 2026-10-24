from datetime import date, datetime, timezone

import httpx

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def format_time(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_actuals(client: httpx.Client, first_day: date, last_day: date) -> list[tuple[datetime, int]]:
    resp = client.get(
        f"{BASE_URL}/FUELHH/stream",
        params={
            "settlementDateFrom": first_day.isoformat(),
            "settlementDateTo": last_day.isoformat(),
            "fuelType": "WIND",
        },
    )
    resp.raise_for_status()
    return [(parse_time(row["startTime"]), row["generation"]) for row in resp.json()]


def fetch_forecasts(client: httpx.Client, start: datetime, end: datetime) -> list[tuple[datetime, datetime, int]]:
    """WINDFOR rows published in [start, end), as (publish_time, start_time, mw)."""
    resp = client.get(
        f"{BASE_URL}/WINDFOR/stream",
        params={"publishDateTimeFrom": format_time(start), "publishDateTimeTo": format_time(end)},
    )
    resp.raise_for_status()
    rows = []
    for row in resp.json():
        published = parse_time(row["publishTime"])
        if start <= published < end:
            rows.append((published, parse_time(row["startTime"]), row["generation"]))
    return rows
