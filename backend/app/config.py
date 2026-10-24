from datetime import date, time
from pathlib import Path
from zoneinfo import ZoneInfo

UK = ZoneInfo("Europe/London")
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Day-ahead purchases are made on D-1, so decisions taken in January 2026
# cover deliveries from 2 Jan to 1 Feb.
FIRST_DELIVERY_DAY = date(2026, 1, 2)
LAST_DELIVERY_DAY = date(2026, 2, 1)

MAX_HORIZON_HOURS = 48

# EPEX GB day-ahead auction gate closure
DEFAULT_DECISION_TIME = time(9, 20)
