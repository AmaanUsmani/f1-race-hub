document.body.insertAdjacentHTML('afterbegin', `
    <header class="header">
        <div class="header-logo">
            <span class="logo-badge">F1</span>
            <span class="logo-text">Race Hub</span>
            <span class="status-dot" id="status-dot"></span>
            <span class="logo-year" id="header-year">— Season</span>
        </div>
        <nav class="header-nav">
            <button class="nav-btn is-active" id="nav-home" onclick="showPage('home')">Home</button>
            <button class="nav-btn" id="nav-season" onclick="showPage('season')">Season</button>
        </nav>
        <div class="header-right">
            <span class="header-dev">@amaan_1221</span>
            <button class="gear-btn" onclick="openSettings()" title="Settings">&#9881;</button>
            <span id="status-text" style="display:none"></span>
        </div>
    </header>
    <footer class="site-footer">
        <span class="footer-dev">by <a class="footer-link" href="https://instagram.com/amaan_1221" target="_blank">@amaan_1221</a></span>
    </footer>
`);
