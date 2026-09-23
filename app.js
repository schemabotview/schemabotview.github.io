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
// Two axes, deliberately kept apart. `kinds` is DELIVERY FORMAT (courses / labs / coaching) and is
// the header nav. `groups` is SUBJECT DOMAIN (languages / data / systems) and is a heading inside
// one kind's panel. They could not swap places: kind ids are public URLs, and a topic row in the
// nav beside "Labs" would be asking the reader to hold two questions at once.
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
      group: str(a.group),
      status: a.status === 'soon' ? 'soon' : 'live',
      access: a.access === 'premium' ? 'premium' : 'free',
      href: a.href || `${a.slug}/`,
      blurb: str(a.blurb),
      // Rejected rather than passed through: `tint` lands in an inline custom property and `icon`
      // in a URL, so a malformed value has to become "no value", not "odd value".
      tint: HEX.test(str(a.tint)) ? a.tint.trim() : '',
      icon: ICON_FILE.test(str(a.icon)) ? a.icon.trim() : '',
      glyph: ICON_FILE.test(str(a.glyph)) ? a.glyph.trim() : '',
    }))

  const declared = new Set(kinds.map((k) => k.id))
  for (const app of apps) {
    if (declared.has(app.kind)) continue
    declared.add(app.kind)
    kinds.push({ id: app.kind, label: title(app.kind) })
  }

  // Groups are optional in full: no `groups` array, or a kind whose apps declare none, renders the
  // flat grid the page had before topics existed. Same degradation rule as kinds — an app naming a
  // group nobody declared gets a heading appended rather than being dropped.
  const groups = (Array.isArray(data?.groups) ? data.groups : [])
    .filter((g) => g && typeof g.id === 'string')
    .map((g) => ({ id: g.id, label: g.label || title(g.id) }))

  const knownGroups = new Set(groups.map((g) => g.id))
  for (const app of apps) {
    if (!app.group || knownGroups.has(app.group)) continue
    knownGroups.add(app.group)
    groups.push({ id: app.group, label: title(app.group) })
  }

  return { kinds, groups, apps }
}

const title = (id) => id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const HEX = /^#[0-9a-f]{6}$/i
const ICON_FILE = /^[a-z0-9][a-z0-9-]*\.svg$/

// The letterform shown when an app has no logo file yet. Derived from `subject` rather than
// `name`, because the subject is the short form: "Databricks Data Engineer" is named for the
// certification but subjects as "Databricks" → "Da", where the name would give "DD".
//
// Acronyms stay whole (AWS, SQL), two words give their initials (Data Warehousing → DW), one word
// gives its first two letters (Python → Py). Digit-only tokens are dropped first so "1:1
// Coaching" reads "Co" and not "1C".
function monogram(subject) {
  const words = subject.split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean)
  const letters = words.filter((w) => /[A-Za-z]/.test(w))
  const parts = letters.length ? letters : words
  if (!parts.length) return '?'
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  const one = parts[0]
  return one.length <= 3 ? one.toUpperCase() : one[0].toUpperCase() + one[1].toLowerCase()
}

// The square left of the title, in three tiers on the same tinted ground: the vendor's own logo
// when `icon` names a file in icons/, else our house glyph when `glyph` does, else a monogram. A
// concept with no mark yet is a different tile rather than a broken one — which is what lets
// marks land one at a time.
//
// The two file tiers render differently on purpose. A vendor logo is published art and goes in an
// <img> exactly as it came, colours and all. A house glyph is ours and carries no colour at all:
// it is painted through CSS `mask`, which hands it the very `--tint-ink` the monogram uses, so it
// inherits the light-theme darkening the pale brands (SQL's cyan, Linux's yellow) need. An <img>
// could not read a custom property, and a hard-coded colour would fail one theme or the other.
function tile(app) {
  const box = el('span', 'idx-card__icon')
  const mono = () => el('span', 'idx-card__mono', monogram(app.subject))

  if (!app.icon) {
    if (app.glyph) {
      const span = el('span', 'idx-card__glyph')
      span.style.setProperty('--glyph', `url(icons/${app.glyph})`)
      box.appendChild(span)
      return box
    }
    box.appendChild(mono())
    return box
  }

  const img = el('img', 'idx-card__logo')
  img.src = `icons/${app.icon}`
  img.alt = '' // the title beside it already names the app
  img.width = 32
  img.height = 32
  img.loading = 'lazy'
  // A file that was deleted or never committed must not leave a blank square. `npm run check`
  // catches this before a push; this catches it for a reader on the deployed site.
  img.addEventListener('error', () => img.replaceWith(mono()), { once: true })
  box.appendChild(img)
  return box
}

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

// A card linking into the site's own app (graphl.in/<slug>/): logo tile · title + pills. That is
// the whole card — the blurb and the arrow were both taken out when the catalog outgrew one
// screen, because the reader's first question here is "what is published?", which is answered by
// seeing every concept at once and not by reading twelve sentences.
//
// The tile carries that app's own brand colour, copied into the catalog as `tint`, so the card and
// the site it opens agree; without one it falls back to the platform accent. Everything downstream
// of the tint reads the `--tint` custom property, which is the only thing set inline.
//
// The blurb is still authored, still checked, and still here — as the link's `title`, so a reader
// who wants the sentence can hover for it. That is deliberately a mouse-only affordance: the
// sentence is a nicety, the name and the mark are the content.
//
// A "soon" app is deliberately not a link: it has no deploy yet, and a card that 404s is worse
// than one that says it is coming.
function card(app) {
  const li = el('li', 'idx-card')
  const soon = app.status === 'soon'
  const inner = el(soon ? 'span' : 'a', 'idx-card__link')
  if (!soon) inner.href = app.href
  if (soon) li.classList.add('idx-card--soon')
  if (app.tint) li.style.setProperty('--tint', app.tint)
  if (app.blurb) inner.title = app.blurb

  inner.appendChild(tile(app))

  const head = el('span', 'idx-card__head')
  head.appendChild(el('span', 'idx-card__title', app.name))
  if (app.access === 'premium') head.appendChild(el('span', 'idx-card__tag', 'Premium'))
  if (soon) head.appendChild(el('span', 'idx-card__tag idx-card__tag--soon', 'Soon'))
  inner.appendChild(head)

  li.appendChild(inner)
  return li
}

// One grid of cards. Used both on its own (an ungrouped kind) and inside each group section.
function grid(apps) {
  const ol = el('ol', 'idx__grid')
  ol.append(...apps.map(card))
  return ol
}

// The active kind's panel: either a flat grid, or one <section> per subject group in the order the
// catalog declares them. The heading is a real <h2> under the sr-only <h1>, so the page has the
// outline it looks like it has.
//
// Grouping is per kind, decided by the apps themselves: a kind where nobody declares a group is
// flat, which is what Labs and Coach are with one card each. Mixing the two inside one kind is
// legal — the stragglers collect under a trailing "More" — but `npm run check` warns, because it
// is nearly always a forgotten field rather than a decision.
function panel(groups, apps) {
  if (!apps.some((a) => a.group)) return [grid(apps)]

  const buckets = groups
    .map((g) => ({ label: g.label, apps: apps.filter((a) => a.group === g.id) }))
    .filter((b) => b.apps.length)

  const rest = apps.filter((a) => !a.group)
  if (rest.length) buckets.push({ label: 'More', apps: rest })

  return buckets.map((b) => {
    const section = el('section', 'idx__group')
    section.appendChild(el('h2', 'idx__group-label', b.label))
    section.appendChild(grid(b.apps))
    return section
  })
}

// Guards against a slow fetch for an abandoned section overwriting the one now on screen.
let renderToken = 0

async function render() {
  const token = ++renderToken
  if (!catalog) CATALOG.replaceChildren(el('p', 'idx__empty', 'Loading…'))

  const data = await load()
  if (token !== renderToken) return

  if (!data) {
    NAV.replaceChildren()
    CATALOG.replaceChildren(el('p', 'idx__empty', 'Catalog unavailable.'))
    return
  }

  const wanted = location.hash.replace(/^#\/?/, '')
  const kind = data.kinds.find((k) => k.id === wanted) || data.kinds[0]
  if (!kind) {
    CATALOG.replaceChildren(el('p', 'idx__empty', 'Nothing published yet.'))
    return
  }

  renderNav(data.kinds, kind.id)
  SUBJECT.textContent = kind.label
  document.title = `GraphL — ${kind.label.toLowerCase()}`

  const apps = data.apps.filter((a) => a.kind === kind.id)
  CATALOG.replaceChildren(
    ...(apps.length
      ? panel(data.groups, apps)
      : [el('p', 'idx__empty', `No ${kind.label.toLowerCase()} published yet.`)]),
  )
}

window.addEventListener('hashchange', render)
render()
