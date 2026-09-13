# CLAUDE.md — schemabotview.github.io (the GraphL catalog index)

This repo is the **catalog** for GraphL, served at the apex custom domain **https://graphl.in**. It
lists every concept and its courses and links into the concept apps. It is a **pure static site** —
no framework, no build.

> Parent context: `../CLAUDE.md` (workspace + domain model + the index/engine/concept-app layering).

## What it does

`app.js` (vanilla ES module) renders one section into one panel, selected from the site header's
nav. **Everything the site lists comes from one file, `catalog.json`** — the sections themselves
(`kinds`) as well as the published sites under them (`apps`):

```jsonc
{
  "kinds": [ { "id": "courses", "label": "Courses" }, … ],
  "apps":  [ { "slug": "python", "kind": "courses", "name": "Python", "subject": "Python" }, … ]
}
```

Adding a sister repo is **adding one object to `apps`** — no edit to `app.js`, none to
`index.html`. That is the whole point of the file: the kinds of app GraphL publishes will keep
growing (courses, labs, coaching, …) and the index must absorb a new one as data.

Every field but `slug` is optional:

| field | default | what it does |
|---|---|---|
| `slug` | — | required, unique. The link is `/<slug>/`, and the slug **is the repo name**. |
| `kind` | first kind | which tab. An undeclared kind gets a tab appended rather than vanishing. |
| `name` | the slug | card title |
| `subject` | the name | groups an app with its siblings (`python` + `python-lab` → Python) |
| `status` | `live` | `soon` renders a non-clickable card; `hidden` omits it entirely |
| `access` | `free` | `premium` renders a pill. **UI only** — a Pages file is world-readable. |
| `href` | `/<slug>/` | escape hatch for an app off Pages. Should stay unused (see below). |

**Unknown or missing values degrade, they never break the page.** The catalog is hand-edited, so
the failure mode for a typo has to be "slightly wrong", never "blank page". `npm run check` is the
strict counterpart — see *Add an entry*.

Each card links at that site's own app (`/<slug>/`). The index does **not** fetch or list
courses/sections: each site owns its own navigation.

### Theme

Three states: **system** (no stored value — the OS decides via `prefers-color-scheme`) plus
explicit **light** and **dark**, which override the OS in both directions. The header button cycles
system → light → dark.

- The switch is `data-theme="light" | "dark"` on `<html>`; **system means no attribute at all**.
- The choice is `localStorage['graphl:theme']`; choosing system **removes** the key.
- `index.html` carries a tiny **blocking inline script** in `<head>` that applies a stored choice
  before first paint. It cannot be a module or deferred — the page would flash the wrong ground on
  every load. Keep it inline and keep it first.
- Colours are all tokens on `:root`. The dark palette is written **twice** on purpose (once under
  `prefers-color-scheme`, once under `[data-theme='dark']`): plain CSS cannot share one block
  between a media query and an attribute selector, and `light-dark()` renders an unreadable page on
  a browser that lacks it.
- `theme.js` adds `.theme-swap` for the frame the change lands in, which kills transitions so the
  whole page changes at once instead of the ground flipping while hover transitions cross-fade.

**The key and the attribute are platform-wide contracts, not private to this page.** Every app is
same-origin under `graphl.in`, so a concept app that reads the same key and honours the same
attribute inherits the reader's choice with nothing passed between them. Do not rename either.

### One origin is load-bearing

Everything is **same-origin under `graphl.in`** — the org Pages site owns `/`, each project repo
owns `/<repo>/`. That is not just tidy: a single origin is what will let a Firebase auth session
and a theme choice be shared by every app for free, with no token passing. Putting an app on a
subdomain would break both. `href` exists for that case and should stay unused; `npm run check`
warns when it is set.

Layout is conventional site chrome: a header with the logo + wordmark on the left and the section
nav on the right, then the card list — nothing between them. **The page body carries no visible
heading, description or count by design.** The nav's current item is the visible "you are here" and
the cards are numbered, so anything in that slot restates what is already on screen; the `<h1>` is
`sr-only`, kept for structure; the kind's `label` supplies it and `document.title`. The `<nav>` in
`index.html` is **empty** — `app.js` fills it from `kinds`. The links it writes are **plain
anchors** to `#<id>`, so activation, keyboard, middle-click and copy-link are the browser's job;
`app.js` only sets `aria-current="page"`.

The active section is in the hash — linkable, survives reload, unknown hash falls back to the first
kind. **Kind ids ARE the hash, which is why they read plural** (`courses`, not `course`): `#courses`
and `#labs` were public URLs before the catalog became data, and they still resolve. Renaming an id
breaks saved links, so `npm run check` warns on the singular forms.

The parsed catalog is held in memory; **a failure is not**, so a transient error retries on the next
hashchange rather than sticking until a reload.

## Files (all served as-is)

```
CNAME         graphl.in   ← the custom domain. DO NOT DELETE (removing it breaks the domain).
.nojekyll     disable Jekyll (serve files verbatim)
index.html    site header (brand + empty nav + theme button) + <ol id="catalog"> panel
              …plus the blocking inline theme boot in <head>
styles.css    light + dark tokens, matches the concept apps (.site* header, .idx* page + cards)
theme.js      the three-state theme control (system / light / dark)
app.js        fetch the active section's file → render one link card per entry (→ /<slug>/)
catalog.json  kinds (the nav) + apps (the cards) — the whole catalog, one file
```

Not part of the published site, only the local workflow:

```
package.json           no dependencies — `npm install` is a no-op. Scripts: `dev`, `check`.
scripts/serve.mjs      zero-dep node:http server that mimics GitHub Pages (see below)
scripts/check-catalog.mjs  validate catalog.json; `--links` HEADs every entry on graphl.in
```

## Run locally

```
npm run dev            # http://localhost:8000
PORT=3000 npm run dev  # another port
```

There is still **no build** — `scripts/serve.mjs` only serves this folder the way Pages serves it,
so "works locally" means "works on graphl.in". It reproduces: `/` → `index.html`, `/dir` → 301
`/dir/`, `/about` → `about.html`, `404.html` when present, real MIME types, no directory listings,
and **case-sensitive paths** — macOS would happily serve `Icon.svg` for `icon.svg` and Pages
(Linux) would 404, so a casing mismatch 404s here too and logs why.

### Sister apps are served too

A catalog card points at `/<slug>/`, which on graphl.in is a **different repo's Pages deploy** —
the org site owns `/`, each project repo owns `/<repo>/`, all inheriting this repo's `CNAME`.
Locally the same URL is answered from that sibling checkout's build:

```
/            → this folder, verbatim          (= index repo, deployed from main)
/aws/        → ../aws/dist/                   (= aws repo, CI-built dist artifact)
```

Those are the **same bytes Pages serves** — the concept apps set vite `base` to `/<slug>/` for the
build, so `dist/index.html` already asks for `/aws/assets/…`. Hence mounting `dist`, not proxying
`vite dev`: the dev server deliberately stays on base `/` at port 5173 so the record scripts work,
and every app shares that one port.

Sisters are **discovered, not listed** — any `../<slug>/dist` is mounted, so a new concept app needs
no change here. Build it and reload; a sibling without `dist` says so instead of 404ing blankly.
`SISTERS=/path` overrides the search directory. A real file or folder in this repo always wins, so
the catalog can never be shadowed.

The one asymmetry with production: CI runs `npm run build` on every push, locally you run it
yourself.

## Deploy

- **Deploy-from-branch** (GitHub Pages, legacy build source = `main`). Push to `main` → it publishes.
  No Actions, no build step — it's static (contrast the concept apps, which are Vite/TS and build via
  Actions).
- Preserve `CNAME` and `.nojekyll` on every change.

## Recording lives in the concept repos (not here)

This repo is **only** the catalog. Video recording is done **per concept**: each concept repo ships
its own `scripts/record-course.mjs` (+ `record-reels`, `thumb`, `gen-descriptions`), driving that
app's `window.__scene` surface from its bundled `src/render-engine`. There is no central recorder
here — a former `capture/` folder (a different `window.__capture` recorder) was removed; its curated
publish titles were split into each repo's `scripts/titles.json`.

## Add an entry to the catalog

1. The app must be **deployed** (serving `graphl.in/<slug>/`). Vite/TS concept apps deploy
   via a GitHub Actions Pages workflow in their own repo (build → deploy `dist/`); see
   `aws-content`'s `.github/workflows/deploy.yml` for the reference. The apex custom domain is
   inherited from this repo's `CNAME`, so a project repo published under the org serves at
   `graphl.in/<repo>/` — the repo name is the slug. To list it before it ships, add it with
   `"status": "soon"` and drop that field on the day it goes live.
2. Add one object to `apps` in `catalog.json`. A new **kind** of app also gets an entry in
   `kinds` — that is the only reason to touch anything else.
3. `npm run check` before pushing. `npm run check -- --links` additionally HEADs every live entry
   against graphl.in, which is what turns step 1 from a rule someone remembers into one the repo
   enforces — a live entry that does not answer 200 fails the check.

## Notes

- **Currently listed:** `aws`, `apache-spark`, `python`, `databricks-data-engineer`, `sql`, `linux`,
  `data-warehousing`, `python-lab` — every deployed app — plus `coach` as `status: "soon"`. `linux` joined on 2026-09-01: the
  `schemabotview/linux` repo's old graphl-studio app was replaced by the workspace concept app (8
  courses, 80 sections), Pages was switched to the workflow build source, and `graphl.in/linux/` went
  live before the card was added.
- **`python-lab` is a lab, not a concept app** (added 2026-09-09). Labs are the hands-on
  counterpart to a concept app of the same name — the family `aws-lab` started: `<concept>-lab`.
  A lab has no scenes, narration or course/section content, so it does not follow the per-repo
  anatomy in `../CLAUDE.md`. Repo: `schemabotview/python-lab`; it runs CPython in the browser via
  Pyodide and routes on `#/` like the concept apps do.
- **`aws-lab` is not listed yet** — it exists as a repo but has no Pages deployment, and the rule
  above (deploy first) applies to labs too. It joins `catalog.json` once `graphl.in/aws-lab/` serves.
- This repo previously held a **built SPA** (an older GraphL catalog); it was replaced by this static
  site on request. The old build is recoverable from git history if ever needed.
- Working agreement (inherited): one reviewed slice at a time; explain before writing.
