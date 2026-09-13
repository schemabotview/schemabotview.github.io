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

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const FILE = resolve(ROOT, 'catalog.json')
const ORIGIN = process.env.ORIGIN || 'https://graphl.in'
const CHECK_LINKS = process.argv.includes('--links')

const SLUG = /^[a-z0-9][a-z0-9-]*$/
const STATUS = ['live', 'soon', 'hidden']
const ACCESS = ['free', 'premium']

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
