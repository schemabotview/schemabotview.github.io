// The GraphL catalog index. One file, catalog.json, describes everything the site lists: the
// sections in the header nav (`kinds`) and the published sites under them (`apps`). Adding a
// sister repo is adding one object to `apps` — no change here, no change to index.html.
//
// Every card links into its own site at graphl.in/<slug>/, and the index never fetches or lists
// what is inside them: each site owns its own navigation. Everything is same-origin under
// graphl.in, which is what lets a session and a theme choice be shared across all of them.
//
// The active section lives in the hash (#courses / #labs / …) so it is linkable and survives a
// reload. Kind ids ARE the hash, which is why they read plural: #courses and #labs were already
// public URLs before the catalog became data, and they still resolve.
//
// Robustness rule, applied throughout: unknown or missing values DEGRADE, they never break the
// page. An app naming a kind that no longer exists still gets a tab; an app with no name falls
// back to its slug; a bad `status` is treated as live. The catalog is hand-edited, so the failure
// mode for a typo has to be "slightly wrong", never "blank page".

const CATALOG = document.getElementById('catalog')
const SUBJECT = document.getElementById('subject') // sr-only <h1>
const NAV = document.getElementById('nav')

const SOURCE = 'catalog.json'

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

// ---------------------------------------------------------------- data

// The parsed catalog, or null if it could not be loaded. Held rather than refetched so switching
// sections does not re-flash a loading state; a failure is NOT held, so the next hashchange
// retries instead of the error sticking until a reload.
let catalog = null

async function load() {
  if (catalog) return catalog
  try {
    const res = await fetch(SOURCE, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`${SOURCE} → ${res.status}`)
    const data = await res.json()
    catalog = normalise(data)
    return catalog
  } catch (err) {
    console.error(err)
    return null
  }
}

// Turn whatever is in the file into the shape the renderer expects, inventing what is missing.
// A kind is only *declared* so it can carry a label and an order — an app may reference one that
// was never declared, and rather than dropping that app on the floor we append a tab for it.
function normalise(data) {
  const kinds = (Array.isArray(data?.kinds) ? data.kinds : [])
    .filter((k) => k && typeof k.id === 'string')
    .map((k) => ({ id: k.id, label: k.label || title(k.id) }))

  const apps = (Array.isArray(data?.apps) ? data.apps : [])
    .filter((a) => a && typeof a.slug === 'string')
    .filter((a) => a.status !== 'hidden')
    .map((a) => ({
      slug: a.slug,
      name: a.name || a.slug,
      kind: a.kind || kinds[0]?.id || 'other',
      subject: a.subject || a.name || a.slug,
      status: a.status === 'soon' ? 'soon' : 'live',
      access: a.access === 'premium' ? 'premium' : 'free',
      href: a.href || `${a.slug}/`,
    }))

  const declared = new Set(kinds.map((k) => k.id))
  for (const app of apps) {
    if (declared.has(app.kind)) continue
    declared.add(app.kind)
    kinds.push({ id: app.kind, label: title(app.kind) })
  }

  return { kinds, apps }
}

const title = (id) => id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// ---------------------------------------------------------------- render

// The header nav, built from the catalog's kinds. These stay plain anchors to #<id> so that
// activation, keyboard, middle-click and copy-link are all the browser's job — this module only
// marks which one is current.
function renderNav(kinds, current) {
  NAV.replaceChildren(
    ...kinds.map((kind) => {
      const a = el('a', 'site__link', kind.label)
      a.href = `#${kind.id}`
      a.dataset.kind = kind.id
      if (kind.id === current) a.setAttribute('aria-current', 'page')
      return a
    }),
  )
}

// A row: a numbered card linking into the site's own app (graphl.in/<slug>/). Reuses the concept
// apps' landing vocabulary (.idx-card*) — number box · title · arrow — so the root catalog and each
// site's own index read as one system. `i` is the zero-based position → the 01, 02… label.
//
// A "soon" app is deliberately not a link: it has no deploy yet, and a card that 404s is worse
// than one that says it is coming.
function card(app, i) {
  const li = el('li', 'idx-card')
  const soon = app.status === 'soon'
  const inner = el(soon ? 'span' : 'a', 'idx-card__link')
  if (!soon) inner.href = app.href
  if (soon) li.classList.add('idx-card--soon')

  inner.appendChild(el('span', 'idx-card__num', String(i + 1).padStart(2, '0')))
  inner.appendChild(el('span', 'idx-card__title', app.name))

  if (app.access === 'premium') inner.appendChild(el('span', 'idx-card__tag', 'Premium'))

  if (soon) {
    inner.appendChild(el('span', 'idx-card__tag idx-card__tag--soon', 'Soon'))
  } else {
    const arrow = el('span', 'idx-card__arrow', '→')
    arrow.setAttribute('aria-hidden', 'true')
    inner.appendChild(arrow)
  }

  li.appendChild(inner)
  return li
}

// Guards against a slow fetch for an abandoned section overwriting the one now on screen.
let renderToken = 0

async function render() {
  const token = ++renderToken
  if (!catalog) CATALOG.replaceChildren(el('li', 'idx__empty', 'Loading…'))

  const data = await load()
  if (token !== renderToken) return

  if (!data) {
    NAV.replaceChildren()
    CATALOG.replaceChildren(el('li', 'idx__empty', 'Catalog unavailable.'))
    return
  }

  const wanted = location.hash.replace(/^#\/?/, '')
  const kind = data.kinds.find((k) => k.id === wanted) || data.kinds[0]
  if (!kind) {
    CATALOG.replaceChildren(el('li', 'idx__empty', 'Nothing published yet.'))
    return
  }

  renderNav(data.kinds, kind.id)
  SUBJECT.textContent = kind.label
  document.title = `GraphL — ${kind.label.toLowerCase()}`

  const apps = data.apps.filter((a) => a.kind === kind.id)
  CATALOG.replaceChildren(
    ...(apps.length
      ? apps.map(card)
      : [el('li', 'idx__empty', `No ${kind.label.toLowerCase()} published yet.`)]),
  )
}

window.addEventListener('hashchange', render)
render()
