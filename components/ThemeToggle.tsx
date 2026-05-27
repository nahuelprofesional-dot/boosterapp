'use client'

// Toggle that flips html.dark on/off and persists the choice to localStorage.
// Renders identical markup on the server and the client (icons swap via CSS,
// not via React state) so there's no hydration mismatch.

export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const next = root.classList.contains('dark') ? 'light' : 'dark'
    root.classList.toggle('dark', next === 'dark')
    try { localStorage.setItem('theme', next) } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar tema"
      title="Cambiar tema"
      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border text-muted hover:text-fg hover:bg-surface-alt transition-colors"
    >
      <span className="dark:hidden">
        <MoonIcon />
      </span>
      <span className="hidden dark:inline">
        <SunIcon />
      </span>
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
