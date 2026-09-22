// Validate catalog.json. Zero dependencies, run before pushing:
//
//   npm run check           structure only — fast, offline
//   npm run check -- --links   also HEAD every entry on graphl.in
//
// app.js is deliberately forgiving at runtime (a bad entry degrades rather than blanking the
// page), which is right for the reader and useless for the author — a typo would just quietly
// render a card that 404s. This is the other half: the same file, judged strictly, so mistakes
// surface here instead of in production.
//
// --links is what turns "deploy the app before you list it" from a rule someone has to remember
// into one the repo enforces: a live entry whose URL does not answer 200 fails.

import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const FILE = resolve(ROOT, 'catalog.json')
const ICONS = resolve(ROOT, 'icons')
const ORIGIN = process.env.ORIGIN || 'https://graphl.in'
const CHECK_LINKS = process.argv.includes('--links')

const SLUG = /^[a-z0-9][a-z0-9-]*$/
const STATUS = ['live', 'soon', 'hidden']
const ACCESS = ['free', 'premium']
const HEX = /^#[0-9a-f]{6}$/i
const ICON_FILE = /^[a-z0-9][a-z0-9-]*\.svg$/

// The card clamps a blurb to two lines. Past roughly this length the tail is invisible on a
// laptop and the author never finds out, so the cap is an error rather than a warning.
const BLURB_MAX = 90

// Files actually present in icons/. An `icon` naming a file that is not there falls back to a
// monogram at runtime — correct for the reader, and exactly the silent near-miss this script
// exists to surface. Missing folder is fine: it just means no entry may name an icon yet.
let iconFiles = new Set()
try {
  iconFiles = new Set(await readdir(ICONS))
} catch { /* no icons/ yet */ }

const errors = []
const warnings = []
const err = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

let raw
try {
  raw = await readFile(FILE, 'utf8')
} catch {
  console.error(`catalog.json not found at ${FILE}`)
  process.exit(1)
}

let data
try {
  data = JSON.parse(raw)
} catch (e) {
  console.error(`catalog.json is not valid JSON: ${e.message}`)
  process.exit(1)
}

// ---- kinds ----------------------------------------------------------------
const kinds = data.kinds
if (!Array.isArray(kinds) || kinds.length === 0) err('`kinds` must be a non-empty array')

const kindIds = new Set()
for (const [i, k] of (kinds ?? []).entries()) {
  const at = `kinds[${i}]`
  if (!k || typeof k !== 'object') { err(`${at} is not an object`); continue }
  if (typeof k.id !== 'string' || !SLUG.test(k.id)) err(`${at}.id ${JSON.stringify(k.id)} must match ${SLUG}`)
  else if (kindIds.has(k.id)) err(`${at}.id "${k.id}" is a duplicate`)
  else kindIds.add(k.id)
  if (k.label != null && typeof k.label !== 'string') err(`${at}.label must be a string`)
  // The id IS the URL hash; a rename silently breaks every link people have saved.
  if (k.id === 'course' || k.id === 'lab') warn(`kinds[${i}].id "${k.id}" is singular — #courses and #labs are the published URLs`)
}

// ---- groups ---------------------------------------------------------------
// The second axis. `kinds` is delivery format and is the header nav; `groups` is subject domain
// and is a heading inside one kind's panel. Optional entirely — a catalog with no groups renders
// the flat grid it always did.
const groups = data.groups
const groupIds = new Set()
if (groups != null) {
  if (!Array.isArray(groups)) err('`groups` must be an array')
  else
    for (const [i, g] of groups.entries()) {
      const at = `groups[${i}]`
      if (!g || typeof g !== 'object') { err(`${at} is not an object`); continue }
      if (typeof g.id !== 'string' || !SLUG.test(g.id)) err(`${at}.id ${JSON.stringify(g.id)} must match ${SLUG}`)
      else if (groupIds.has(g.id)) err(`${at}.id "${g.id}" is a duplicate`)
      else groupIds.add(g.id)
      if (g.label != null && typeof g.label !== 'string') err(`${at}.label must be a string`)
    }
}

// ---- apps -----------------------------------------------------------------
const apps = data.apps
if (!Array.isArray(apps)) err('`apps` must be an array')

const slugs = new Set()
const live = []
for (const [i, a] of (apps ?? []).entries()) {
  const at = `apps[${i}]${a?.slug ? ` (${a.slug})` : ''}`
  if (!a || typeof a !== 'object') { err(`${at} is not an object`); continue }

  if (typeof a.slug !== 'string' || !SLUG.test(a.slug)) err(`${at}.slug must match ${SLUG}`)
  else if (slugs.has(a.slug)) err(`${at}.slug "${a.slug}" is a duplicate`)
  else slugs.add(a.slug)

  if (a.name != null && typeof a.name !== 'string') err(`${at}.name must be a string`)
  if (!a.name) warn(`${at} has no name — the card will show the slug`)

  if (a.kind == null) err(`${at}.kind is missing`)
  else if (!kindIds.has(a.kind)) warn(`${at}.kind "${a.kind}" is not declared in kinds — a tab will be auto-appended`)

  // A group is optional per app, but within a kind it is all-or-nothing in practice: one app
  // without a group in an otherwise grouped panel lands under a trailing "More" heading, which is
  // nearly always a forgotten field rather than an intent. Hence the warning below.
  if (a.group != null) {
    if (typeof a.group !== 'string') err(`${at}.group must be a string`)
    else if (!groupIds.has(a.group)) warn(`${at}.group "${a.group}" is not declared in groups — a heading will be auto-appended`)
  }

  // The one sentence under the title. Optional — without it the card is a bare title row, which
  // is what every card was before blurbs existed.
  if (a.blurb != null) {
    if (typeof a.blurb !== 'string') err(`${at}.blurb must be a string`)
    else if (a.blurb.length > BLURB_MAX) err(`${at}.blurb is ${a.blurb.length} chars — the card clamps at two lines, keep it under ${BLURB_MAX}`)
    else if (!a.blurb.trim()) err(`${at}.blurb is empty — omit the field instead`)
  } else warn(`${at} has no blurb — the card will show a bare title`)

  // The app's own --brand, copied here so the card and the site it opens agree. Absent ⇒ the
  // platform accent, which is right for an app that has no brand of its own yet.
  if (a.tint != null && (typeof a.tint !== 'string' || !HEX.test(a.tint))) err(`${at}.tint must be a 6-digit hex colour like "#4b8bbe"`)

  // A filename inside icons/, not a path — the folder is the whole namespace. `icon` is a vendor's
  // published logo rendered in an <img>; `glyph` is one of ours, painted through a CSS mask. An
  // app has at most one: they fill the same square, and `icon` would simply win.
  if (a.icon != null) {
    if (typeof a.icon !== 'string' || !ICON_FILE.test(a.icon)) err(`${at}.icon must be a filename like "python.svg" inside icons/`)
    else if (!iconFiles.has(a.icon)) err(`${at}.icon "${a.icon}" is not in icons/ — the card would silently fall back to a monogram`)
  }

  // A missing glyph file is stricter than a missing icon: an <img> falls back to the monogram at
  // runtime, but a mask with nothing to mask paints an empty square. This check is the only guard.
  if (a.glyph != null) {
    if (typeof a.glyph !== 'string' || !ICON_FILE.test(a.glyph)) err(`${at}.glyph must be a filename like "sql.svg" inside icons/`)
    else if (!iconFiles.has(a.glyph)) err(`${at}.glyph "${a.glyph}" is not in icons/ — the tile would render empty, with no monogram to fall back to`)
    if (a.icon != null) err(`${at} sets both icon and glyph — the tile holds one mark, and icon would win`)
  }

  if (a.status != null && !STATUS.includes(a.status)) err(`${at}.status "${a.status}" must be one of ${STATUS.join(' | ')}`)
  if (a.access != null && !ACCESS.includes(a.access)) err(`${at}.access "${a.access}" must be one of ${ACCESS.join(' | ')}`)

  // Everything belongs on the apex path so the whole platform stays one origin (shared auth
  // session, shared theme). href exists as an escape hatch, and should stay unused.
  if (a.href != null) {
    if (typeof a.href !== 'string') err(`${at}.href must be a string`)
    else warn(`${at}.href is set — that app leaves the graphl.in origin and loses the shared session`)
  }

  const status = a.status ?? 'live'
  if (status === 'live' && typeof a.slug === 'string') live.push(a)
}

// A group nobody is in renders nothing. Harmless, but it is usually a slug that got renamed on
// one side only — or an aspirational heading (AI/ML) that should wait for its first course.
for (const id of groupIds) {
  if (!(apps ?? []).some((a) => a?.group === id)) warn(`groups "${id}" has no apps — it will not render`)
}

// Mixing grouped and ungrouped apps inside one kind is legal and degrades cleanly, but it is far
// more often a missing field than a decision.
for (const id of kindIds) {
  const mine = (apps ?? []).filter((a) => a?.kind === id)
  const grouped = mine.filter((a) => a?.group)
  if (grouped.length && grouped.length !== mine.length) {
    const bare = mine.filter((a) => !a?.group).map((a) => a.slug).join(', ')
    warn(`kind "${id}" is grouped but ${bare} has no group — it will fall under a trailing "More" heading`)
  }
}

// ---- links ----------------------------------------------------------------
if (CHECK_LINKS && errors.length === 0) {
  console.log(`checking ${live.length} live entries against ${ORIGIN} …`)
  await Promise.all(
    live.map(async (a) => {
      const url = a.href ?? `${ORIGIN}/${a.slug}/`
      try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
        if (!res.ok) err(`${a.slug} is listed live but ${url} → ${res.status}`)
      } catch (e) {
        err(`${a.slug}: ${url} → ${e.message}`)
      }
    }),
  )

  // The reverse check: something marked "soon" that is actually serving is just out of date.
  await Promise.all(
    (apps ?? [])
      .filter((a) => a?.status === 'soon' && typeof a.slug === 'string')
      .map(async (a) => {
        const url = a.href ?? `${ORIGIN}/${a.slug}/`
        try {
          const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
          if (res.ok) warn(`${a.slug} is marked "soon" but ${url} is live — promote it`)
        } catch { /* expected */ }
      }),
  )
}

// ---- report ---------------------------------------------------------------
for (const w of warnings) console.warn(`warn  ${w}`)
for (const e of errors) console.error(`ERROR ${e}`)

const counts = [...kindIds].map((id) => `${(apps ?? []).filter((a) => a?.kind === id).length} ${id}`).join(', ')
console.log(
  errors.length
    ? `\ncatalog.json: ${errors.length} error(s), ${warnings.length} warning(s)`
    : `\ncatalog.json OK — ${counts}${warnings.length ? ` (${warnings.length} warning(s))` : ''}`,
)
process.exit(errors.length ? 1 : 0)
