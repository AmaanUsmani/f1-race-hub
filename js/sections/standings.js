// ── Module state ───────────────────────────────────────────────
let _drivers      = [];
let _constructors = [];
let _headshots    = {};   // { "NOR": { headshot_url, team_colour }, ... }
let _activeTab    = 'drivers';

// ── Public: fetch everything + render into #standings-section ──
async function loadStandings() {
    const section = document.getElementById('standings-section');
    if (!section) return;

    section.innerHTML = renderStandingsSkeleton();

    const [drResult, ctResult, photoResult] = await Promise.allSettled([
        getDriverStandings(CONFIG.YEAR),
        getConstructorStandings(CONFIG.YEAR),
        getDriverHeadshots(),
    ]);

    if (drResult.status    === 'fulfilled') _drivers      = drResult.value;
    if (ctResult.status    === 'fulfilled') _constructors = ctResult.value;
    if (photoResult.status === 'fulfilled') _headshots    = photoResult.value;

    section.innerHTML = renderStandingsCard();
}

// ── Tab switch (called from onclick in rendered HTML) ──────────
function switchStandingsTab(tab) {
    _activeTab = tab;
    const section = document.getElementById('standings-section');
    if (section) section.innerHTML = renderStandingsCard();
}

// ── Skeleton ───────────────────────────────────────────────────
function renderStandingsSkeleton() {
    const row = () => `
        <div class="standings-row">
            <div class="sk" style="width:22px;height:22px;border-radius:4px;flex-shrink:0"></div>
            <div class="sk" style="width:3px;height:50px;border-radius:2px;flex-shrink:0"></div>
            <div class="sk" style="width:54px;height:54px;border-radius:50%;flex-shrink:0"></div>
            <div class="sinfo" style="gap:5px">
                <div class="sk" style="width:55%;height:13px;border-radius:3px"></div>
                <div class="sk" style="width:38%;height:11px;border-radius:3px"></div>
                <div class="sk" style="width:88%;height:2px;border-radius:1px;margin-top:4px"></div>
            </div>
            <div class="sstat-group">
                <div class="sk" style="width:42px;height:18px;border-radius:3px"></div>
                <div class="sk" style="width:26px;height:11px;border-radius:3px;margin-top:5px;margin-left:auto"></div>
            </div>
        </div>`;

    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">Championship</span>
            <div class="tabs">
                <button class="tab active">Drivers</button>
                <button class="tab">Constructors</button>
            </div>
        </div>
        ${row().repeat(8)}
    </div>`;
}

// ── Full card ──────────────────────────────────────────────────
function renderStandingsCard() {
    const driversActive      = _activeTab === 'drivers';
    const constructorsActive = _activeTab === 'constructors';

    return `
    <div class="card">
        <div class="card-header">
            <div class="standings-header-left">
                <span class="card-title">Championship</span>
            </div>
            <div class="tabs">
                <button class="tab ${driversActive ? 'active' : ''}"
                        onclick="switchStandingsTab('drivers')">Drivers</button>
                <button class="tab ${constructorsActive ? 'active' : ''}"
                        onclick="switchStandingsTab('constructors')">Constructors</button>
            </div>
        </div>
        ${driversActive ? renderDriverRows() : renderConstructorRows()}
    </div>`;
}

// ── Driver rows ────────────────────────────────────────────────
function renderDriverRows() {
    if (!_drivers.length) return renderStandingsEmpty('No driver standings available yet.');

    const maxPts = parseFloat(_drivers[0]?.points ?? 1) || 1;

    return _drivers.map(entry => {
        const pos      = parseInt(entry.position);
        const pts      = parseFloat(entry.points);
        const wins     = parseInt(entry.wins);
        const driver   = entry.Driver;
        const team     = entry.Constructors?.[0];
        const color    = resolveTeamColor(team?.name);
        const pct      = ((pts / maxPts) * 100).toFixed(1);
        const fullName = `${driver.givenName} ${driver.familyName}`;
        const code     = driver.code ?? '';

        // Headshot from OpenF1 — fall back to team-colored initials
        const photoData   = _headshots[code];
        const headshotUrl = photoData?.headshot_url ?? '';
        const initials    = `${driver.givenName[0]}${driver.familyName[0]}`;

        return `
        <div class="standings-row${pos === 1 ? ' standings-row--p1' : ''}">
            <span class="srank ${rankClass(pos)}">${pos}</span>
            <span class="steam-bar" style="background:${color}"></span>
            <div class="sdriver-photo" style="border-color:${color};background:${color}33">
                ${headshotUrl
                    ? `<img src="${headshotUrl}" alt="${code}"
                            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ''}
                <span class="sdriver-initials"
                      style="display:${headshotUrl ? 'none' : 'flex'};background:transparent;color:${color}">
                    ${initials}
                </span>
            </div>
            <div class="sinfo">
                <div class="sname-row">
                    <span class="sname">${fullName}</span>
                    <span class="scode">${code}</span>
                </div>
                <div class="steam-name">${team?.name ?? '—'}</div>
                <div class="sbar-wrap">
                    <div class="sbar" style="width:${pct}%;background:${color}"></div>
                </div>
            </div>
            <div class="sstat-group">
                <div class="spoints">${pts}</div>
                <div class="swins">${wins > 0 ? wins + 'W' : ''}</div>
            </div>
        </div>`;
    }).join('');
}

// ── Constructor rows ───────────────────────────────────────────
function renderConstructorRows() {
    if (!_constructors.length) return renderStandingsEmpty('No constructor standings available yet.');

    const maxPts = parseFloat(_constructors[0]?.points ?? 1) || 1;

    return _constructors.map(entry => {
        const pos         = parseInt(entry.position);
        const pts         = parseFloat(entry.points);
        const wins        = parseInt(entry.wins);
        const constructor = entry.Constructor;
        const color       = resolveTeamColor(constructor.name);
        const pct         = ((pts / maxPts) * 100).toFixed(1);

        const logoUrl  = TEAM_LOGOS?.[constructor.name] ?? '';
        const words    = constructor.name.split(' ');
        const initials = words.length >= 2
            ? `${words[0][0]}${words[1][0]}`
            : constructor.name.slice(0, 2);

        return `
        <div class="standings-row${pos === 1 ? ' standings-row--p1' : ''}">
            <span class="srank ${rankClass(pos)}">${pos}</span>
            <span class="steam-bar" style="background:${color}"></span>
            <div class="sdriver-photo" style="border-color:${color};background:${color}44">
                ${logoUrl
                    ? `<img src="${logoUrl}" alt="${constructor.name}"
                            style="object-fit:contain;padding:8px"
                            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ''}
                <span class="sdriver-initials"
                      style="display:${logoUrl ? 'none' : 'flex'};background:transparent;color:${color}">
                    ${initials.toUpperCase()}
                </span>
            </div>
            <div class="sinfo">
                <div class="sname-row">
                    <span class="sname">${constructor.name}</span>
                </div>
                <div class="steam-name">${constructor.nationality}</div>
                <div class="sbar-wrap">
                    <div class="sbar" style="width:${pct}%;background:${color}"></div>
                </div>
            </div>
            <div class="sstat-group">
                <div class="spoints">${pts}</div>
                <div class="swins">${wins > 0 ? wins + 'W' : ''}</div>
            </div>
        </div>`;
    }).join('');
}

// ── Helpers ────────────────────────────────────────────────────
function rankClass(pos) {
    if (pos === 1) return 'srank-gold';
    if (pos === 2) return 'srank-silver';
    if (pos === 3) return 'srank-bronze';
    return '';
}

function resolveTeamColor(name) {
    if (!name) return '#555';
    if (TEAM_COLORS[name]) return TEAM_COLORS[name];
    const key = Object.keys(TEAM_COLORS).find(k =>
        name.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(name.toLowerCase())
    );
    return key ? TEAM_COLORS[key] : '#555';
}

function renderStandingsEmpty(msg) {
    return `<div class="standings-empty">${msg}</div>`;
}
