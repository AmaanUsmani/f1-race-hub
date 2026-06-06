import os
import sys
import subprocess
import math
import shutil
import json
import queue
import threading
from functools import lru_cache

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import fastf1
import pandas as pd

app = Flask(__name__)
CORS(app)

cache_dir = os.path.join(os.path.dirname(__file__), 'cache')
os.makedirs(cache_dir, exist_ok=True)
fastf1.Cache.enable_cache(cache_dir)

# ── Session name mapping: FastF1 ↔ frontend ────────────────────
FF1_TO_DISPLAY = {
    'FP1': 'Practice 1',
    'FP2': 'Practice 2',
    'FP3': 'Practice 3',
}
DISPLAY_TO_FF1 = {v: k for k, v in FF1_TO_DISPLAY.items()}

def ff1_name(display): return DISPLAY_TO_FF1.get(display, display)
def display_name(ff1): return FF1_TO_DISPLAY.get(str(ff1), str(ff1))

# ── Type-safe converters ───────────────────────────────────────
def safe_int(v):
    try:
        return None if pd.isna(v) else int(v)
    except Exception:
        return None

def safe_float(v):
    try:
        if pd.isna(v): return None
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return None

def safe_str(v):
    if v is None: return None
    try:
        return None if pd.isna(v) else str(v)
    except Exception:
        return str(v)

def td_to_sec(td):
    """Timedelta → float seconds, or None."""
    if td is None: return None
    try:
        return None if pd.isna(td) else float(td.total_seconds())
    except Exception:
        return None

def ts_to_iso(ts):
    """Timestamp → ISO string (UTC), or None."""
    if ts is None: return None
    try:
        return None if pd.isna(ts) else pd.Timestamp(ts).isoformat() + 'Z'
    except Exception:
        return None

def session_ts_to_iso(time_val, t0):
    """
    FastF1 relative session time (Timedelta) → absolute ISO string.
    Falls back to treating time_val as an absolute Timestamp if t0 is unavailable.
    """
    if time_val is None: return None
    try:
        if pd.isna(time_val): return None
    except Exception:
        pass
    try:
        if hasattr(time_val, 'total_seconds') and t0 is not None:
            return (pd.Timestamp(t0) + time_val).isoformat()
        return pd.Timestamp(time_val).isoformat()
    except Exception:
        return None

# ── Key parsing ────────────────────────────────────────────────
def parse_meeting_key(key):
    """'2025_1' → (2025, 1)"""
    parts = str(key).split('_', 1)
    return int(parts[0]), int(parts[1])

def parse_session_key(key):
    """'2025_1_Race' → (2025, 1, 'Race')"""
    parts = str(key).split('_', 2)
    return int(parts[0]), int(parts[1]), parts[2]

# ── Cached session loader ──────────────────────────────────────
@lru_cache(maxsize=20)
def load_session(year, round_num, session_display_name):
    """Load and cache a FastF1 session. Telemetry skipped (not needed for dashboard)."""
    session = fastf1.get_session(year, round_num, ff1_name(session_display_name))
    session.load(laps=True, telemetry=False, weather=True, messages=True, livedata=None)
    return session

# ══════════════════════════════════════════════════════════════
#  MEETINGS  —  GET /api/meetings?year=YYYY
# ══════════════════════════════════════════════════════════════
@app.route('/api/meetings')
def get_meetings():
    year = int(request.args.get('year', pd.Timestamp.now().year))
    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    meetings = []
    for _, row in schedule.iterrows():
        round_num = int(row['RoundNumber'])

        # First session date as weekend start
        date_start = None
        for i in range(1, 6):
            col = f'Session{i}DateUtc'
            if col in row:
                try:
                    if pd.notna(row[col]):
                        date_start = pd.Timestamp(row[col]).isoformat() + 'Z'
                        break
                except Exception:
                    pass
        if not date_start:
            date_start = ts_to_iso(row.get('EventDate'))

        meetings.append({
            'meeting_key':       f'{year}_{round_num}',
            'meeting_name':      safe_str(row.get('OfficialEventName') or row.get('EventName', '')),
            'country_name':      safe_str(row.get('Country', '')),
            'location':          safe_str(row.get('Location', '')),
            'circuit_short_name':safe_str(row.get('Location', '')),
            'date_start':        date_start,
        })
    return jsonify(meetings)

# ══════════════════════════════════════════════════════════════
#  SESSIONS  —  GET /api/sessions?meeting_key=K[&session_name=N]
# ══════════════════════════════════════════════════════════════
@app.route('/api/sessions')
def get_sessions():
    meeting_key     = request.args.get('meeting_key', '')
    name_filter     = request.args.get('session_name')
    try:
        year, round_num = parse_meeting_key(meeting_key)
        event = fastf1.get_event(year, round_num)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    sessions = []
    for i in range(1, 6):
        raw_name = event.get(f'Session{i}')
        raw_date = event.get(f'Session{i}DateUtc')
        if not raw_name or (isinstance(raw_name, float) and math.isnan(raw_name)):
            continue
        raw_name = str(raw_name).strip()
        if not raw_name:
            continue

        dname = display_name(raw_name)
        if name_filter and dname != name_filter:
            continue

        skey = f'{year}_{round_num}_{dname}'
        try:
            date_iso = (pd.Timestamp(raw_date).isoformat() + 'Z') if pd.notna(raw_date) else None
        except Exception:
            date_iso = None

        sessions.append({
            'session_key':  skey,
            'meeting_key':  meeting_key,
            'session_name': dname,
            'date_start':   date_iso,
            'date_end':     None,
        })
    return jsonify(sessions)

# ══════════════════════════════════════════════════════════════
#  SESSION RESULT  —  GET /api/session_result?session_key=K
# ══════════════════════════════════════════════════════════════
@app.route('/api/session_result')
def get_session_result():
    sk = request.args.get('session_key', '')
    try:
        year, rnd, sname = parse_session_key(sk)
        session = load_session(year, rnd, sname)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    results = session.results
    if results is None or results.empty:
        return jsonify([])

    # Total laps from winner's laps
    total_laps = None
    try:
        laps = session.laps
        if not laps.empty:
            winner_num = str(results.sort_values('Position').iloc[0]['DriverNumber'])
            wlaps = laps[laps['DriverNumber'] == winner_num]
            if not wlaps.empty:
                total_laps = int(wlaps['LapNumber'].max())
    except Exception:
        pass

    sorted_r = results.sort_values('Position')
    winner_row = sorted_r.iloc[0] if not sorted_r.empty else None
    winner_time_sec = td_to_sec(winner_row.get('Time')) if winner_row is not None else None

    out = []
    for _, row in sorted_r.iterrows():
        pos        = safe_int(row.get('Position'))
        status     = safe_str(row.get('Status', '')) or ''
        classified = safe_str(row.get('ClassifiedPosition', '')) or ''

        dsq = classified == 'D'
        dns = classified in ['W', 'F']
        dnf = (not dsq and not dns and
               classified in ['R', 'E', 'N', 'NC'] or
               (not dsq and not dns and
                classified not in [str(i) for i in range(1, 21)] and
                not status.startswith('+') and
                status not in ['Finished'] and
                classified not in ['D', 'W', 'F']))

        if pos == 1:
            gap      = 0
            duration = winner_time_sec
        else:
            duration = None
            time_td  = row.get('Time')
            gap      = td_to_sec(time_td)
            if gap is None and status.startswith('+') and 'Lap' in status:
                gap = status   # "+1 Lap", "+2 Laps", etc.

        out.append({
            'driver_number':   safe_int(row.get('DriverNumber')),
            'position':        pos,
            'full_name':       safe_str(row.get('FullName', '')),
            'name_acronym':    safe_str(row.get('Abbreviation', '')),
            'team_name':       safe_str(row.get('TeamName', '')),
            'team_colour':     safe_str(row.get('TeamColor', '')),
            'headshot_url':    '',
            'gap_to_leader':   gap,
            'duration':        duration,
            'number_of_laps':  total_laps if pos == 1 else None,
            'points':          safe_float(row.get('Points', 0)) or 0,
            'status':          status,
            'dnf':             bool(dnf),
            'dns':             bool(dns),
            'dsq':             bool(dsq),
            # For qualifying sessions — best Q time
            'lap_duration':    (td_to_sec(row.get('Q3')) or
                                td_to_sec(row.get('Q2')) or
                                td_to_sec(row.get('Q1'))),
        })
    return jsonify(out)

# ══════════════════════════════════════════════════════════════
#  DRIVERS  —  GET /api/drivers?session_key=K
# ══════════════════════════════════════════════════════════════
@app.route('/api/drivers')
def get_drivers():
    sk = request.args.get('session_key', '')
    try:
        year, rnd, sname = parse_session_key(sk)
        session = load_session(year, rnd, sname)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    results = session.results
    if results is None or results.empty:
        return jsonify([])

    out = []
    for _, row in results.iterrows():
        out.append({
            'driver_number': safe_int(row.get('DriverNumber')),
            'name_acronym':  safe_str(row.get('Abbreviation', '')),
            'full_name':     safe_str(row.get('FullName', '')),
            'team_name':     safe_str(row.get('TeamName', '')),
            'team_colour':   safe_str(row.get('TeamColor', '')),
            'headshot_url':  '',
        })
    return jsonify(out)

# ══════════════════════════════════════════════════════════════
#  LAPS  —  GET /api/laps?session_key=K
# ══════════════════════════════════════════════════════════════
@app.route('/api/laps')
def get_laps():
    sk = request.args.get('session_key', '')
    try:
        year, rnd, sname = parse_session_key(sk)
        session = load_session(year, rnd, sname)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    laps = session.laps
    if laps is None or laps.empty:
        return jsonify([])

    out = []
    for _, row in laps.iterrows():
        out.append({
            'driver_number':    safe_int(row.get('DriverNumber')),
            'lap_number':       safe_int(row.get('LapNumber')),
            'lap_duration':     td_to_sec(row.get('LapTime')),
            'duration_sector_1':td_to_sec(row.get('Sector1Time')),
            'duration_sector_2':td_to_sec(row.get('Sector2Time')),
            'duration_sector_3':td_to_sec(row.get('Sector3Time')),
            'i1_speed':         safe_float(row.get('SpeedI1')),
            'i2_speed':         safe_float(row.get('SpeedI2')),
            'st_speed':         safe_float(row.get('SpeedST')),
            'position':         safe_int(row.get('Position')),
            'cumulative_time':  td_to_sec(row.get('Time')),
        })
    return jsonify(out)

# ══════════════════════════════════════════════════════════════
#  STINTS  —  GET /api/stints?session_key=K
# ══════════════════════════════════════════════════════════════
@app.route('/api/stints')
def get_stints():
    sk = request.args.get('session_key', '')
    try:
        year, rnd, sname = parse_session_key(sk)
        session = load_session(year, rnd, sname)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    laps = session.laps
    if laps is None or laps.empty:
        return jsonify([])

    stints = []
    try:
        for (driver_num, stint_id), group in laps.groupby(['DriverNumber', 'Stint']):
            group_sorted = group.sort_values('LapNumber')
            compound = safe_str(group_sorted['Compound'].iloc[0]) or 'UNKNOWN'
            stints.append({
                'driver_number':      safe_int(driver_num),
                'stint_number':       safe_int(stint_id),
                'compound':           compound.upper(),
                'lap_start':          safe_int(group_sorted['LapNumber'].min()),
                'lap_end':            safe_int(group_sorted['LapNumber'].max()),
                'tyre_age_at_start':  safe_int(group_sorted['TyreLife'].iloc[0])
                                      if 'TyreLife' in group_sorted.columns else 0,
            })
    except Exception as e:
        return jsonify({'error': f'Stint processing failed: {e}'}), 500

    return jsonify(stints)

# ══════════════════════════════════════════════════════════════
#  PIT STOPS  —  GET /api/pit?session_key=K
# ══════════════════════════════════════════════════════════════
@app.route('/api/pit')
def get_pit():
    sk = request.args.get('session_key', '')
    try:
        year, rnd, sname = parse_session_key(sk)
        session = load_session(year, rnd, sname)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    laps = session.laps
    if laps is None or laps.empty or 'PitInTime' not in laps.columns:
        return jsonify([])

    pit_laps = laps[laps['PitInTime'].notna()].sort_values(['DriverNumber', 'LapNumber'])
    stop_counters = {}
    pits = []
    for _, row in pit_laps.iterrows():
        drv = safe_int(row.get('DriverNumber'))
        stop_counters[drv] = stop_counters.get(drv, 0) + 1
        pits.append({
            'driver_number': drv,
            'lap_number':    safe_int(row.get('LapNumber')),
            'stop_number':   stop_counters[drv],
            'pit_duration':  None,  # FastF1 does not expose pit lane duration
        })
    return jsonify(pits)

# ══════════════════════════════════════════════════════════════
#  WEATHER  —  GET /api/weather?session_key=K
# ══════════════════════════════════════════════════════════════
@app.route('/api/weather')
def get_weather():
    sk = request.args.get('session_key', '')
    try:
        year, rnd, sname = parse_session_key(sk)
        session = load_session(year, rnd, sname)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    weather = session.weather_data
    if weather is None or weather.empty:
        return jsonify([])

    t0 = getattr(session, 't0_date', None) or getattr(session, 'date', None)

    out = []
    for _, row in weather.iterrows():
        rainfall = row.get('Rainfall')
        # FastF1 Rainfall is bool; convert to 0/1 for frontend `s.rainfall > 0` check
        if isinstance(rainfall, bool):
            rainfall = 1 if rainfall else 0
        else:
            rainfall = safe_float(rainfall) or 0

        out.append({
            'date':              session_ts_to_iso(row.get('Time'), t0),
            'air_temperature':   safe_float(row.get('AirTemp')),
            'track_temperature': safe_float(row.get('TrackTemp')),
            'humidity':          safe_float(row.get('Humidity')),
            'wind_speed':        safe_float(row.get('WindSpeed')),
            'wind_direction':    safe_float(row.get('WindDirection')),
            'rainfall':          rainfall,
        })
    return jsonify(out)

# ══════════════════════════════════════════════════════════════
#  RACE CONTROL  —  GET /api/race_control?session_key=K
# ══════════════════════════════════════════════════════════════
@app.route('/api/race_control')
def get_race_control():
    sk = request.args.get('session_key', '')
    try:
        year, rnd, sname = parse_session_key(sk)
        session = load_session(year, rnd, sname)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    rc = session.race_control_messages
    if rc is None or rc.empty:
        return jsonify([])

    t0 = getattr(session, 't0_date', None) or getattr(session, 'date', None)

    out = []
    for _, row in rc.iterrows():
        out.append({
            'date':          session_ts_to_iso(row.get('Time'), t0),
            'lap_number':    safe_int(row.get('Lap')),
            'flag':          safe_str(row.get('Flag', '')),
            'category':      safe_str(row.get('Category', '')),
            'message':       safe_str(row.get('Message', '')),
            'driver_number': safe_int(row.get('RacingNumber')),
            'scope':         safe_str(row.get('Scope', '')),
            'sector':        safe_int(row.get('Sector')),
        })
    return jsonify(out)

# ══════════════════════════════════════════════════════════════
#  STARTING GRID  —  GET /api/starting_grid?session_key=K
# Returns qualifying results (best lap per driver)
# ══════════════════════════════════════════════════════════════
@app.route('/api/starting_grid')
def get_starting_grid():
    sk = request.args.get('session_key', '')
    try:
        year, rnd, sname = parse_session_key(sk)
        session = load_session(year, rnd, sname)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    results = session.results
    if results is None or results.empty:
        return jsonify([])

    out = []
    for _, row in results.sort_values('Position').iterrows():
        # Best qualifying time: Q3 > Q2 > Q1
        best = (td_to_sec(row.get('Q3')) or
                td_to_sec(row.get('Q2')) or
                td_to_sec(row.get('Q1')))
        out.append({
            'driver_number': safe_int(row.get('DriverNumber')),
            'position':      safe_int(row.get('Position')),
            'lap_duration':  best,
            'name_acronym':  safe_str(row.get('Abbreviation', '')),
            'full_name':     safe_str(row.get('FullName', '')),
            'team_name':     safe_str(row.get('TeamName', '')),
            'headshot_url':  '',
        })
    return jsonify(out)

# ══════════════════════════════════════════════════════════════
#  LAUNCH REPLAY  —  POST /api/launch_replay
# Body: { year, round, session }
# ══════════════════════════════════════════════════════════════
@app.route('/api/launch_replay', methods=['POST'])
def launch_replay():
    data      = request.json or {}
    year      = data.get('year')
    round_num = data.get('round')
    session_type = data.get('session', 'Race')

    if not year or not round_num:
        return jsonify({'error': 'year and round are required'}), 400

    replay_dir = os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', 'replay')
    )

    flags = ['--viewer', '--verbose', '--year', str(year), '--round', str(round_num)]
    if session_type == 'Qualifying':
        flags.append('--qualifying')
    elif session_type == 'Sprint':
        flags.append('--sprint')

    python = _find_replay_python()
    if not python:
        return jsonify({'error': 'Python 3.12 or 3.11 not found. Install from https://python.org and run start.bat again.'}), 500

    if not os.path.isdir(replay_dir):
        return jsonify({'error': f'Replay directory not found: {replay_dir}'}), 500

    def generate():
        try:
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'
            proc = subprocess.Popen(
                [python, 'main.py'] + flags,
                cwd=replay_dir,
                stderr=subprocess.PIPE,
                stdout=subprocess.PIPE,
                text=True,
                bufsize=1,
                env=env,
            )
            threading.Thread(
                target=lambda: [print(f'[replay stdout] {l.rstrip()}') for l in proc.stdout if l.rstrip()],
                daemon=True,
            ).start()
        except Exception as e:
            yield f'data: {json.dumps({"error": str(e)})}\n\n'
            return

        q = queue.Queue()

        loaded = [False]  # mutable flag set by _reader when done signal sent

        def _reader():
            for line in proc.stderr:
                q.put(line.rstrip())
                if 'Finished loading data' in line:
                    loaded[0] = True
                    q.put(None)
                    for remaining in proc.stderr:
                        remaining = remaining.rstrip()
                        if remaining:
                            print(f'[replay post-load] {remaining}')
                    return
            # Process exited without ever printing "Finished loading data"
            q.put(None)

        threading.Thread(target=_reader, daemon=True).start()

        while True:
            try:
                line = q.get(timeout=60)
            except queue.Empty:
                yield f'data: {json.dumps({"error": "Timed out waiting for replay to load"})}\n\n'
                break
            if line is None:
                if loaded[0]:
                    yield f'data: {json.dumps({"done": True})}\n\n'
                else:
                    proc.wait()
                    yield f'data: {json.dumps({"error": f"Replay process exited early (code {proc.returncode}). Check Flask terminal for details."})}\n\n'
                break
            if line:
                yield f'data: {json.dumps({"msg": line})}\n\n'

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


def _find_replay_python():
    """Return a Python 3.11/3.12 executable path, preferring 3.12."""
    for ver in ('3.12', '3.11'):
        # Try the py launcher first (Windows)
        try:
            result = subprocess.run(['py', f'-{ver}', '-c', 'import sys; print(sys.executable)'],
                                    capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return result.stdout.strip()
        except FileNotFoundError:
            pass
        # Try bare python3.12 / python3.11 on PATH
        exe = shutil.which(f'python{ver}')
        if exe:
            return exe
    return None

# ══════════════════════════════════════════════════════════════
#  WALLPAPERS  —  GET /api/wallpapers
# Lists driver codes that have wallpaper files in img/wallpapers/
# ══════════════════════════════════════════════════════════════
@app.route('/api/wallpapers')
def get_wallpapers():
    wallpaper_dir = os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', 'img', 'wallpapers')
    )
    if not os.path.isdir(wallpaper_dir):
        return jsonify([])
    codes = []
    for f in os.listdir(wallpaper_dir):
        name, ext = os.path.splitext(f)
        if ext.lower() in ('.jpg', '.jpeg', '.png', '.webp'):
            codes.append(name.upper())
    return jsonify(sorted(codes))

# ══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print('FastF1 backend running on http://localhost:5001')
    app.run(port=5001, debug=False)
