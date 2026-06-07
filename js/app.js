// ── State ──────────────────────────────────────────────────────
let allMeetings      = [];
let activeMeetingKey = null;

// ── Stint tip (mobile touch tooltip) ───────────────────────────
let _stintTipTimer = null;
function showStintTip(e, text) {
    e.preventDefault();
    let tip = document.getElementById('stint-tip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'stint-tip';
        tip.style.cssText = 'position:fixed;bottom:44px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:12px;font-weight:600;padding:7px 14px;border-radius:8px;z-index:500;white-space:nowrap;pointer-events:none;transition:opacity 0.2s;font-family:Inter,sans-serif;';
        document.body.appendChild(tip);
    }
    tip.textContent = text;
    tip.style.opacity = '1';
    clearTimeout(_stintTipTimer);
    _stintTipTimer = setTimeout(() => { tip.style.opacity = '0'; }, 2000);
}


// ── Boot ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
    initWallpaper();
    setStatus('Loading…', 'idle');
    document.getElementById('calendar-list').innerHTML = renderCalendarSkeleton();
    document.getElementById('race-section').innerHTML  = renderPlaceholder();

    // Fetch calendar, standings, and race winners in parallel
    const [calResult, , winnersResult] = await Promise.allSettled([
        getMeetings(CONFIG.YEAR),
        loadStandings(),
        getRaceWinners(CONFIG.YEAR),
    ]);

    if (calResult.status === 'rejected') {
        document.getElementById('calendar-list').innerHTML =
            renderCalendarError(calResult.reason.message);
        setStatus('Error loading calendar', 'error');
        return;
    }

    const EXCLUDED = ['Saudi Arabia', 'Bahrain'];
    allMeetings = calResult.value
        .filter(m => !EXCLUDED.includes(m.country_name))
        .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    markNextRace(allMeetings);

    document.getElementById('header-year').textContent  = `${CONFIG.YEAR} Season`;
    document.getElementById('sidebar-year').textContent = `${CONFIG.YEAR} Season`;
    document.getElementById('race-count').textContent   = `${allMeetings.length} races`;

    paintCalendar();
    scrollToNextRace();

    // Find next race then fetch its sessions (needs meeting_key first)
    const nextRace = allMeetings.find(m => m._isNext) ??
                     allMeetings.find(m => getRaceStatus(m) === 'upcoming');
    let nextSessions = [];
    if (nextRace) {
        try { nextSessions = await getSessions(nextRace.meeting_key); } catch (e) {}
    }

    // Render home summary strip
    const winners = winnersResult.status === 'fulfilled' ? winnersResult.value : [];
    _allWinners = winners;
    document.getElementById('home-top').innerHTML = renderHomeTop(allMeetings, winners, nextSessions);
    if (nextRace) startHomeCountdown(nextRace);

    // Auto-load most relevant session into the home page column
    await loadHomeContent('home-race-section', nextSessions);

    setStatus('', 'ready');
}

// ── Latest completed race ──────────────────────────────────────
function getLatestRace() {
    const past = allMeetings.filter(m => getRaceStatus(m) === 'past');
    return past.at(-1) ?? allMeetings.find(m => m._isNext) ?? allMeetings[0];
}

// ── Home content loader: live weekend session or fallback ──────
async function loadHomeContent(targetId, nextSessions = []) {
    const liveMeeting = allMeetings.find(m => getRaceStatus(m) === 'live');
    if (liveMeeting && nextSessions.length) {
        const now = new Date();
        const latestStarted = nextSessions
            .filter(s => new Date(s.date_start) < now)
            .sort((a, b) => new Date(b.date_start) - new Date(a.date_start))[0];
        if (latestStarted) {
            const showed = await loadSessionForHome(liveMeeting, latestStarted, targetId);
            if (showed) return;
        }
    }
    const latest = getLatestRace();
    if (latest) await loadRace(latest, targetId);
}

// ── Calendar helpers ───────────────────────────────────────────
function markNextRace(meetings) {
    let marked = false;
    meetings.forEach(m => {
        delete m._isNext;
        if (!marked) {
            const s = getRaceStatus(m);
            if (s === 'upcoming' || s === 'live') { m._isNext = true; marked = true; }
        }
    });
}

function paintCalendar() {
    const list = document.getElementById('calendar-list');
    list.innerHTML = renderCalendar(allMeetings, activeMeetingKey);
    list.querySelectorAll('.cal-item').forEach(el => {
        el.addEventListener('click', () => onRaceClick(el.dataset.key));
    });
}

function scrollToNextRace() {
    const list   = document.getElementById('calendar-list');
    const target = list.querySelector('.is-next, .is-live, .is-active');
    if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ── Race selection (season page) ───────────────────────────────
function onRaceClick(meetingKey) {
    if (activeMeetingKey === meetingKey) return;
    activeMeetingKey = meetingKey;

    paintCalendar();
    scrollToNextRace();

    const meeting = allMeetings.find(m => m.meeting_key === meetingKey);
    if (!meeting) return;

    setStatus(`${meeting.country_name} Grand Prix`, 'ready');
    loadRace(meeting, 'race-section');
}

// ── Home countdown timer ───────────────────────────────────────
function startHomeCountdown(meeting) {
    function tick() {
        const el = document.getElementById('home-countdown');
        if (!el) return;
        const diff = new Date(meeting.date_start) - new Date();
        if (diff <= 0) {
            el.textContent = 'Race Weekend!';
            const label = document.getElementById('home-countdown-label');
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

let _allWinners = [];

function openWinnersModal() {
    const rows = _allWinners.slice().reverse().map(race => {
        const r     = race.Results[0];
        const code  = r.Driver.code ?? '';
        const name  = `${r.Driver.givenName} ${r.Driver.familyName}`;
        const team  = r.Constructor.name;
        const color = resolveTeamColor(team);
        const flag  = getFlag(race.Circuit?.Location?.country ?? '');
        return `
        <div class="winner-row">
            <span class="winner-flag">${flag}</span>
            <span class="winner-bar" style="background:${color}"></span>
            <span class="winner-code" style="color:${color}">${code}</span>
            <span class="winner-name">${name}</span>
            <span class="winner-team">${team}</span>
        </div>`;
    }).join('');

    document.getElementById('winners-modal-body').innerHTML = rows;
    document.getElementById('winners-modal').style.display = 'flex';
}

function closeWinnersModal() {
    document.getElementById('winners-modal').style.display = 'none';
}

// ── Wallpaper ──────────────────────────────────────────────────
function initWallpaper() {
    const saved = localStorage.getItem('wallpaper_driver');
    if (saved) applyWallpaper(saved);
}

function applyWallpaper(code) {
    const layer  = document.getElementById('wallpaper-layer');
    const mobile = window.innerWidth <= 768;
    const exts   = ['jpg', 'jpeg', 'png', 'webp'];

    // On mobile: try VER_mobile.{ext} first, then fall back to VER.{ext}
    const candidates = mobile
        ? [...exts.map(e => `${code}_mobile.${e}`), ...exts.map(e => `${code}.${e}`)]
        : exts.map(e => `${code}.${e}`);

    // Set team accent color
    const color = DRIVER_ACCENT[code] || '#888888';
    const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.18)`);

    let loaded = false;
    function tryNext(i) {
        if (i >= candidates.length) return;
        const img = new Image();
        img.onload = () => {
            if (!loaded) {
                loaded = true;
                layer.style.backgroundImage = `url('img/wallpapers/${candidates[i]}')`;
                layer.classList.add('active');
                document.body.classList.add('has-wallpaper');
            }
        };
        img.onerror = () => tryNext(i + 1);
        img.src = `img/wallpapers/${candidates[i]}`;
    }
    tryNext(0);
}

function removeWallpaper() {
    const layer = document.getElementById('wallpaper-layer');
    layer.style.backgroundImage = '';
    layer.classList.remove('active');
    document.body.classList.remove('has-wallpaper');
    document.documentElement.style.setProperty('--accent', '#888888');
    document.documentElement.style.setProperty('--accent-glow', 'rgba(136,136,136,0.12)');
}

// ── Settings modal ─────────────────────────────────────────────
let _availableWallpapers = [];

async function openSettings() {
    if (!_availableWallpapers.length) {
        const exts = ['jpg', 'jpeg', 'png', 'webp'];
        const codes = Object.keys(DRIVER_IMAGES);
        const results = await Promise.all(codes.map(code =>
            new Promise(resolve => {
                let i = 0;
                function tryNext() {
                    if (i >= exts.length) { resolve(null); return; }
                    const img = new Image();
                    img.onload  = () => resolve(code);
                    img.onerror = () => { i++; tryNext(); };
                    img.src = `img/wallpapers/${code}.${exts[i]}`;
                }
                tryNext();
            })
        ));
        _availableWallpapers = results.filter(Boolean);
    }
    renderSettingsDriverGrid();
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

function renderSettingsDriverGrid() {
    const current = localStorage.getItem('wallpaper_driver');
    const grid = document.getElementById('settings-driver-grid');

    const noneCard = `
        <div class="wallpaper-driver-card ${!current ? 'is-selected' : ''}" onclick="selectWallpaper(null)">
            <div class="wallpaper-driver-none">✕</div>
            <span class="wallpaper-driver-code">None</span>
        </div>`;

    const driverCards = _availableWallpapers.map(code => {
        const img = DRIVER_IMAGES[code] ?? '';
        const sel = current === code ? 'is-selected' : '';
        return `
        <div class="wallpaper-driver-card ${sel}" onclick="selectWallpaper('${code}')">
            ${img
                ? `<img class="wallpaper-driver-img" src="${img}" alt="${code}">`
                : `<div class="wallpaper-driver-none">${code}</div>`}
            <span class="wallpaper-driver-code">${code}</span>
        </div>`;
    }).join('');

    grid.innerHTML = _availableWallpapers.length
        ? noneCard + driverCards
        : `<p style="color:var(--muted);font-size:12px">No wallpapers found. Add images to <code>img/wallpapers/</code> named by driver code (e.g. <code>NOR.jpg</code>).</p>`;
}

function selectWallpaper(code) {
    if (code) {
        localStorage.setItem('wallpaper_driver', code);
        applyWallpaper(code);
    } else {
        localStorage.removeItem('wallpaper_driver');
        removeWallpaper();
    }
    renderSettingsDriverGrid();
}

// ── Page navigation ────────────────────────────────────────────
function showPage(page) {
    document.getElementById('page-home').classList.toggle('page-hidden', page !== 'home');
    document.getElementById('page-season').classList.toggle('page-hidden', page !== 'season');
    document.getElementById('nav-home').classList.toggle('is-active', page === 'home');
    document.getElementById('nav-season').classList.toggle('is-active', page === 'season');
}

// ── Status bar ─────────────────────────────────────────────────
function setStatus(text, state) {
    document.getElementById('status-text').textContent = text;
    document.getElementById('status-dot').className = `status-dot ${state}`;
}
