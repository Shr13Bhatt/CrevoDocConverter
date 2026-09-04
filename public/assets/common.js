document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderHeader();
  renderFooter();
  highlightActiveLink();
});

// Theme Management (Dark / Light Mode)
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  // Update toggle button icon/text
  const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.innerHTML = newTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
  });
}

// Mobile Menu Drawer Toggle
function toggleMobileMenu() {
  const navMenu = document.getElementById('nav-menu');
  const toggleBtn = document.getElementById('mobile-toggle-btn');
  if (!navMenu) return;

  const isOpen = navMenu.classList.contains('mobile-active');
  if (isOpen) {
    navMenu.classList.remove('mobile-active');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  } else {
    navMenu.classList.add('mobile-active');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  }
}

// Dynamically Render Header with Responsive Mobile Navigation
function renderHeader() {
  const headerRoot = document.getElementById('header-root');
  if (!headerRoot) return;

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const toggleText = currentTheme === 'dark' ? '☀️ Light' : '🌙 Dark';

  const headerHtml = `
    <header class="header">
      <div class="container header-container">
        <a href="/" class="logo-link">
          <img src="/logo.png" alt="CrevoDoc Logo" class="logo-img" />
        </a>
        
        <div class="header-right-actions">
          <button class="theme-toggle-btn header-theme-btn" onclick="toggleTheme()">
            ${toggleText}
          </button>
          <button class="mobile-toggle-btn" id="mobile-toggle-btn" onclick="toggleMobileMenu()" aria-label="Toggle Navigation">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>

        <nav class="nav-menu" id="nav-menu">
          <a href="/" class="nav-link" id="nav-home" onclick="toggleMobileMenu()">Home</a>
          <a href="/all-tools" class="nav-link" id="nav-tools" onclick="toggleMobileMenu()">All Tools</a>
          <a href="/#how-it-works" class="nav-link" onclick="toggleMobileMenu()">About</a>
          <a href="/#faq" class="nav-link" onclick="toggleMobileMenu()">FAQ</a>
          <button class="theme-toggle-btn nav-theme-btn" onclick="toggleTheme()">
            ${toggleText}
          </button>
        </nav>
      </div>
    </header>
  `;
  headerRoot.innerHTML = headerHtml;
}

// Dynamically Render Footer
function renderFooter() {
  const footerRoot = document.getElementById('footer-root');
  if (!footerRoot) return;

  const year = new Date().getFullYear();
  const footerHtml = `
    <footer class="footer">
      <div class="container footer-container">
        <div>
          <a href="/" class="logo-link" style="margin-bottom: 12px; display: inline-flex;">
            <img src="/logo.png" alt="CrevoDoc Logo" class="logo-img" style="height: 44px;" />
          </a>
          <p class="copyright">&copy; ${year} CrevoDoc. Developed by Shrey Bhatt. All rights reserved.</p>
        </div>
        <div class="footer-links">
          <a href="/">Home</a>
          <a href="/all-tools">All Tools</a>
          <a href="/#how-it-works">How It Works</a>
          <a href="/#faq">FAQ</a>
        </div>
      </div>
    </footer>
  `;
  footerRoot.innerHTML = footerHtml;
}

// Highlight the current page in the navigation bar
function highlightActiveLink() {
  const path = window.location.pathname;
  const links = ['nav-home', 'nav-tools'];
  links.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  if (path === '/' || path === '/index.html') {
    const el = document.getElementById('nav-home');
    if (el) el.classList.add('active');
  } else if (path === '/all-tools' || path === '/all-tools.html' || path !== '') {
    const el = document.getElementById('nav-tools');
    if (el) el.classList.add('active');
  }
}

// Expose functions globally
window.toggleTheme = toggleTheme;
window.toggleMobileMenu = toggleMobileMenu;
