// The GraphL catalog index. Two sections, each a list of published sites: COURSES (the concept
// apps — narrated diagram courses) and LABS (their hands-on counterparts, e.g. python-lab pairs
// with python). Each is a flat [{ slug, name }] file, and every entry links into its own site at
// graphl.in/<slug>/ — the index only points at them, it never lists their courses or exercises.
//
// Adding an entry = adding a { slug, name } to the right file, once that site is deployed.
// The active section lives in the hash (#courses / #labs) so a tab is linkable and survives reload.

const CATALOG = document.getElementById('catalog')
const SUBJECT = document.getElementById('subject')
const TABS = [...document.querySelectorAll('[role="tab"]')]

const SECTIONS = {
  courses: { file: 'concepts.json', empty: 'No courses published yet.' },
  labs: { file: 'labs.json', empty: 'No labs published yet.' },
}
const DEFAULT_SECTION = 'courses'

// Successful lists are kept so switching back and forth doesn't refetch or re-flash a loading
// state. Failures are deliberately NOT cached: a blip on one tab should be retried the next time
// that tab is opened, not remembered for the life of the page.
const loaded = new Map()

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

// A row: a numbered card linking into the site's own app (graphl.in/<slug>/). Reuses the concept
// apps' landing vocabulary (.idx-card*) — number box · title · arrow — so the root catalog and each
// site's own index read as one system. `i` is the zero-based position → the 01, 02… label.
function entryCard(entry, i) {
  const li = el('li', 'idx-card')
  const a = el('a', 'idx-card__link')
  a.href = `${entry.slug}/`
  a.appendChild(el('span', 'idx-card__num', String(i + 1).padStart(2, '0')))
  a.appendChild(el('span', 'idx-card__title', entry.name ?? entry.slug))
  const arrow = el('span', 'idx-card__arrow', '→')
  arrow.setAttribute('aria-hidden', 'true')
  a.appendChild(arrow)
  li.appendChild(a)
  return li
}

function sectionFromHash() {
  const name = location.hash.replace(/^#\/?/, '')
  return name in SECTIONS ? name : DEFAULT_SECTION
}

async function listFor(section) {
  if (loaded.has(section)) return loaded.get(section)
  const list = await getJSON(SECTIONS[section].file).catch(() => null)
  if (list !== null) loaded.set(section, list)
  return list
}

// Guards against a slow fetch for an abandoned tab overwriting the one now on screen.
let renderToken = 0

async function render() {
  const section = sectionFromHash()
  const token = ++renderToken

  for (const tab of TABS) {
    const selected = tab.dataset.tab === section
    tab.setAttribute('aria-selected', String(selected))
    tab.tabIndex = selected ? 0 : -1 // roving tabindex: one stop for the whole tablist
    if (selected && tab.dataset.subject) SUBJECT.textContent = tab.dataset.subject
  }
  CATALOG.setAttribute('aria-labelledby', `tab-${section}`)

  if (!loaded.has(section)) CATALOG.replaceChildren(el('li', 'idx__empty', 'Loading…'))
  const entries = await listFor(section)
  if (token !== renderToken) return

  if (entries === null) {
    CATALOG.replaceChildren(el('li', 'idx__empty', 'Catalog unavailable.'))
  } else if (entries.length === 0) {
    CATALOG.replaceChildren(el('li', 'idx__empty', SECTIONS[section].empty))
  } else {
    CATALOG.replaceChildren(...entries.map(entryCard))
  }
}

function show(section) {
  if (sectionFromHash() === section) return
  location.hash = section // hashchange drives the re-render
}

for (const [index, tab] of TABS.entries()) {
  tab.addEventListener('click', () => show(tab.dataset.tab))
  tab.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = TABS[(index + step + TABS.length) % TABS.length]
    next.focus()
    show(next.dataset.tab)
  })
}

window.addEventListener('hashchange', render)
render()
