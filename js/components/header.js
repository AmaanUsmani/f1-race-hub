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
        <span class="footer-dev">Developed by Amaan</span>
        <div class="footer-socials">
            <a class="footer-social-btn" href="https://instagram.com/amaan_1221" target="_blank" title="@amaan_1221">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="3.5"/>
                    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>
                </svg>
            </a>
            <a class="footer-social-btn" href="https://discord.com" target="_blank" title=".dungeoncrawler">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.012.043.036.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
            </a>
        </div>
    </footer>
`);
