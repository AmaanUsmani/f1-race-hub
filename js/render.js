// ── Skeleton loader shown while calendar fetches ───────────────
function renderCalendarSkeleton() {
    const item = `
        <div class="skeleton-item">
            <div class="sk" style="width:18px;height:12px;border-radius:3px"></div>
            <div class="sk" style="width:26px;height:26px;border-radius:50%"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:6px">
                <div class="sk" style="width:65%;height:13px;border-radius:3px"></div>
                <div class="sk" style="width:80%;height:11px;border-radius:3px"></div>
            </div>
        </div>`;
    return `<div class="skeleton-list">${item.repeat(12)}</div>`;
}

// ── Single calendar row ────────────────────────────────────────
function renderCalendarItem(meeting, round, isActive) {
    const status  = getRaceStatus(meeting);
    const flag    = getFlag(meeting.country_name);
    const dateStr = formatDateRange(meeting.date_start, meeting.date_end);

    const statusMeta = {
        past:      { itemClass: 'is-past',      badge: 'done',     label: 'Done'      },
        live:      { itemClass: 'is-live',       badge: 'live',     label: 'Live'      },
        next:      { itemClass: 'is-next',       badge: 'next',     label: 'Next'      },
        upcoming:  { itemClass: 'is-upcoming',   badge: '',         label: ''          },
        cancelled: { itemClass: 'is-cancelled',  badge: 'cancelled',label: 'Cancelled' },
    }[status] ?? { itemClass: '', badge: '', label: '' };

    const activeClass = isActive ? 'is-active' : '';
    const badge = statusMeta.label
        ? `<span class="status-badge ${statusMeta.badge}">${statusMeta.label}</span>`
        : '';

    return `
    <div class="cal-item ${statusMeta.itemClass} ${activeClass}" data-key="${meeting.meeting_key}">
        <span class="cal-round">${round}</span>
        <span class="cal-flag">${flag}</span>
        <div class="cal-info">
            <div class="cal-country">${meeting.country_name}</div>
            <div class="cal-meta">
                <span class="cal-circuit">${meeting.location}</span>
                <span class="cal-dot">·</span>
                <span class="cal-date">${dateStr}</span>
            </div>
        </div>
        <div class="cal-badge-wrap">${badge}</div>
    </div>`;
}

// ── Full calendar list ─────────────────────────────────────────
function renderCalendar(meetings, activeMeetingKey) {
    return meetings
        .map((m, i) => renderCalendarItem(m, i + 1, m.meeting_key === activeMeetingKey))
        .join('');
}

// ── Main area: placeholder before a race is selected ──────────
function renderPlaceholder() {
    return `
    <div class="placeholder">
        <div class="placeholder-icon">🏎️</div>
        <div class="placeholder-title">Select a Grand Prix</div>
        <div class="placeholder-sub">
            Choose any race from the 2025 calendar on the left to load its data.
        </div>
    </div>`;
}

// ── Session name abbreviations ─────────────────────────────────
const SESSION_ABBR = {
    'Practice 1':        'FP1',
    'Practice 2':        'FP2',
    'Practice 3':        'FP3',
    'Qualifying':        'QUALI',
    'Race':              'RACE',
    'Sprint':            'SPRINT',
    'Sprint Qualifying': 'SQ',
    'Sprint Shootout':   'SQ',
};

// ── Home summary strip ─────────────────────────────────────────
function renderHomeTop(meetings, winners, nextSessions = []) {
    const next = meetings.find(m => m._isNext) ??
                 meetings.find(m => getRaceStatus(m) === 'upcoming');
    return `
    <div class="htop-grid">
        ${renderNextRaceCard(next, nextSessions)}
        ${renderSeasonProgressCard(meetings)}
        ${renderRecentWinnersCard(winners)}
    </div>`;
}

function renderNextRaceCard(meeting, sessions = []) {
    if (!meeting) return `
    <div class="card htop-card">
        <div class="htop-label">Next Race</div>
        <div class="htop-empty">Season complete</div>
    </div>`;

    const flag = getFlag(meeting.country_name);
    const date = formatDateRange(meeting.date_start, meeting.date_end);
    const now  = new Date();

    const scheduleHTML = sessions.length ? `
    <div class="sched">
        ${sessions.map(s => {
            const abbr  = SESSION_ABBR[s.session_name] ?? s.session_name;
            const dt    = new Date(s.date_start);
            const past  = dt < now;
            const day   = dt.toLocaleDateString('en-GB', { weekday: 'short' });
            const time  = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            return `
            <div class="sched-row${past ? ' sched-past' : ''}">
                <span class="sched-name">${abbr}</span>
                <span class="sched-day">${day}</span>
                <span class="sched-time">${time}</span>
            </div>`;
        }).join('')}
    </div>` : '';

    return `
    <div class="card htop-card htop-card-next">
        <div class="htop-label">Next Race</div>
        <div class="htop-next-body">
            <div class="htop-next-left">
                <div class="htop-next-top">
                    <span class="htop-next-flag">${flag}</span>
                    <div>
                        <div class="htop-next-name">${meeting.country_name} Grand Prix</div>
                        <div class="htop-next-meta">${meeting.location} · ${date}</div>
                    </div>
                </div>
                ${scheduleHTML}
            </div>
            <div class="htop-next-right">
                <div class="htop-countdown" id="home-countdown">—</div>
                <div class="htop-countdown-label" id="home-countdown-label">Until Race Weekend</div>
            </div>
        </div>
    </div>`;
}

function renderSeasonProgressCard(meetings) {
    const total = meetings.length;
    const done  = meetings.filter(m => getRaceStatus(m) === 'past').length;
    const pct   = total > 0 ? (done / total * 100).toFixed(1) : 0;
    const dots  = meetings.map(m => {
        const s = getRaceStatus(m);
        const cls = s === 'past' ? 'sdot-done'
                  : s === 'live' ? 'sdot-live'
                  : s === 'next' ? 'sdot-next'
                  : 'sdot-upcoming';
        return `<span class="sdot ${cls}" title="${m.country_name}"></span>`;
    }).join('');
    return `
    <div class="card htop-card">
        <div class="htop-label">Season Progress</div>
        <div class="htop-prog-nums">
            <span class="htop-prog-done">${done}</span><span class="htop-prog-total"> / ${total}</span>
        </div>
        <div class="htop-prog-sub">races complete</div>
        <div class="htop-prog-bar-wrap">
            <div class="htop-prog-bar" style="width:${pct}%"></div>
        </div>
        <div class="sdots">${dots}</div>
    </div>`;
}

function renderRecentWinnersCard(winners) {
    if (!winners.length) return `
    <div class="card htop-card">
        <div class="htop-label">Recent Winners</div>
        <div class="htop-empty">No results yet</div>
    </div>`;
    const recentRows = winners.slice(-4).reverse().map(race => {
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
    const showMore = winners.length > 4 ? `
        <button class="winners-toggle" onclick="openWinnersModal()">Show all ${winners.length} races</button>` : '';
    return `
    <div class="card htop-card">
        <div class="htop-label">Recent Winners</div>
        ${recentRows}
        ${showMore}
    </div>`;
}

// ── Inline error inside sidebar ────────────────────────────────
function renderCalendarError(message) {
    return `
    <div class="error-state">
        <span class="error-title">Failed to load calendar</span>
        <span class="error-detail">${message}</span>
    </div>`;
}
