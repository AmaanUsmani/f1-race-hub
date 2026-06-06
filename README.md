# F1 Race Hub

A Formula 1 dashboard powered by FastF1. Browse the season calendar, championship standings, race results, qualifying, tyre strategy, weather, pit stops, and more. Includes a desktop race replay app.

## Prerequisites

- **Python 3.x** (any modern version) — for the Flask backend and frontend server
- **Python 3.12 or 3.11** — specifically required for the Replay feature (the `arcade` library has no wheels for Python 3.13+)

Download Python from [python.org](https://www.python.org/downloads/). On Windows, make sure to check **"Add Python to PATH"** during installation.

## Quick Start (Windows)

Double-click `start.bat`.

That's it. The script will:
1. Install backend dependencies (`fastf1`, `flask`, `flask-cors`) if not already present
2. Install replay dependencies (`arcade`, `pyside6`, etc.) using Python 3.12/3.11 if available
3. Start the Flask backend on `http://localhost:5001`
4. Start a static file server on `http://localhost:5500`
5. Open the dashboard in your browser

Two terminal windows will open — one for each server. Close them to stop the app.

## Manual Setup

If you prefer to run things separately:

**1. Install backend dependencies**
```
cd FastF1/backend
pip install -r requirements.txt
```

**2. Install replay dependencies** (requires Python 3.12 or 3.11)
```
py -3.12 -m pip install -r FastF1/replay/requirements.txt
```

**3. Start the backend**
```
cd FastF1/backend
python server.py
```
Backend runs on `http://localhost:5001`. First load of a session will be slow while FastF1 downloads and caches data — subsequent loads are instant.

**4. Start the frontend server**
```
cd FastF1
python -m http.server 5500
```

**5. Open the dashboard**

Navigate to `http://localhost:5500/index.html`.

## First Load

FastF1 downloads session data from the official F1 timing feed and caches it to `backend/cache/`. The first time you open a race the backend may take 15–60 seconds to respond — this is normal. Once cached, the same session loads in under a second.

## Replay Feature

The Replay tab on any race page launches a separate desktop window powered by the [f1-race-replay](https://github.com/IAmTomShaw/f1-race-replay) app (located in `replay/`). It requires Python 3.12 or 3.11 due to the `arcade` dependency.

When you click **Launch Race Replay**, the backend streams loading progress to the UI. The desktop window appears once FastF1 finishes loading the session data.

## Project Structure

```
FastF1/
├── start.bat              # One-click launcher (Windows)
├── index.html             # App entry point
├── backend/
│   ├── server.py          # Flask API server (port 5001)
│   ├── requirements.txt   # fastf1, flask, flask-cors
│   └── cache/             # FastF1 disk cache (auto-created)
├── replay/                # Desktop replay app (f1-race-replay)
│   ├── main.py
│   └── requirements.txt   # arcade, pyside6, etc. (needs Python 3.12/3.11)
├── css/                   # Stylesheets
└── js/
    ├── config.js           # Team colors, driver images, team logos
    ├── api.js              # All fetch calls
    ├── app.js              # Boot and navigation
    ├── sections/
    │   ├── race.js         # Race, qualifying, sprint, practice, tyres, weather tabs
    │   └── standings.js    # Driver and constructor championship tables
    └── pages/
        ├── home.js
        └── season.js
```

## Troubleshooting

**Backend not starting** — make sure `pip install -r backend/requirements.txt` completed without errors and that you're running Python 3.x.

**"Replay process exited early"** — Python 3.12 or 3.11 is not installed, or replay dependencies were not installed. Re-run `start.bat` after installing Python 3.12 from python.org.

**Standings not loading** — the standings are fetched from the Jolpica API directly in the browser. Check your internet connection.

**Slow first load** — expected. FastF1 is downloading raw timing data. Wait for the loading indicator to finish, or check the backend terminal for progress.
