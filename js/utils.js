function getFlag(countryName) {
    return COUNTRY_FLAGS[countryName] || '🏁';
}

// "14–16 Mar" or "14 Mar" for single-day
function formatDateRange(startStr, endStr) {
    if (!startStr) return '—';
    const s = new Date(startStr);
    const month = s.toLocaleDateString('en-GB', { month: 'short' });
    const sDay = s.getDate();

    if (!endStr) return `${sDay} ${month}`;

    const e = new Date(endStr);
    const eDay = e.getDate();
    const eMonth = e.toLocaleDateString('en-GB', { month: 'short' });

    if (month === eMonth) return `${sDay}–${eDay} ${month}`;
    return `${sDay} ${month} – ${eDay} ${eMonth}`;
}

// "Mar 2025"
function formatMonthYear(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// Returns 'past' | 'live' | 'next' | 'upcoming' | 'cancelled'
// 'next'  = the single closest future race
// Caller is responsible for marking _isNext on the meeting object
function getRaceStatus(meeting) {
    if (meeting.status === 'cancelled') return 'cancelled';

    const now  = new Date();
    const start = new Date(meeting.date_start);
    // Estimate weekend end if the API doesn't provide date_end
    const end  = meeting.date_end
        ? new Date(meeting.date_end)
        : new Date(start.getTime() + CONFIG.RACE_WEEKEND_DAYS * 86_400_000);

    if (now > end)               return 'past';
    if (now >= start && now <= end) return 'live';
    if (meeting._isNext)         return 'next';
    return 'upcoming';
}

function formatLapTime(seconds) {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(3).padStart(6, '0');
    return m > 0 ? `${m}:${s}` : `${parseFloat(s).toFixed(3)}s`;
}

function formatGap(gap) {
    if (gap === null || gap === undefined) return '—';
    if (typeof gap === 'string' && gap.toUpperCase().includes('LAP')) return gap;
    const n = parseFloat(gap);
    return isNaN(n) ? '—' : `+${n.toFixed(3)}s`;
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
