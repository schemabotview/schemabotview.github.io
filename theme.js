// Theme control for the GraphL catalog. The TOGGLE IS TWO-STATE, dark <-> light, matching every
// concept app (`ui-shell/src/useTheme.ts`, and python-lab's hand-port of it). It cycled through a
// third `system` step until 2026-09-30; see the note below for why that came out.
//
// The key is `graphl:theme` and the switch is `data-theme` on <html>. Both are PLATFORM-wide
// contracts, not private to this page: every GraphL app is same-origin under graphl.in, so a
// concept app that reads the same key and honours the same attribute inherits the reader's choice
// for free, with nothing passed between them. Keep them stable.
//
//   key      localStorage['graphl:theme']
//   values   'light' | 'dark' | absent
//   switch   data-theme on <html>; absent means "no explicit choice"
//
// THE ABSENT STATE STILL EXISTS — it is just no longer somewhere the button can walk back to. With
// nothing stored the page follows the OS, exactly as it always did: `apply` leaves the attribute
// off and the stylesheet's prefers-color-scheme query decides. That is what a first visit gets.
// Once a reader has an opinion the control simply flips, which is what every dark-mode toggle they
// have ever used does; a third step costs them a press to get where they were going and has to be
// labelled something ("System theme") that is about the machine rather than about the page.
//
// This mirrors ui-shell's split rather than breaking from it. There the absence means "follow the
// DECK", because a deck is authored and a reader's OS should not silently repaint it; here it means
// "follow the OS", because a directory page has no authored look to protect. The stored VALUES are
// identical either way, so the two never disagree about an explicit choice — only about what the
// absence resolves to, which is the one difference that was always there.

const KEY = 'graphl:theme'

const FACE = {
  light: { glyph: '☀', label: 'Light theme' },
  dark: { glyph: '☾', label: 'Dark theme' },
}

const button = document.getElementById('theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')

// localStorage throws in some privacy modes; a broken theme toggle must never take the page with
// it, so every access is guarded and the fallback is simply "nothing chosen".
function readStored() {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function write(choice) {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    /* choice will not survive the reload; the page still works */
  }
}

// What is actually on screen: the reader's choice, or the OS while they have not made one. The
// button's glyph reads from this rather than from storage, so a first visit shows the moon on a
// dark OS and the sun on a light one instead of a state-of-its-own symbol.
const resolve = (stored) => stored ?? (prefersDark.matches ? 'dark' : 'light')

function apply(stored) {
  // No stored choice means no attribute at all — the stylesheet's media query takes over. Writing
  // the resolved value here instead would LOOK identical and would quietly end the absent state:
  // the OS could never move the page again, and the concept apps would start reading an explicit
  // choice this reader never made.
  if (stored === null) delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = stored

  const theme = resolve(stored)
  const next = theme === 'dark' ? 'light' : 'dark'
  button.textContent = FACE[theme].glyph
  // The accessible name states where you are AND what the press does, since the glyph alone
  // cannot say either.
  button.setAttribute('aria-label', `${FACE[theme].label}. Switch to ${FACE[next].label.toLowerCase()}.`)
  button.title = button.getAttribute('aria-label')
}

// Swapping the theme must look instantaneous. Several elements carry a 0.15s colour transition
// for hover, and without this the page ground flips at once while the nav and cards cross-fade
// behind it — the switch reads as a smear rather than a change. Transitions are suppressed for
// the one frame the swap happens in, then restored so hover still animates. Two nested rAFs: the
// first runs before the paint that applies the new colours, the second after it.
function swap(stored) {
  const root = document.documentElement
  root.classList.add('theme-swap')
  apply(stored)
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-swap')))
}

button.addEventListener('click', () => {
  // Flip what is ON SCREEN, not what is stored. On a first visit nothing is stored, and a reader
  // looking at a dark page who presses the button means "make it light" — resolving first is what
  // makes that press do the obvious thing instead of landing on the theme they already had.
  const next = resolve(readStored()) === 'dark' ? 'light' : 'dark'
  write(next)
  swap(next)
})

// The OS flipped while this reader has no choice of their own. The GROUND already moved on its own
// (that is the media query doing its job) but the glyph is JavaScript's to keep honest, so it has
// to be re-rendered or the button sits there claiming the opposite of the page behind it. Nothing
// to do once a choice is stored — the attribute outranks the query.
prefersDark.addEventListener('change', () => {
  if (readStored() === null) apply(null)
})

// Another GraphL app on the same origin changed the choice — follow it, so the platform does not
// disagree with itself between tabs.
window.addEventListener('storage', (e) => {
  if (e.key === KEY || e.key === null) swap(readStored())
})

apply(readStored())
