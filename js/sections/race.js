// ── Module state ───────────────────────────────────────────────
let _raceDriversByNum  = {};
let _raceHeadshots     = {};
let _raceSessionKey    = null;
let _raceMeetingKey    = null;
let _raceMeeting       = null;
let _raceTargetId      = 'race-section';
let _cachedRaceResults = [];
let _cachedQualData    = null;  // { grid, driverMap } once loaded
let _cachedPitData     = null;  // pits array once loaded
let _meetingSessions   = [];    // all sessions for current meeting
let _cachedTabData     = {};    // { [tabKey]: data } for sprint/shootout/practice tabs
let _raceTabs          = [];    // built tab list for current meeting

// ── Public entry point ─────────────────────────────────────────
async function loadRace(meeting, targetId = 'race-section') {
    // Reset per-race state
    _raceSessionKey    = null;
    _raceMeetingKey    = meeting.meeting_key;
    _raceMeeting       = meeting;
    _raceTargetId      = targetId;
    _cachedRaceResults = [];
    _cachedQualData    = null;
    _cachedPitData     = null;
    _meetingSessions   = [];
    _cachedTabData     = {};
    _raceTabs          = [];
    // _raceMeeting set above — intentionally kept for tab switching after load
    if (typeof resetReplayModule === 'function') resetReplayModule();

    const section = document.getElementById(targetId);
    if (!section) return;

    const status = getRaceStatus(meeting);

    if (status === 'upcoming' || status === 'next') {
        section.innerHTML = renderUpcoming(meeting);
        startCountdown(meeting);
        return;
    }

    if (status === 'cancelled') {
        section.innerHTML = renderCancelledNotice(meeting);
        return;
    }

    section.innerHTML = renderRaceSkeleton();

    let sessionKey;
    try {
        const allSessions = await getSessions(meeting.meeting_key);
        _meetingSessions = allSessions ?? [];
        const sess = _meetingSessions.find(s => s.session_name === 'Race');
        sessionKey = sess?.session_key;
    } catch (e) { /* ignore */ }

    if (!sessionKey) {
        section.innerHTML = renderRaceError('Race session not found for this event.');
        return;
    }

    _raceSessionKey = sessionKey;

    const [resultRes, driverRes] = await Promise.allSettled([
        getSessionResult(sessionKey),
        getDrivers(sessionKey),
    ]);

    const rawResults = resultRes.status === 'fulfilled' ? resultRes.value : [];
    const results    = Array.isArray(rawResults) ? rawResults : [];
    const rawDrivers = driverRes.status === 'fulfilled' ? driverRes.value : [];
    const drivers    = Array.isArray(rawDrivers) ? rawDrivers : [];

    _raceDriversByNum = {};
    _raceHeadshots    = {};
    drivers.forEach(d => {
        if (d.driver_number != null) _raceDriversByNum[d.driver_number] = d;
        if (d.name_acronym) {
            const url = d.headshot_url || (DRIVER_IMAGES?.[d.name_acronym] ?? '');
            if (url) _raceHeadshots[d.name_acronym] = { headshot_url: url };
        }
    });

    const sorted = [...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
    _cachedRaceResults = sorted;

    const showTabs = targetId === 'race-section';

    if (showTabs) _raceTabs = buildTabs(_meetingSessions);

    let tabContentOpen = '<div class="race-tab-content">';
    if (showTabs) tabContentOpen = '<div class="race-tab-content" id="race-tab-content">';

    if (!results.length) {
        // Race weekend is live but the race itself hasn't happened yet —
        // still show the tab bar so sprint/FP/qualifying results are accessible.
        section.innerHTML =
            (showTabs ? renderRaceTabsBar('race', _raceTabs) : '') +
            tabContentOpen +
            renderRaceNotStarted(meeting) +
            '</div>';
        return;
    }

    section.innerHTML =
        renderHeroCard(meeting, sorted) +
        (showTabs ? renderRaceTabsBar('race', _raceTabs) : '') +
        tabContentOpen +
        renderPodium(sorted) +
        renderResultsTable(sorted) +
        '</div>';
}

// ── Helper: get driver object from a result row ────────────────
function driverFromResult(r) {
    return _raceDriversByNum[r.driver_number] ?? {};
}

// ══════════════════════════════════════════════════════════════
//  HERO CARD
// ══════════════════════════════════════════════════════════════
function renderHeroCard(meeting, results) {
    const winner    = results[0];
    const winnerDrv = driverFromResult(winner ?? {});
    const winnerName = winnerDrv.full_name ?? '—';
    const teamName  = winnerDrv.team_name ?? '—';
    const teamColor = resolveTeamColorByName(teamName);
    const flag      = getFlag(meeting.country_name);
    const date      = formatMonthYear(meeting.date_start);
    const laps      = winner?.number_of_laps ?? '—';
    const dnfCount  = results.filter(r => r.dnf).length;
    const raceTime  = winner?.duration ? formatRaceTime(winner.duration) : '—';

    return `
    <div class="race-hero" style="--hero-color:${teamColor}">
        <div class="race-hero-bg"></div>
        <div class="race-hero-content">
            <div class="race-hero-top">
                <span class="race-hero-flag">${flag}</span>
                <div>
                    <div class="race-hero-name">${meeting.country_name} Grand Prix</div>
                    <div class="race-hero-meta">${meeting.location} · ${date}</div>
                </div>
            </div>
            <div class="race-hero-winner">
                <span class="race-hero-trophy">🏆</span>
                <div>
                    <div class="race-hero-winner-name">${winnerName}</div>
                    <div class="race-hero-winner-team" style="color:${teamColor}">${teamName}</div>
                </div>
            </div>
            <div class="race-hero-stats">
                <div class="race-hero-stat">
                    <span class="race-hero-stat-val">${laps}</span>
                    <span class="race-hero-stat-label">Laps</span>
                </div>
                <div class="race-hero-stat">
                    <span class="race-hero-stat-val">${raceTime}</span>
                    <span class="race-hero-stat-label">Race Time</span>
                </div>
                <div class="race-hero-stat">
                    <span class="race-hero-stat-val">${results.length}</span>
                    <span class="race-hero-stat-label">Classified</span>
                </div>
                <div class="race-hero-stat">
                    <span class="race-hero-stat-val">${dnfCount || '0'}</span>
                    <span class="race-hero-stat-label">DNFs</span>
                </div>
            </div>
        </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
//  PODIUM
// ══════════════════════════════════════════════════════════════
function renderPodium(results) {
    const top3 = results.slice(0, 3);
    if (top3.length < 1) return '';

    const cards = [
        { pos: 2, result: top3[1] },
        { pos: 1, result: top3[0] },
        { pos: 3, result: top3[2] },
    ].filter(c => c.result);

    const medal = { 1: 'gold', 2: 'silver', 3: 'bronze' };

    const cardHTML = cards.map(({ pos, result }) => {
        const drv       = driverFromResult(result);
        const acro      = drv.name_acronym ?? String(result.driver_number ?? '?');
        const name      = drv.full_name ?? acro;
        const team      = drv.team_name ?? '—';
        const color     = resolveTeamColorByName(team);
        const photoData = _raceHeadshots[acro] ?? {};
        const url       = photoData.headshot_url ?? '';
        const gap       = pos === 1 ? 'WINNER' : formatGap(result.gap_to_leader);

        return `
        <div class="podium-card podium-p${pos}">
            <div class="podium-pos podium-pos-${medal[pos]}">${pos}</div>
            <div class="podium-photo" style="border-color:${color};background:${color}33">
                ${url
                    ? `<img src="${url}" alt="${acro}"
                            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ''}
                <span class="podium-initials"
                      style="display:${url ? 'none' : 'flex'};background:transparent;color:${color}">
                    ${acro}
                </span>
            </div>
            <div class="podium-name">${name.split(' ').pop()}</div>
            <div class="podium-team" style="color:${color}">${team}</div>
            <div class="podium-gap ${pos === 1 ? 'podium-winner-gap' : ''}">${gap}</div>
            <div class="podium-bar podium-bar-${medal[pos]}"></div>
        </div>`;
    }).join('');

    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">Podium</span>
        </div>
        <div class="podium-wrap">${cardHTML}</div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
//  RESULTS TABLE
// ══════════════════════════════════════════════════════════════
function renderResultsTable(results) {
    if (!results.length) return '';

    const rows = results.map((r, i) => {
        const pos       = r.position ?? i + 1;
        const drv       = driverFromResult(r);
        const acro      = drv.name_acronym ?? String(r.driver_number ?? '?');
        const name      = drv.full_name ?? acro;
        const team      = drv.team_name ?? '—';
        const color     = resolveTeamColorByName(team);
        const photoData = _raceHeadshots[acro] ?? {};
        const url       = photoData.headshot_url ?? '';
        const pts       = r.points ?? F1_POINTS[i] ?? 0;
        const gapStr    = pos === 1 ? 'WINNER' : formatGap(r.gap_to_leader);
        const statusBadge = renderStatusBadge(r);

        return `
        <div class="result-row">
            <span class="result-pos ${rankClass(pos)}">${pos}</span>
            <span class="result-team-bar" style="background:${color}"></span>
            <div class="result-photo" style="border-color:${color};background:${color}33">
                ${url
                    ? `<img src="${url}" alt="${acro}"
                            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ''}
                <span class="result-initials"
                      style="display:${url ? 'none' : 'flex'};background:transparent;color:${color}">
                    ${acro}
                </span>
            </div>
            <div class="result-info">
                <div class="result-name-row">
                    <span class="result-name">${name}</span>
                    <span class="result-code">${acro}</span>
                    ${statusBadge}
                </div>
                <div class="result-team-row">${team}</div>
            </div>
            <div class="result-gap">${gapStr}</div>
            <div class="result-pts">${pts > 0 ? pts + ' pts' : ''}</div>
        </div>`;
    }).join('');

    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">Race Results</span>
        </div>
        <div class="result-table-head">
            <span class="rth-pos">POS</span>
            <span class="rth-driver">Driver</span>
            <span class="rth-gap">Gap</span>
            <span class="rth-pts">Pts</span>
        </div>
        ${rows}
    </div>`;
}

// ── Status badge — uses boolean dnf/dns/dsq fields ─────────────
function renderStatusBadge(r) {
    if (r.dsq) return `<span class="result-badge result-badge-dsq">DSQ</span>`;
    if (r.dns) return `<span class="result-badge result-badge-dns">DNS</span>`;
    if (r.dnf) return `<span class="result-badge result-badge-dnf">DNF</span>`;
    return '';
}

// ══════════════════════════════════════════════════════════════
//  UPCOMING / SKELETON / ERROR STATES
// ══════════════════════════════════════════════════════════════
function renderUpcoming(meeting) {
    const flag = getFlag(meeting.country_name);
    const date = formatMonthYear(meeting.date_start);
    return `
    <div class="card race-upcoming">
        <div class="race-upcoming-inner">
            <div class="race-upcoming-flag">${flag}</div>
            <div class="race-upcoming-name">${meeting.country_name} Grand Prix</div>
            <div class="race-upcoming-meta">${meeting.location} · ${date}</div>
            <div class="race-countdown" id="race-countdown">—</div>
            <div class="race-upcoming-label">Until Race Weekend</div>
        </div>
    </div>`;
}

function renderRaceNotStarted(meeting) {
    const flag = getFlag(meeting.country_name);
    return `
    <div class="card race-upcoming">
        <div class="race-upcoming-inner">
            <div class="race-upcoming-flag">${flag}</div>
            <div class="race-upcoming-name">${meeting.country_name} Grand Prix</div>
            <div class="race-upcoming-meta" style="color:var(--muted)">Race hasn't started yet</div>
            <div class="race-upcoming-label">Check the other tabs for sprint &amp; practice results</div>
        </div>
    </div>`;
}

function renderCancelledNotice(meeting) {
    return `
    <div class="card race-upcoming">
        <div class="race-upcoming-inner">
            <div class="race-upcoming-flag">🚫</div>
            <div class="race-upcoming-name">${meeting.country_name} Grand Prix</div>
            <div class="race-upcoming-meta" style="color:#fb923c">Cancelled</div>
        </div>
    </div>`;
}

function renderRaceSkeleton() {
    const row = () => `
    <div class="result-row">
        <div class="sk" style="width:22px;height:22px;border-radius:4px;flex-shrink:0"></div>
        <div class="sk" style="width:3px;height:42px;border-radius:2px;flex-shrink:0"></div>
        <div class="sk" style="width:42px;height:42px;border-radius:50%;flex-shrink:0"></div>
        <div class="result-info" style="gap:6px">
            <div class="sk" style="width:55%;height:13px;border-radius:3px"></div>
            <div class="sk" style="width:35%;height:11px;border-radius:3px"></div>
        </div>
        <div class="sk" style="width:68px;height:13px;border-radius:3px;flex-shrink:0"></div>
        <div class="sk" style="width:58px;height:13px;border-radius:3px;flex-shrink:0"></div>
        <div class="sk" style="width:36px;height:13px;border-radius:3px;flex-shrink:0"></div>
    </div>`;

    return `
    <div class="card">
        <div class="card-header">
            <div class="sk" style="width:160px;height:14px;border-radius:3px"></div>
        </div>
        ${row().repeat(10)}
    </div>`;
}

function renderRaceError(msg) {
    return `
    <div class="error-state">
        <span class="error-title">Could not load race data</span>
        <span class="error-detail">${msg}</span>
    </div>`;
}

// ── Countdown timer ────────────────────────────────────────────
function startCountdown(meeting) {
    function tick() {
        const el = document.getElementById('race-countdown');
        if (!el) return;
        const diff = new Date(meeting.date_start) - new Date();
        if (diff <= 0) {
            el.textContent = 'Race Weekend!';
            const label = el.nextElementSibling;
            if (label) label.style.display = 'none';
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${d}d ${h}h ${m}m ${s}s`;
        setTimeout(tick, 1000);
    }
    tick();
}

// ── Race time formatter: 4989.775s → "1:23:09.775" ────────────
function formatRaceTime(seconds) {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = (seconds % 60).toFixed(3).padStart(6, '0');
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${s}` : `${m}:${s}`;
}

// ── Headshot URL resolution ────────────────────────────────────
function getHeadshotUrl(acro) {
    return _raceHeadshots[acro]?.headshot_url || DRIVER_IMAGES?.[acro] || '';
}

// ── Team color resolution ──────────────────────────────────────
function resolveTeamColorByName(name) {
    if (!name) return '#555';
    if (TEAM_COLORS[name]) return TEAM_COLORS[name];
    const key = Object.keys(TEAM_COLORS).find(k =>
        name.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(name.toLowerCase())
    );
    return key ? TEAM_COLORS[key] : '#555';
}

// ══════════════════════════════════════════════════════════════
//  RACE TABS
// ══════════════════════════════════════════════════════════════
function renderRaceTabsBar(activeTab, tabs) {
    const btns = tabs.map(t =>
        `<button class="tab race-tab-btn ${t.key === activeTab ? 'active' : ''}"
                 data-tab="${t.key}"
                 onclick="switchRaceTab('${t.key}')">${t.label}</button>`
    ).join('');
    return `<div class="race-tabs-bar"><div class="tabs">${btns}</div></div>`;
}

async function switchRaceTab(tab) {
    document.querySelectorAll('.race-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    const content = document.getElementById('race-tab-content');
    if (!content) return;

    if (tab === 'race') {
        if (!_cachedRaceResults.length) {
            content.innerHTML = renderRaceNotStarted(_raceMeeting ?? {});
            return;
        }
        content.innerHTML = renderPodium(_cachedRaceResults) + renderResultsTable(_cachedRaceResults);
    } else if (tab === 'qualifying') {
        await loadAndRenderQualifying(content);
    } else if (tab === 'pitstops') {
        await loadAndRenderPitStops(content);
    /* -- REPLAY DISABLED (uncomment to re-enable) --
    } else if (tab === 'replay') {
        await loadAndRenderReplay(content);
    -- END REPLAY DISABLED -- */
    } else if (tab === 'sprint') {
        await loadAndRenderSprint(content);
    } else if (tab === 'sprintshootout') {
        await loadAndRenderSprintShootout(content);
    } else if (tab === 'practice1') {
        await loadAndRenderPractice(content, 'Practice 1', 'practice1');
    } else if (tab === 'practice2') {
        await loadAndRenderPractice(content, 'Practice 2', 'practice2');
    } else if (tab === 'practice3') {
        await loadAndRenderPractice(content, 'Practice 3', 'practice3');
    } else if (tab === 'tyres') {
        await loadAndRenderTyres(content);
    } else if (tab === 'positions') {
        await loadAndRenderPositions(content);
    }
}

// ══════════════════════════════════════════════════════════════
//  QUALIFYING TAB
// ══════════════════════════════════════════════════════════════
async function loadAndRenderQualifying(content) {
    if (_cachedQualData) {
        content.innerHTML = renderQualifyingTable(_cachedQualData.grid, _cachedQualData.driverMap);
        return;
    }

    content.innerHTML = renderRaceSkeleton();

    try {
        const qualSession = await getQualifyingSession(_raceMeetingKey);
        if (!qualSession) {
            content.innerHTML = renderRaceError('No qualifying session found for this event.');
            return;
        }

        const [gridRes, driverRes] = await Promise.allSettled([
            getStartingGrid(qualSession.session_key),
            getDrivers(qualSession.session_key),
        ]);

        const grid    = Array.isArray(gridRes.value)   ? gridRes.value   : [];
        const drivers = Array.isArray(driverRes.value) ? driverRes.value : [];

        const driverMap = {};
        drivers.forEach(d => { if (d.driver_number != null) driverMap[d.driver_number] = d; });

        _cachedQualData = { grid, driverMap };
        content.innerHTML = renderQualifyingTable(grid, driverMap);
    } catch (e) {
        content.innerHTML = renderRaceError('Could not load qualifying data.');
    }
}

function renderQualifyingTable(grid, driverMap, title = 'Qualifying Results') {
    if (!grid.length) return renderRaceError('No qualifying data available for this event.');

    const sorted   = [...grid].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
    const poleTime = sorted[0]?.lap_duration;

    const rows = sorted.map(r => {
        const drv   = driverMap[r.driver_number] ?? _raceDriversByNum[r.driver_number] ?? {};
        const acro  = drv.name_acronym ?? String(r.driver_number ?? '?');
        const name  = drv.full_name ?? acro;
        const team  = drv.team_name ?? '—';
        const color = resolveTeamColorByName(team);
        const url   = getHeadshotUrl(acro);
        const pos   = r.position ?? '—';
        const time  = formatLapTime(r.lap_duration);
        const gap   = (pos !== 1 && r.lap_duration && poleTime)
            ? `+${(r.lap_duration - poleTime).toFixed(3)}s`
            : '';

        return `
        <div class="result-row">
            <span class="result-pos ${rankClass(pos)}">${pos}</span>
            <span class="result-team-bar" style="background:${color}"></span>
            <div class="result-photo" style="border-color:${color};background:${color}33">
                ${url
                    ? `<img src="${url}" alt="${acro}"
                            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ''}
                <span class="result-initials"
                      style="display:${url ? 'none' : 'flex'};background:transparent;color:${color}">
                    ${acro}
                </span>
            </div>
            <div class="result-info">
                <div class="result-name-row">
                    <span class="result-name">${name}</span>
                    <span class="result-code">${acro}</span>
                </div>
                <div class="result-team-row">${team}</div>
            </div>
            <div class="result-gap">${time}</div>
            <div class="result-pts qual-gap">${gap}</div>
        </div>`;
    }).join('');

    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">${title}</span>
        </div>
        <div class="result-table-head">
            <span class="rth-pos">POS</span>
            <span class="rth-driver">Driver</span>
            <span class="rth-gap">Best Lap</span>
            <span class="rth-pts">Gap</span>
        </div>
        ${rows}
    </div>`;
}

// ══════════════════════════════════════════════════════════════
//  PIT STOPS TAB
// ══════════════════════════════════════════════════════════════
async function loadAndRenderPitStops(content, sub = 'race') {
    const sprintSess = getSessionByName('Sprint');
    const hasSprint  = !!sprintSess;

    if (sub === 'race') {
        if (!_cachedPitData) {
            content.innerHTML = renderRaceSkeleton();
            try {
                _cachedPitData = await getPit(_raceSessionKey);
            } catch (e) {
                content.innerHTML = renderRaceError('Could not load pit stop data.');
                return;
            }
        }
        content.innerHTML = renderPitStopsTable(_cachedPitData, _cachedRaceResults, hasSprint, 'race');
    } else {
        if (!_cachedTabData.sprintPits) {
            content.innerHTML = renderRaceSkeleton();
            try {
                const sprintKey = sprintSess.session_key;
                const [pits, results] = await Promise.all([
                    getPit(sprintKey),
                    _cachedTabData.sprintResults
                        ? Promise.resolve(_cachedTabData.sprintResults)
                        : _cachedTabData.sprint
                            ? Promise.resolve(_cachedTabData.sprint.results)
                            : getSessionResult(sprintKey),
                ]);
                _cachedTabData.sprintPits = pits ?? [];
                if (!_cachedTabData.sprintResults) {
                    _cachedTabData.sprintResults = Array.isArray(results) ? results : [];
                }
            } catch (e) {
                content.innerHTML = renderRaceError('Could not load sprint pit stop data.');
                return;
            }
        }
        const sprintResults = _cachedTabData.sprintResults ?? _cachedTabData.sprint?.results ?? [];
        content.innerHTML = renderPitStopsTable(_cachedTabData.sprintPits, sprintResults, hasSprint, 'sprint');
    }
}

function switchPitSubTab(sub) {
    const content = document.getElementById('race-tab-content');
    if (content) loadAndRenderPitStops(content, sub);
}

function renderPitStopsTable(pits, resultOrder, hasSprint, activeSub) {
    const subTabsHTML = hasSprint ? `
        <div class="session-sub-tabs">
            <button class="session-sub-tab ${activeSub === 'race'   ? 'is-active' : ''}" onclick="switchPitSubTab('race')">Race</button>
            <button class="session-sub-tab ${activeSub === 'sprint' ? 'is-active' : ''}" onclick="switchPitSubTab('sprint')">Sprint</button>
        </div>` : '';

    if (!pits || !pits.length) return `
    <div class="card">
        <div class="card-header"><span class="card-title">Pit Stops</span>${subTabsHTML}</div>
        <p style="color:var(--muted);padding:24px;font-size:13px">No pit stop data available for this session.</p>
    </div>`;

    // Group stops by driver
    const byDriver = {};
    pits.forEach(p => {
        if (!byDriver[p.driver_number]) byDriver[p.driver_number] = [];
        byDriver[p.driver_number].push(p);
    });
    Object.values(byDriver).forEach(stops => stops.sort((a, b) => a.stop_number - b.stop_number));

    // Follow finish order; append any driver with pits but no result entry
    const driverOrder = [...resultOrder]
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
        .map(r => r.driver_number);
    Object.keys(byDriver).forEach(n => {
        if (!driverOrder.includes(+n)) driverOrder.push(+n);
    });

    const rows = driverOrder.map(driverNum => {
        const stops = byDriver[driverNum];
        if (!stops) return '';

        const drv   = _raceDriversByNum[driverNum] ?? {};
        const acro  = drv.name_acronym ?? String(driverNum);
        const name  = drv.full_name ?? acro;
        const team  = drv.team_name ?? '—';
        const color = resolveTeamColorByName(team);
        const url   = getHeadshotUrl(acro);
        const res   = resultOrder.find(r => r.driver_number === driverNum);
        const pos   = res?.position ?? '—';

        const pills = stops.map(s => {
            const dur = s.pit_duration != null ? s.pit_duration.toFixed(1) + 's' : '—';
            return `<span class="pit-stop-pill">Lap ${s.lap_number}<span class="pit-stop-dur">${dur}</span></span>`;
        }).join('');

        return `
        <div class="result-row">
            <span class="result-pos ${rankClass(pos)}">${pos}</span>
            <span class="result-team-bar" style="background:${color}"></span>
            <div class="result-photo" style="border-color:${color};background:${color}33">
                ${url
                    ? `<img src="${url}" alt="${acro}"
                            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ''}
                <span class="result-initials"
                      style="display:${url ? 'none' : 'flex'};background:transparent;color:${color}">
                    ${acro}
                </span>
            </div>
            <div class="result-info">
                <div class="result-name-row">
                    <span class="result-name">${name}</span>
                    <span class="result-code">${acro}</span>
                </div>
                <div class="pit-stops-list">${pills}</div>
            </div>
            <div class="pit-count">${stops.length}</div>
        </div>`;
    }).filter(Boolean).join('');

    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">Pit Stops</span>
            ${subTabsHTML}
        </div>
        <div class="result-table-head">
            <span class="rth-pos">POS</span>
            <span class="rth-driver">Driver</span>
            <span class="pit-count-h">Stops</span>
        </div>
        ${rows}
    </div>`;
}

// ══════════════════════════════════════════════════════════════
//  DYNAMIC TAB BUILDER
// ══════════════════════════════════════════════════════════════
function buildTabs(sessions) {
    const names = new Set(sessions.map(s => s.session_name));
    const tabs  = [];
    if (names.has('Race'))            tabs.push({ key: 'race',           label: 'Race'            });
    if (names.has('Sprint'))          tabs.push({ key: 'sprint',         label: 'Sprint'          });
    if (names.has('Qualifying'))      tabs.push({ key: 'qualifying',     label: 'Qualifying'      });
    if (names.has('Sprint Shootout') || names.has('Sprint Qualifying')) tabs.push({ key: 'sprintshootout', label: names.has('Sprint Shootout') ? 'Sprint Shootout' : 'Sprint Qualifying' });
    if (names.has('Practice 3'))      tabs.push({ key: 'practice3',      label: 'FP3'             });
    if (names.has('Practice 2'))      tabs.push({ key: 'practice2',      label: 'FP2'             });
    if (names.has('Practice 1'))      tabs.push({ key: 'practice1',      label: 'FP1'             });
    tabs.push({ key: 'pitstops',  label: 'Pit Stops' });
    tabs.push({ key: 'tyres',     label: 'Tyres'     });
    tabs.push({ key: 'positions', label: 'Positions' });
    /* -- REPLAY DISABLED (uncomment to re-enable) --
    tabs.push({ key: 'replay',   label: 'Replay'    });
    -- END REPLAY DISABLED -- */
    return tabs;
}

function getSessionByName(name) {
    return _meetingSessions.find(s => s.session_name === name) ?? null;
}

// ══════════════════════════════════════════════════════════════
//  SPRINT TAB
// ══════════════════════════════════════════════════════════════
async function loadAndRenderSprint(content) {
    if (_cachedTabData.sprint) {
        const d = _cachedTabData.sprint;
        content.innerHTML = renderSprintTable(d.results, d.driverMap);
        return;
    }
    content.innerHTML = renderRaceSkeleton();
    try {
        const sess = getSessionByName('Sprint');
        if (!sess) { content.innerHTML = renderRaceError('No sprint session found for this event.'); return; }
        const [resultRes, driverRes] = await Promise.allSettled([
            getSessionResult(sess.session_key),
            getDrivers(sess.session_key),
        ]);
        const results = Array.isArray(resultRes.value) ? resultRes.value : [];
        const drivers = Array.isArray(driverRes.value) ? driverRes.value : [];
        const driverMap = {};
        drivers.forEach(d => { if (d.driver_number != null) driverMap[d.driver_number] = d; });
        const sorted = [...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
        _cachedTabData.sprint = { results: sorted, driverMap };
        content.innerHTML = renderSprintTable(sorted, driverMap);
    } catch (e) {
        content.innerHTML = renderRaceError('Could not load sprint data.');
    }
}

function renderSprintTable(results, driverMap) {
    if (!results.length) return renderRaceError('No sprint data available for this event.');
    const SPRINT_PTS = [8, 7, 6, 5, 4, 3, 2, 1];

    const rows = results.map((r, i) => {
        const drv   = driverMap[r.driver_number] ?? _raceDriversByNum[r.driver_number] ?? {};
        const acro  = drv.name_acronym ?? String(r.driver_number ?? '?');
        const name  = drv.full_name ?? acro;
        const team  = drv.team_name ?? '—';
        const color = resolveTeamColorByName(team);
        const url   = getHeadshotUrl(acro);
        const pos   = r.position ?? i + 1;
        const gapStr = pos === 1 ? 'WINNER' : formatGap(r.gap_to_leader);
        const pts   = SPRINT_PTS[i] ?? 0;
        const statusBadge = renderStatusBadge(r);

        return `
        <div class="result-row">
            <span class="result-pos ${rankClass(pos)}">${pos}</span>
            <span class="result-team-bar" style="background:${color}"></span>
            <div class="result-photo" style="border-color:${color};background:${color}33">
                ${url
                    ? `<img src="${url}" alt="${acro}"
                            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ''}
                <span class="result-initials"
                      style="display:${url ? 'none' : 'flex'};background:transparent;color:${color}">
                    ${acro}
                </span>
            </div>
            <div class="result-info">
                <div class="result-name-row">
                    <span class="result-name">${name}</span>
                    <span class="result-code">${acro}</span>
                    ${statusBadge}
                </div>
                <div class="result-team-row">${team}</div>
            </div>
            <div class="result-gap">${gapStr}</div>
            <div class="result-pts">${pts > 0 ? pts + ' pts' : ''}</div>
        </div>`;
    }).join('');

    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">Sprint Results</span>
        </div>
        <div class="result-table-head">
            <span class="rth-pos">POS</span>
            <span class="rth-driver">Driver</span>
            <span class="rth-gap">Gap</span>
            <span class="rth-pts">Pts</span>
        </div>
        ${rows}
    </div>`;
}

// ══════════════════════════════════════════════════════════════
//  SPRINT SHOOTOUT TAB
// ══════════════════════════════════════════════════════════════
async function loadAndRenderSprintShootout(content) {
    if (_cachedTabData.sprintshootout) {
        const d = _cachedTabData.sprintshootout;
        content.innerHTML = renderQualifyingTable(d.grid, d.driverMap, d.title);
        return;
    }
    content.innerHTML = renderRaceSkeleton();
    try {
        const sess = getSessionByName('Sprint Shootout') ?? getSessionByName('Sprint Qualifying');
        if (!sess) { content.innerHTML = renderRaceError('No sprint shootout session found for this event.'); return; }
        const [gridRes, driverRes] = await Promise.allSettled([
            getStartingGrid(sess.session_key),
            getDrivers(sess.session_key),
        ]);
        const grid    = Array.isArray(gridRes.value)   ? gridRes.value   : [];
        const drivers = Array.isArray(driverRes.value) ? driverRes.value : [];
        const driverMap = {};
        drivers.forEach(d => { if (d.driver_number != null) driverMap[d.driver_number] = d; });
        const title = sess.session_name === 'Sprint Qualifying' ? 'Sprint Qualifying Results' : 'Sprint Shootout Results';
        _cachedTabData.sprintshootout = { grid, driverMap, title };
        content.innerHTML = renderQualifyingTable(grid, driverMap, title);
    } catch (e) {
        content.innerHTML = renderRaceError('Could not load sprint shootout data.');
    }
}

// ══════════════════════════════════════════════════════════════
//  PRACTICE TABS (FP1 / FP2 / FP3)
// ══════════════════════════════════════════════════════════════
async function loadAndRenderPractice(content, sessionName, cacheKey) {
    if (_cachedTabData[cacheKey]) {
        const d = _cachedTabData[cacheKey];
        content.innerHTML = renderPracticeTable(d.results, d.driverMap, d.bestLaps, sessionName);
        return;
    }
    content.innerHTML = renderRaceSkeleton();
    try {
        const sess = getSessionByName(sessionName);
        if (!sess) { content.innerHTML = renderRaceError(`No ${sessionName} session found for this event.`); return; }
        const [resultRes, driverRes, lapsRes] = await Promise.allSettled([
            getSessionResult(sess.session_key),
            getDrivers(sess.session_key),
            getLaps(sess.session_key),
        ]);
        const results = Array.isArray(resultRes.value) ? resultRes.value : [];
        const drivers = Array.isArray(driverRes.value) ? driverRes.value : [];
        const laps    = Array.isArray(lapsRes.value)   ? lapsRes.value   : [];

        const driverMap = {};
        drivers.forEach(d => { if (d.driver_number != null) driverMap[d.driver_number] = d; });

        const bestLaps = {};
        laps.forEach(lap => {
            if (lap.lap_duration != null && lap.lap_duration > 0) {
                if (!bestLaps[lap.driver_number] || lap.lap_duration < bestLaps[lap.driver_number]) {
                    bestLaps[lap.driver_number] = lap.lap_duration;
                }
            }
        });

        const sorted = [...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
        _cachedTabData[cacheKey] = { results: sorted, driverMap, bestLaps };
        content.innerHTML = renderPracticeTable(sorted, driverMap, bestLaps, sessionName);
    } catch (e) {
        content.innerHTML = renderRaceError(`Could not load ${sessionName} data.`);
    }
}

function renderPracticeTable(results, driverMap, bestLaps, sessionName) {
    if (!results.length) return renderRaceError(`No ${sessionName} data available for this event.`);

    // Sort by best lap time ascending; drivers with no time go to the bottom
    const sorted = [...results].sort((a, b) => {
        const ta = bestLaps[a.driver_number] ?? Infinity;
        const tb = bestLaps[b.driver_number] ?? Infinity;
        return ta - tb;
    });

    const fastestTime = bestLaps[sorted[0]?.driver_number] ?? null;

    const rows = sorted.map((r, i) => {
        const drv   = driverMap[r.driver_number] ?? _raceDriversByNum[r.driver_number] ?? {};
        const acro  = drv.name_acronym ?? String(r.driver_number ?? '?');
        const name  = drv.full_name ?? acro;
        const team  = drv.team_name ?? '—';
        const color = resolveTeamColorByName(team);
        const url   = getHeadshotUrl(acro);
        const best  = bestLaps[r.driver_number];
        const pos   = best != null ? i + 1 : '—';
        const timeStr = best ? formatLapTime(best) : '—';
        const gap   = (i > 0 && best && fastestTime)
            ? `+${(best - fastestTime).toFixed(3)}s`
            : '';

        return `
        <div class="result-row">
            <span class="result-pos ${rankClass(pos)}">${pos}</span>
            <span class="result-team-bar" style="background:${color}"></span>
            <div class="result-photo" style="border-color:${color};background:${color}33">
                ${url
                    ? `<img src="${url}" alt="${acro}"
                            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ''}
                <span class="result-initials"
                      style="display:${url ? 'none' : 'flex'};background:transparent;color:${color}">
                    ${acro}
                </span>
            </div>
            <div class="result-info">
                <div class="result-name-row">
                    <span class="result-name">${name}</span>
                    <span class="result-code">${acro}</span>
                </div>
                <div class="result-team-row">${team}</div>
            </div>
            <div class="result-gap">${timeStr}</div>
            <div class="result-pts qual-gap">${gap}</div>
        </div>`;
    }).join('');

    const titleMap = {
        'Practice 1': 'Practice 1 Results',
        'Practice 2': 'Practice 2 Results',
        'Practice 3': 'Practice 3 Results',
    };

    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">${titleMap[sessionName] ?? sessionName + ' Results'}</span>
        </div>
        <div class="result-table-head">
            <span class="rth-pos">POS</span>
            <span class="rth-driver">Driver</span>
            <span class="rth-gap">Best Lap</span>
            <span class="rth-pts">Gap</span>
        </div>
        ${rows}
    </div>`;
}

// ══════════════════════════════════════════════════════════════
//  TYRES TAB
// ══════════════════════════════════════════════════════════════
async function loadAndRenderTyres(content, sub = 'race') {
    const sprintSess = getSessionByName('Sprint');
    const hasSprint  = !!sprintSess;

    if (sub === 'race') {
        if (!_cachedTabData.tyres) {
            content.innerHTML = renderRaceSkeleton();
            try {
                const stints = await getStints(_raceSessionKey);
                _cachedTabData.tyres = stints ?? [];
            } catch (e) {
                content.innerHTML = renderRaceError('Could not load tyre stint data.');
                return;
            }
        }
        content.innerHTML = renderTyreStrategy(_cachedTabData.tyres, _cachedRaceResults, hasSprint, 'race');
    } else {
        if (!_cachedTabData.sprintStints) {
            content.innerHTML = renderRaceSkeleton();
            try {
                const sprintKey = sprintSess.session_key;
                const [stints, results] = await Promise.all([
                    getStints(sprintKey),
                    _cachedTabData.sprintResults
                        ? Promise.resolve(_cachedTabData.sprintResults)
                        : _cachedTabData.sprint
                            ? Promise.resolve(_cachedTabData.sprint.results)
                            : getSessionResult(sprintKey),
                ]);
                _cachedTabData.sprintStints = stints ?? [];
                if (!_cachedTabData.sprintResults) {
                    _cachedTabData.sprintResults = Array.isArray(results) ? results : [];
                }
            } catch (e) {
                content.innerHTML = renderRaceError('Could not load sprint tyre data.');
                return;
            }
        }
        const sprintResults = _cachedTabData.sprintResults ?? _cachedTabData.sprint?.results ?? [];
        content.innerHTML = renderTyreStrategy(_cachedTabData.sprintStints, sprintResults, hasSprint, 'sprint');
    }
}

function switchTyreSubTab(sub) {
    const content = document.getElementById('race-tab-content');
    if (content) loadAndRenderTyres(content, sub);
}

function renderTyreStrategy(stints, resultOrder, hasSprint, activeSub) {
    const subTabsHTML = hasSprint ? `
        <div class="session-sub-tabs">
            <button class="session-sub-tab ${activeSub === 'race'   ? 'is-active' : ''}" onclick="switchTyreSubTab('race')">Race</button>
            <button class="session-sub-tab ${activeSub === 'sprint' ? 'is-active' : ''}" onclick="switchTyreSubTab('sprint')">Sprint</button>
        </div>` : '';

    if (!stints || !stints.length) return `
    <div class="card">
        <div class="card-header"><span class="card-title">Tyre Strategy</span>${subTabsHTML}</div>
        <p style="color:var(--muted);padding:24px;font-size:13px">No tyre stint data available for this session.</p>
    </div>`;

    const byDriver = {};
    stints.forEach(s => {
        if (!byDriver[s.driver_number]) byDriver[s.driver_number] = [];
        byDriver[s.driver_number].push(s);
    });

    const totalLaps = resultOrder[0]?.number_of_laps
        ?? Math.max(...stints.map(s => s.lap_end ?? 0).filter(n => n > 0));

    const driverOrder = [...resultOrder]
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
        .map(r => r.driver_number);
    Object.keys(byDriver).forEach(n => {
        if (!driverOrder.includes(+n)) driverOrder.push(+n);
    });

    const compounds = [...new Set(stints.map(s => (s.compound || '').toUpperCase()).filter(Boolean))];
    const compoundOrder = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];
    compounds.sort((a, b) => {
        const ia = compoundOrder.indexOf(a), ib = compoundOrder.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const legendHTML = compounds.map(c => {
        const col = TYRE_COLORS[c] || '#888';
        return `<span class="ts-legend-item"><span class="ts-legend-dot" style="background:${col}"></span>${c}</span>`;
    }).join('');

    const rows = driverOrder.map(driverNum => {
        const driverStints = byDriver[driverNum];
        if (!driverStints) return '';

        const drv   = _raceDriversByNum[driverNum] ?? {};
        const acro  = drv.name_acronym ?? String(driverNum);
        const team  = drv.team_name ?? '';
        const col   = resolveTeamColorByName(team);
        const url   = getHeadshotUrl(acro);
        const res   = resultOrder.find(r => r.driver_number === driverNum);
        const pos   = res?.position ?? '—';

        const sorted = [...driverStints].sort((a, b) => (a.lap_start ?? 0) - (b.lap_start ?? 0));

        const segments = sorted.map(stint => {
            const lapStart = stint.lap_start ?? 1;
            const lapEnd   = stint.lap_end   ?? totalLaps;
            const compound = (stint.compound || 'UNKNOWN').toUpperCase();
            const stintCol = TYRE_COLORS[compound] || '#888';
            const laps     = Math.max(1, lapEnd - lapStart + 1);
            const pct      = (laps / totalLaps * 100).toFixed(2);
            const ageNote  = stint.tyre_age_at_start != null ? `, age ${stint.tyre_age_at_start}` : '';
            const tip = `L${lapStart}–${lapEnd} · ${compound}${ageNote} (${laps} laps)`;
            return `<div class="ts-stint" style="width:${pct}%;background:${stintCol}"
                         title="${tip}" ontouchstart="showStintTip(event,'${tip}')"></div>`;
        }).join('');

        return `
        <div class="ts-row">
            <span class="ts-pos ${rankClass(pos)}">${pos}</span>
            <span class="ts-team-bar" style="background:${col}"></span>
            <div class="ts-driver-photo" style="border-color:${col};background:${col}33">
                ${url
                    ? `<img src="${url}" alt="${acro}"
                            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ''}
                <span class="ts-driver-initials"
                      style="display:${url ? 'none' : 'flex'};color:${col}">${acro}</span>
            </div>
            <div class="ts-bar">${segments}</div>
        </div>`;
    }).filter(Boolean).join('');

    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">Tyre Strategy</span>
            <div class="ts-legend-and-tabs">
                <div class="ts-legend">${legendHTML}</div>
                ${subTabsHTML}
            </div>
        </div>
        <div class="ts-header-row">
            <span class="ts-pos"></span>
            <span class="ts-team-bar" style="background:transparent"></span>
            <span class="ts-driver-code"></span>
            <div class="ts-lap-labels" id="ts-lap-labels" data-total="${totalLaps}"></div>
        </div>
        ${rows}
    </div>`;
}


// ══════════════════════════════════════════════════════════════
//  POSITIONS TAB — lap-by-lap position chart
// ══════════════════════════════════════════════════════════════
async function loadAndRenderPositions(content) {
    if (_cachedTabData.positions) {
        content.innerHTML = renderPositionChart(_cachedTabData.positions, _cachedTabData.positionPits ?? []);
        initPositionChart(_cachedTabData.positions);
        return;
    }
    content.innerHTML = renderRaceSkeleton();
    try {
        const [laps, pits] = await Promise.all([
            getLaps(_raceSessionKey),
            _cachedPitData ? Promise.resolve(_cachedPitData) : getPit(_raceSessionKey).catch(() => []),
        ]);
        _cachedTabData.positions    = laps ?? [];
        _cachedTabData.positionPits = pits ?? [];
        if (!_cachedPitData) _cachedPitData = _cachedTabData.positionPits;
        content.innerHTML = renderPositionChart(_cachedTabData.positions, _cachedTabData.positionPits);
        initPositionChart(_cachedTabData.positions);
    } catch (e) {
        content.innerHTML = renderRaceError('Could not load lap position data.');
    }
}

function renderPositionChart(laps, pits = []) {
    const valid = laps.filter(l => l.position != null && l.lap_number != null);
    if (!valid.length) return renderRaceError('No position data available for this session.');

    // Group by driver, sort laps
    const byDriver = {};
    valid.forEach(l => {
        if (!byDriver[l.driver_number]) byDriver[l.driver_number] = [];
        byDriver[l.driver_number].push(l);
    });
    Object.values(byDriver).forEach(arr => arr.sort((a, b) => a.lap_number - b.lap_number));

    const maxLap = Math.max(...valid.map(l => l.lap_number));
    const MAX_POS = 20;

    // SVG coordinate system
    const VW = 900, VH = 380;
    const PL = 32, PR = 96, PT = 14, PB = 30;
    const CW = VW - PL - PR;
    const CH = VH - PT - PB;

    const xS = lap => PL + (lap - 1) / Math.max(maxLap - 1, 1) * CW;
    const yS = pos => PT + (pos - 1) / (MAX_POS - 1) * CH;

    // Horizontal grid lines at key positions
    const grid = [1, 5, 10, 15, 20].map(p =>
        `<line x1="${PL}" y1="${yS(p).toFixed(1)}" x2="${PL + CW}" y2="${yS(p).toFixed(1)}" stroke="#1e1e1e" stroke-width="1"/>`
    ).join('');

    // Y axis labels
    const yLabels = [1, 5, 10, 15, 20].map(p =>
        `<text x="${PL - 6}" y="${(yS(p) + 4).toFixed(1)}" fill="#555" font-size="10" text-anchor="end" font-family="Inter,system-ui,sans-serif">P${p}</text>`
    ).join('');

    // X axis labels every 5 laps
    const xLabels = [];
    for (let lap = 5; lap <= maxLap; lap += 5) {
        xLabels.push(`<text x="${xS(lap).toFixed(1)}" y="${PT + CH + 20}" fill="#555" font-size="10" text-anchor="middle" font-family="Inter,system-ui,sans-serif">${lap}</text>`);
    }

    // Driver lines + right-side labels
    const driverLines = Object.entries(byDriver).map(([dNum, dLaps]) => {
        const drv   = _raceDriversByNum[+dNum] ?? {};
        const color = resolveTeamColorByName(drv.team_name ?? '');
        const acro  = drv.name_acronym ?? String(dNum);
        const pts   = dLaps.map(l => `${xS(l.lap_number).toFixed(1)},${yS(l.position).toFixed(1)}`).join(' ');
        const last  = dLaps[dLaps.length - 1];
        const lx    = xS(last.lap_number).toFixed(1);
        const ly    = yS(last.position).toFixed(1);
        return `<g class="pc-driver" data-driver="${dNum}">
            <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" opacity="0.88"/>
            <circle cx="${xS(dLaps[0].lap_number).toFixed(1)}" cy="${yS(dLaps[0].position).toFixed(1)}" r="2.5" fill="${color}" opacity="0.7"/>
            <text class="pc-label" x="${+lx + 8}" y="${+ly + 4}" fill="${color}" font-size="9.5" font-weight="700" font-family="Inter,system-ui,sans-serif">${acro}</text>
        </g>`;
    }).join('');

    // Pit stop markers — drawn on top of all lines
    const lapPosLookup = {};
    Object.entries(byDriver).forEach(([dNum, dLaps]) => {
        lapPosLookup[dNum] = {};
        dLaps.forEach(l => { lapPosLookup[dNum][l.lap_number] = l.position; });
    });

    const pitMarkers = pits.map(p => {
        const pos = lapPosLookup[p.driver_number]?.[p.lap_number];
        if (pos == null) return '';
        const drv   = _raceDriversByNum[p.driver_number] ?? {};
        const color = resolveTeamColorByName(drv.team_name ?? '');
        const cx    = xS(p.lap_number).toFixed(1);
        const cy    = yS(pos).toFixed(1);
        return `<circle cx="${cx}" cy="${cy}" r="4" fill="#0a0a0a" stroke="${color}" stroke-width="2" title="Pit stop — Lap ${p.lap_number}"/>`;
    }).join('');

    // Hover group: vertical line + one dot per possible driver (updated by JS)
    const driverDots = Object.keys(byDriver).map(dNum => {
        const color = resolveTeamColorByName((_raceDriversByNum[+dNum] ?? {}).team_name ?? '');
        return `<circle id="pc-dot-${dNum}" r="3.5" fill="${color}" stroke="#0a0a0a" stroke-width="1.2" style="display:none"/>`;
    }).join('');

    const hoverG = `<g id="pc-hover" style="display:none" pointer-events="none">
        <line id="pc-vline" x1="0" y1="${PT}" x2="0" y2="${PT + CH}" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="4,3"/>
        ${driverDots}
    </g>`;

    // Transparent overlay to capture mouse
    const overlay = `<rect id="pc-overlay" x="${PL}" y="${PT}" width="${CW}" height="${CH}" fill="transparent" style="cursor:crosshair"/>`;

    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">Positions</span>
            <div class="pc-header-right">
                <span class="pc-pit-legend">
                    <svg width="12" height="12" viewBox="0 0 12 12" style="flex-shrink:0">
                        <circle cx="6" cy="6" r="5" fill="#0a0a0a" stroke="#aaa" stroke-width="2"/>
                    </svg>
                    Pit stop
                </span>
                <span class="pc-hint" id="pc-hint-text">Hover to see lap standings</span>
            </div>
        </div>
        <div class="pc-wrap">
            <svg id="pc-svg" viewBox="0 0 ${VW} ${VH}" style="width:100%;height:auto;display:block"
                 data-pl="${PL}" data-cw="${CW}" data-pt="${PT}" data-ch="${CH}" data-max="${maxLap}">
                ${grid}${yLabels}${xLabels.join('')}${driverLines}${pitMarkers}${hoverG}${overlay}
            </svg>
        </div>
        <div id="pc-table" class="pc-table" style="display:none"></div>
    </div>`;
}

function initPositionChart(laps) {
    const svg = document.getElementById('pc-svg');
    const overlay = document.getElementById('pc-overlay');
    const hoverG  = document.getElementById('pc-hover');
    const vline   = document.getElementById('pc-vline');
    const table   = document.getElementById('pc-table');
    if (!svg || !overlay) return;

    const PL     = +svg.dataset.pl;
    const CW     = +svg.dataset.cw;
    const PT     = +svg.dataset.pt;
    const CH     = +svg.dataset.ch;
    const maxLap = +svg.dataset.max;
    const VW     = 900;

    const yS = pos => PT + (pos - 1) / 19 * CH;
    const xS = lap => PL + (lap - 1) / Math.max(maxLap - 1, 1) * CW;

    // Build lap index: lapNum → [{driverNum, position, cumTime}] sorted by position
    const lapIndex = {};
    laps.forEach(l => {
        if (l.position == null || l.lap_number == null) return;
        if (!lapIndex[l.lap_number]) lapIndex[l.lap_number] = [];
        lapIndex[l.lap_number].push({ driverNum: l.driver_number, position: l.position, cumTime: l.cumulative_time });
    });
    Object.values(lapIndex).forEach(arr => arr.sort((a, b) => a.position - b.position));

    // De-overlap right-side driver labels after render
    requestAnimationFrame(() => {
        const labels = [...svg.querySelectorAll('.pc-label')];
        labels.sort((a, b) => parseFloat(a.getAttribute('y')) - parseFloat(b.getAttribute('y')));
        for (let i = 1; i < labels.length; i++) {
            const prevY = parseFloat(labels[i - 1].getAttribute('y'));
            const currY = parseFloat(labels[i].getAttribute('y'));
            if (currY - prevY < 11) labels[i].setAttribute('y', String((prevY + 11).toFixed(1)));
        }
    });

    let lastLap = null;

    function showLap(lap) {
        if (lap === lastLap) return;
        lastLap = lap;

        const x = xS(lap);
        hoverG.style.display = '';
        vline.setAttribute('x1', x.toFixed(1));
        vline.setAttribute('x2', x.toFixed(1));

        // Position dots
        const entries = lapIndex[lap] ?? [];

        // Hide all dots first, then show the ones with data
        svg.querySelectorAll('[id^="pc-dot-"]').forEach(el => el.style.display = 'none');
        entries.forEach(e => {
            const dot = document.getElementById(`pc-dot-${e.driverNum}`);
            if (dot) {
                dot.setAttribute('cx', x.toFixed(1));
                dot.setAttribute('cy', yS(e.position).toFixed(1));
                dot.style.display = '';
            }
        });

        // Render lap table
        if (!entries.length) { table.style.display = 'none'; return; }

        const leaderTime = entries.find(e => e.position === 1)?.cumTime ?? null;

        const rows = entries.map(e => {
            const drv   = _raceDriversByNum[e.driverNum] ?? {};
            const acro  = drv.name_acronym ?? String(e.driverNum);
            const name  = drv.full_name ?? acro;
            const color = resolveTeamColorByName(drv.team_name ?? '');
            const url   = getHeadshotUrl(acro);

            let gapHTML = '';
            if (e.position === 1) {
                gapHTML = `<span class="pc-gap-leader">LEADER</span>`;
            } else if (leaderTime != null && e.cumTime != null && e.cumTime > leaderTime) {
                gapHTML = `+${(e.cumTime - leaderTime).toFixed(3)}s`;
            }

            return `
            <div class="pc-row">
                <span class="pc-pos ${rankClass(e.position)}">${e.position}</span>
                <span class="pc-bar" style="background:${color}"></span>
                <div class="pc-photo" style="border-color:${color};background:${color}33">
                    ${url ? `<img src="${url}" alt="${acro}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                    <span class="pc-initials" style="display:${url ? 'none' : 'flex'};color:${color}">${acro}</span>
                </div>
                <div class="pc-info">
                    <span class="pc-name">${name}</span>
                    <span class="pc-code">${acro}</span>
                </div>
                <span class="pc-gap">${gapHTML}</span>
            </div>`;
        }).join('');

        table.style.display = '';
        table.innerHTML = `
            <div class="pc-table-head">
                <span>LAP ${lap} / ${maxLap}</span>
            </div>
            ${rows}`;
    }

    function lapFromClientX(clientX) {
        const rect = svg.getBoundingClientRect();
        const mx   = (clientX - rect.left) / rect.width * VW;
        return Math.max(1, Math.min(maxLap, Math.round(1 + (mx - PL) / CW * (maxLap - 1))));
    }

    overlay.addEventListener('mousemove', e => showLap(lapFromClientX(e.clientX)));
    overlay.addEventListener('mouseleave', () => {
        hoverG.style.display = 'none';
        svg.querySelectorAll('[id^="pc-dot-"]').forEach(el => el.style.display = 'none');
    });

    overlay.addEventListener('touchmove', e => {
        e.preventDefault();
        showLap(lapFromClientX(e.touches[0].clientX));
    }, { passive: false });

    overlay.addEventListener('touchend', () => {
        hoverG.style.display = 'none';
        svg.querySelectorAll('[id^="pc-dot-"]').forEach(el => el.style.display = 'none');
    });
}

/* -- REPLAY DISABLED (uncomment to re-enable) --
// ══════════════════════════════════════════════════════════════
//  REPLAY TAB — launches the desktop f1-race-replay app
// ══════════════════════════════════════════════════════════════
async function loadAndRenderReplay(content) {
    const parts = String(_raceMeetingKey ?? '').split('_');
    const year  = parts[0] ? parseInt(parts[0]) : CONFIG.YEAR;
    const round = parts[1] ? parseInt(parts[1]) : null;

    content.innerHTML = `
    <div class="card" style="text-align:center;padding:48px 24px">
        <div class="card-header" style="justify-content:center;margin-bottom:8px">
            <span class="card-title">Race Replay</span>
        </div>
        <p style="color:var(--muted);margin:12px 0 28px;font-size:0.9rem">
            Powered by the <strong>f1-race-replay</strong> desktop app —
            full telemetry, tyre models &amp; safety car simulation.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <button class="tab active" id="replay-btn-race"
                    style="padding:10px 24px;font-size:0.95rem;cursor:pointer"
                    onclick="triggerLaunchReplay(${year}, ${round}, 'Race')">
                🎬 Launch Race Replay
            </button>
            <button class="tab" id="replay-btn-quali"
                    style="padding:10px 24px;font-size:0.95rem;cursor:pointer"
                    onclick="triggerLaunchReplay(${year}, ${round}, 'Qualifying')">
                🎬 Launch Qualifying Replay
            </button>
        </div>
        <p id="replay-status" style="color:var(--muted);margin-top:20px;font-size:0.8rem;min-height:1.2em;font-family:monospace"></p>
    </div>`;
}

async function triggerLaunchReplay(year, round, sessionType) {
    const status = document.getElementById('replay-status');
    const btnR   = document.getElementById('replay-btn-race');
    const btnQ   = document.getElementById('replay-btn-quali');
    if (btnR) btnR.disabled = true;
    if (btnQ) btnQ.disabled = true;
    if (status) status.textContent = 'Connecting…';

    try {
        const res = await fetch(`${CONFIG.API_BASE}/api/launch_replay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, round, session: sessionType }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (status) status.textContent = `Error: ${err.error ?? res.status}`;
            return;
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buf     = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const ev = JSON.parse(line.slice(6));
                    if (ev.error)  { if (status) status.textContent = `Error: ${ev.error}`; }
                    else if (ev.done) { if (status) status.textContent = '✓ Replay launched — window should appear shortly'; }
                    else if (ev.msg)  { if (status) status.textContent = ev.msg; }
                } catch {}
            }
        }
    } catch (e) {
        if (status) status.textContent = 'Could not reach backend. Is the Flask server running?';
    } finally {
        if (btnR) btnR.disabled = false;
        if (btnQ) btnQ.disabled = false;
    }
}
-- END REPLAY DISABLED -- */

// ══════════════════════════════════════════════════════════════
//  HOME SESSION LOADER (live weekend — no tabs)
// ══════════════════════════════════════════════════════════════
function renderSessionBanner(meeting, sessionName) {
    const flag = getFlag(meeting.country_name);
    const SESSION_LABEL = {
        'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3',
        'Qualifying': 'Qualifying', 'Sprint': 'Sprint',
        'Sprint Shootout': 'Sprint Shootout', 'Sprint Qualifying': 'Sprint Qualifying',
        'Race': 'Race',
    };
    const label = SESSION_LABEL[sessionName] ?? sessionName;
    return `
    <div class="session-banner">
        <span class="session-banner-flag">${flag}</span>
        <div class="session-banner-info">
            <span class="session-banner-gp">${meeting.country_name} Grand Prix</span>
            <span class="session-banner-session">${label}</span>
        </div>
        <span class="session-banner-pill">Current Weekend</span>
    </div>`;
}

async function loadSessionForHome(meeting, session, targetId) {
    const section = document.getElementById(targetId);
    if (!section) return false;

    const name = session.session_name;

    if (name === 'Race') {
        await loadRace(meeting, targetId);
        return _cachedRaceResults.length > 0;
    }

    section.innerHTML = renderRaceSkeleton();

    try {
        if (name === 'Qualifying' || name === 'Sprint Shootout' || name === 'Sprint Qualifying') {
            const [gridRes, driverRes] = await Promise.allSettled([
                getStartingGrid(session.session_key),
                getDrivers(session.session_key),
            ]);
            const grid    = Array.isArray(gridRes.value)   ? gridRes.value   : [];
            const drivers = Array.isArray(driverRes.value) ? driverRes.value : [];
            if (!grid.length) return false;
            const driverMap = {};
            drivers.forEach(d => { if (d.driver_number != null) driverMap[d.driver_number] = d; });
            section.innerHTML = renderSessionBanner(meeting, name) +
                renderQualifyingTable(grid, driverMap, `${name} Results`);
            return true;
        }

        if (name === 'Sprint') {
            const [resultRes, driverRes] = await Promise.allSettled([
                getSessionResult(session.session_key),
                getDrivers(session.session_key),
            ]);
            const results = Array.isArray(resultRes.value) ? resultRes.value : [];
            if (!results.length) return false;
            const drivers = Array.isArray(driverRes.value) ? driverRes.value : [];
            const driverMap = {};
            drivers.forEach(d => { if (d.driver_number != null) driverMap[d.driver_number] = d; });
            const sorted = [...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
            section.innerHTML = renderSessionBanner(meeting, name) + renderSprintTable(sorted, driverMap);
            return true;
        }

        if (name.startsWith('Practice')) {
            const [resultRes, driverRes, lapsRes] = await Promise.allSettled([
                getSessionResult(session.session_key),
                getDrivers(session.session_key),
                getLaps(session.session_key),
            ]);
            const results = Array.isArray(resultRes.value) ? resultRes.value : [];
            if (!results.length) return false;
            const drivers = Array.isArray(driverRes.value) ? driverRes.value : [];
            const laps    = Array.isArray(lapsRes.value)   ? lapsRes.value   : [];
            const driverMap = {};
            drivers.forEach(d => { if (d.driver_number != null) driverMap[d.driver_number] = d; });
            const bestLaps = {};
            laps.forEach(lap => {
                if (lap.lap_duration != null && lap.lap_duration > 0) {
                    if (!bestLaps[lap.driver_number] || lap.lap_duration < bestLaps[lap.driver_number])
                        bestLaps[lap.driver_number] = lap.lap_duration;
                }
            });
            const sorted = [...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
            section.innerHTML = renderSessionBanner(meeting, name) +
                renderPracticeTable(sorted, driverMap, bestLaps, name);
            return true;
        }
    } catch (e) {}

    return false;
}
