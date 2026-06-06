// All requests go to the local Flask backend — no CORS proxy needed.
async function apiFetch(endpoint) {
    const url = `${CONFIG.API_BASE}${endpoint}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${endpoint} → HTTP ${res.status}`);
    return res.json();
}

// ── Calendar ───────────────────────────────────────────────────
async function getMeetings(year) {
    return apiFetch(`/api/meetings?year=${year}`);
}

// ── Sessions ───────────────────────────────────────────────────
async function getSessions(meetingKey) {
    return apiFetch(`/api/sessions?meeting_key=${meetingKey}`);
}

async function getRaceSession(meetingKey) {
    const sessions = await apiFetch(`/api/sessions?meeting_key=${meetingKey}&session_name=Race`);
    return sessions[0] ?? null;
}

async function getQualifyingSession(meetingKey) {
    const sessions = await apiFetch(`/api/sessions?meeting_key=${meetingKey}&session_name=Qualifying`);
    return sessions[0] ?? null;
}

// ── Race data ──────────────────────────────────────────────────
async function getSessionResult(sessionKey) {
    return apiFetch(`/api/session_result?session_key=${encodeURIComponent(sessionKey)}`);
}

async function getDrivers(sessionKey) {
    return apiFetch(`/api/drivers?session_key=${encodeURIComponent(sessionKey)}`);
}

async function getLaps(sessionKey) {
    return apiFetch(`/api/laps?session_key=${encodeURIComponent(sessionKey)}`);
}

async function getStints(sessionKey) {
    return apiFetch(`/api/stints?session_key=${encodeURIComponent(sessionKey)}`);
}

async function getPit(sessionKey) {
    return apiFetch(`/api/pit?session_key=${encodeURIComponent(sessionKey)}`);
}

async function getWeather(sessionKey) {
    return apiFetch(`/api/weather?session_key=${encodeURIComponent(sessionKey)}`);
}

async function getRaceControl(sessionKey) {
    return apiFetch(`/api/race_control?session_key=${encodeURIComponent(sessionKey)}`);
}

async function getStartingGrid(sessionKey) {
    return apiFetch(`/api/starting_grid?session_key=${encodeURIComponent(sessionKey)}`);
}

// ── Season race winners (Jolpica) ─────────────────────────────
async function getRaceWinners(year) {
    const res = await fetch(`${CONFIG.JOLPICA_BASE}/${year}/results/1.json?limit=100`);
    if (!res.ok) throw new Error(`Jolpica results → HTTP ${res.status}`);
    const data = await res.json();
    return data.MRData.RaceTable.Races ?? [];
}

// ── Driver headshots — static map from Formula1.com CDN ───────
async function getDriverHeadshots() {
    return Object.fromEntries(
        Object.entries(DRIVER_IMAGES).map(([code, url]) => [code, { headshot_url: url }])
    );
}

// ── Championship standings (Jolpica) ──────────────────────────
async function getDriverStandings(year) {
    const res = await fetch(`${CONFIG.JOLPICA_BASE}/${year}/driverStandings.json`);
    if (!res.ok) throw new Error(`Jolpica driverStandings → HTTP ${res.status}`);
    const data = await res.json();
    return data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
}

async function getConstructorStandings(year) {
    const res = await fetch(`${CONFIG.JOLPICA_BASE}/${year}/constructorStandings.json`);
    if (!res.ok) throw new Error(`Jolpica constructorStandings → HTTP ${res.status}`);
    const data = await res.json();
    return data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [];
}

// ── Wallpapers ────────────────────────────────────────────────
async function getWallpapers() {
    return apiFetch('/api/wallpapers');
}

// ── Launch desktop replay app ─────────────────────────────────
async function launchReplay(year, roundNum, sessionType = 'Race') {
    const res = await fetch(`${CONFIG.API_BASE}/api/launch_replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, round: roundNum, session: sessionType }),
    });
    return res.json();
}
