# CLAUDE.md — schemabotview.github.io (the GraphL catalog index)

This repo is the **catalog** for GraphL, served at the apex custom domain **https://graphl.in**. It
lists every concept and its courses and links into the concept apps. It is a **pure static site** —
no framework, no build.

> Parent context: `../CLAUDE.md` (workspace + domain model + the index/engine/concept-app layering).

## What it does

`app.js` (vanilla ES module) renders **two sections** into one panel, selected from the site
header's nav:

- **Courses** → `concepts.json` — the concept apps (narrated diagram courses).
- **Labs** → `labs.json` — the hands-on counterparts. A lab is `<concept>-lab` and pairs with the
  concept app of the same name (`python-lab` ↔ `python`; `aws-lab` ↔ `aws`).

Both files are flat `[{ slug, name }]`. Each card links at that site's own app (`/<slug>/`). The
index does **not** fetch or list courses/sections: each site owns its own navigation. Everything is
**same-origin under `graphl.in`**.

Layout is conventional site chrome: a header with the logo + wordmark on the left and the section
nav on the right, then the card list — nothing between them. **The page body carries no visible
heading, description or count by design.** The nav's current item is the visible "you are here" and
the cards are numbered, so anything in that slot restates what is already on screen; the `<h1>` is
`sr-only`, kept for structure. `data-title` on each nav link supplies it and `document.title`. The nav items are **plain anchors** to
`#courses` / `#labs`, so activation, keyboard, middle-click and copy-link are the browser's job —
`app.js` only sets `aria-current="page"` and renders the matching list.

The active section is in the hash — linkable, survives reload, unknown hash falls back to Courses;
`document.title` follows it. Successful lists are cached in memory; **failures are not**, so a
transient error retries when the section is next opened rather than sticking until a reload.

## Files (all served as-is)

```
CNAME         graphl.in   ← the custom domain. DO NOT DELETE (removing it breaks the domain).
.nojekyll     disable Jekyll (serve files verbatim)
index.html    site header (logo + wordmark + Courses/Labs nav) + <ol id="catalog"> panel
styles.css    dark theme, matches the concept apps (.site* header, .idx* page + cards)
app.js        fetch the active section's file → render one link card per entry (→ /<slug>/)
concepts.json Courses — the concept list
labs.json     Labs — the lab list
```

Not part of the published site, only the local workflow:

```
package.json      no dependencies — `npm install` is a no-op. One script: `dev`.
scripts/serve.mjs zero-dep node:http server that mimics GitHub Pages (see below)
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

Sister apps are *not* served: a catalog card points at `/<slug>/`, which only exists on graphl.in
or if you run that concept app yourself. Locally those links 404 — expected.

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

Courses go in `concepts.json`, labs in `labs.json`. Otherwise the steps are the same.

1. The app must be **deployed** (serving `graphl.in/<slug>/`). Vite/TS concept apps deploy
   via a GitHub Actions Pages workflow in their own repo (build → deploy `dist/`); see
   `aws-content`'s `.github/workflows/deploy.yml` for the reference. The apex custom domain is
   inherited from this repo's `CNAME`, so a project repo published under the org serves at
   `graphl.in/<repo>/` — the repo name is the slug.
2. Add `{ "slug": "<slug>", "name": "<Name>" }` to the right file; push. Its card appears in that
   tab, linking to `graphl.in/<slug>/`.

## Notes

- **Currently listed:** `aws`, `apache-spark`, `python`, `databricks-data-engineer`, `sql`, `linux`,
  `data-warehousing`, `python-lab` — every deployed app. `linux` joined on 2026-09-01: the
  `schemabotview/linux` repo's old graphl-studio app was replaced by the workspace concept app (8
  courses, 80 sections), Pages was switched to the workflow build source, and `graphl.in/linux/` went
  live before the card was added.
- **`python-lab` is a lab, not a concept app** (added 2026-09-09). Labs are the hands-on
  counterpart to a concept app of the same name — the family `aws-lab` started: `<concept>-lab`.
  A lab has no scenes, narration or course/section content, so it does not follow the per-repo
  anatomy in `../CLAUDE.md`. Repo: `schemabotview/python-lab`; it runs CPython in the browser via
  Pyodide and routes on `#/` like the concept apps do.
- **`aws-lab` is not listed yet** — it exists as a repo but has no Pages deployment, and the rule
  above (deploy first) applies to labs too. It joins `labs.json` once `graphl.in/aws-lab/` serves.
- This repo previously held a **built SPA** (an older GraphL catalog); it was replaced by this static
  site on request. The old build is recoverable from git history if ever needed.
- Working agreement (inherited): one reviewed slice at a time; explain before writing.
