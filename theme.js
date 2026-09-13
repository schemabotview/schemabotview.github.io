// Theme control for the GraphL catalog. Three states: `system` (no stored value — the OS decides
// via prefers-color-scheme) plus explicit `light` and `dark`, which override it in both
// directions. index.html applies a stored choice before first paint; this module owns everything
// after that — the button, the label, and reacting to changes.
//
// The key is `graphl:theme` and the switch is `data-theme` on <html>. Both are PLATFORM-wide
// contracts, not private to this page: every GraphL app is same-origin under graphl.in, so a
// concept app that reads the same key and honours the same attribute inherits the reader's choice
// for free, with nothing passed between them. Keep them stable.

const KEY = 'graphl:theme'
const CYCLE = ['system', 'light', 'dark']

const FACE = {
  system: { glyph: '◐', label: 'System theme' },
  light: { glyph: '☀', label: 'Light theme' },
  dark: { glyph: '☾', label: 'Dark theme' },
}

const button = document.getElementById('theme')

// localStorage throws in some privacy modes; a broken theme toggle must never take the page with
// it, so every access is guarded and the fallback is simply "system".
function read() {
  try {
    const stored = localStorage.getItem(KEY)
    return CYCLE.includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function write(choice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* choice will not survive the reload; the page still works */
  }
}

function apply(choice) {
  // "system" means no attribute at all — the stylesheet's media query takes over.
  if (choice === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = choice

  const next = CYCLE[(CYCLE.indexOf(choice) + 1) % CYCLE.length]
  button.textContent = FACE[choice].glyph
  // The accessible name states where you are AND what the press does, since the glyph alone
  // cannot say either.
  button.setAttribute('aria-label', `${FACE[choice].label}. Switch to ${FACE[next].label.toLowerCase()}.`)
  button.title = button.getAttribute('aria-label')
}

// Swapping the theme must look instantaneous. Several elements carry a 0.15s colour transition
// for hover, and without this the page ground flips at once while the nav and cards cross-fade
// behind it — the switch reads as a smear rather than a change. Transitions are suppressed for
// the one frame the swap happens in, then restored so hover still animates. Two nested rAFs: the
// first runs before the paint that applies the new colours, the second after it.
function swap(choice) {
  const root = document.documentElement
  root.classList.add('theme-swap')
  apply(choice)
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-swap')))
}

button.addEventListener('click', () => {
  const next = CYCLE[(CYCLE.indexOf(read()) + 1) % CYCLE.length]
  write(next)
  swap(next)
})

// Another GraphL app on the same origin changed the choice — follow it, so the platform does not
// disagree with itself between tabs.
window.addEventListener('storage', (e) => {
  if (e.key === KEY || e.key === null) swap(read())
})

apply(read())
