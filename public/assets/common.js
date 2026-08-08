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
  const toggleBtn = document.querySelector('.theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.innerHTML = newTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
  }
}

// Dynamically Render Header
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
        <nav class="nav-menu">
          <a href="/" class="nav-link" id="nav-home">Home</a>
          <a href="/all-tools" class="nav-link" id="nav-tools">All Tools</a>
          <a href="/#how-it-works" class="nav-link">About</a>
          <a href="/#faq" class="nav-link">FAQ</a>
          <button class="theme-toggle-btn" onclick="toggleTheme()">
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
          <a href="/" class="logo-link" style="margin-bottom: 8px;">
            <img src="/logo.png" alt="CrevoDoc Logo" class="logo-img" style="height: 45px;" />
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
  // Clear any existing active links
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

// Expose theme toggling globally
window.toggleTheme = toggleTheme;
