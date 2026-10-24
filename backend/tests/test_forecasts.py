from datetime import datetime, timedelta, timezone

from app.forecasts import ErrorBands, WindData, error_stats, percentile


def utc(day, hour, minute=0):
    return datetime(2026, 1, day, hour, minute, tzinfo=timezone.utc)


TARGET = utc(10, 12)

FORECASTS = [
    (utc(8, 2, 30), TARGET, 9000),  # 57.5h ahead, outside the 48h window
    (utc(9, 7, 30), TARGET, 10000),  # 28.5h ahead
    (utc(10, 4, 30), TARGET, 11000),  # 7.5h ahead
    (utc(10, 9, 30), TARGET, 12000),  # 2.5h ahead
    (utc(10, 15, 30), TARGET, 13000),  # published after the target time
]


def make_data():
    return WindData({TARGET: 11500}, FORECASTS)


def test_latest_forecast_respects_cutoff():
    data = make_data()
    assert data.latest_forecast(TARGET, utc(10, 9, 0)).mw == 11000
    assert data.latest_forecast(TARGET, utc(10, 9, 30)).mw == 12000
    assert data.latest_forecast(TARGET, utc(10, 23, 0)).mw == 12000


def test_forecasts_beyond_48h_are_ignored():
    data = make_data()
    assert data.latest_forecast(TARGET, utc(9, 0, 0)) is None


def test_horizon_uses_latest_forecast_at_least_that_far_ahead():
    data = make_data()
    start, end = TARGET, TARGET + timedelta(hours=1)
    assert data.at_horizon(start, end, 0)[TARGET].mw == 12000
    assert data.at_horizon(start, end, 3)[TARGET].mw == 11000
    assert data.at_horizon(start, end, 8)[TARGET].mw == 10000
    assert data.at_horizon(start, end, 29) == {}


def test_error_sign_is_forecast_minus_actual():
    stats = error_stats([(10000, 11000), (10000, 9000), (10000, 12000)])
    assert stats.bias == round(2000 / 3, 1)
    assert stats.mae == round(4000 / 3, 1)
    assert stats.max_abs == 2000


def test_percentile_matches_linear_interpolation():
    assert percentile([0, 10, 20, 30, 40], 0.5) == 20
    assert percentile([0, 10], 0.9) == 9


def test_error_bands_follow_forecast_size():
    calm = [(1000 + i, 1000 + i) for i in range(50)]
    windy = [(15000, 20000 + i) for i in range(50)]
    bands = ErrorBands(calm + windy, groups=2)
    low, high = bands.actual_range(20020)
    assert low < 15100 and high < 16000
    low, high = bands.actual_range(1020)
    assert low <= 1020 <= high
