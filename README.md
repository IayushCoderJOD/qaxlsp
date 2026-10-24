# Wind Forecast Monitor

## Live app

Not deployed yet. Add the Vercel link here.

## Files and directories

```
.
├── api/
│   └── index.py              Vercel entry point, loads the FastAPI app
├── backend/
│   ├── app/
│   │   ├── main.py           API routes: /api/meta, /api/day-ahead, /api/accuracy
│   │   ├── forecasts.py      picks the forecast available at a cut-off time, error stats, P10–P90 range
│   │   ├── store.py          loads the January data snapshot (python -m app.store re-downloads it)
│   │   ├── elexon.py         client for the Elexon FUELHH and WINDFOR APIs
│   │   ├── schemas.py        API response models
│   │   └── config.py         period, UK time zone, 48 h horizon limit, default decision time
│   ├── data/                 actuals.csv and forecasts.csv downloaded from Elexon
│   ├── tests/                unit tests for the forecast logic (cd backend && pytest)
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── main.tsx          React entry point
│   │   ├── App.tsx           header, tabs, selected day and range
│   │   ├── components/       DayAheadView, AccuracyView, the charts and small UI pieces
│   │   ├── hooks.ts          data fetching and debounce hooks
│   │   ├── format.ts         number, date and UK time formatting
│   │   ├── types.ts          types for the API responses
│   │   └── styles.css        styling, light and dark theme
│   ├── public/               favicon
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts        dev server, sends /api requests to the backend
├── Dockerfile                builds the frontend, then serves it and the API from one container
├── docker-compose.yml
├── vercel.json               Vercel build and routing
├── requirements.txt          Python dependencies
├── requirements-dev.txt      Python dependencies plus pytest
└── .gitignore, .dockerignore, .vercelignore
```

## How to start the application

With Docker:

```bash
docker compose up --build
```

Then open http://localhost:8000.

Without Docker, start the backend:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd backend
../.venv/bin/uvicorn app.main:app --reload
```

Then start the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

## AI usage

Built with help from Claude Code, Anthropic's AI coding assistant.
