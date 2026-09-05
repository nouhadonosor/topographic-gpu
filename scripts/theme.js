function initializeTheme() {
  const themeToggle = document.querySelector('#theme-toggle');
  const themeIcon = document.querySelector('#theme-icon');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  const setTheme = isDark => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    themeIcon.textContent = isDark ? '\u2600' : '\u263e';
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    themeToggle.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeColor.setAttribute('content', isDark ? '#171814' : '#ecebe4');
  };

  setTheme(systemPrefersDark.matches);
  themeToggle.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme !== 'dark');
  });
}
