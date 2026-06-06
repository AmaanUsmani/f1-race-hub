document.getElementById('app').insertAdjacentHTML('beforeend', `
    <div id="page-season" class="page page-hidden">
        <aside class="sidebar">
            <div class="sidebar-header">
                <span class="sidebar-year" id="sidebar-year">— Season</span>
                <span class="sidebar-count" id="race-count"></span>
            </div>
            <div class="calendar-list" id="calendar-list"></div>
        </aside>
        <main class="main" id="main">
            <div id="race-section"></div>
        </main>
    </div>
`);
