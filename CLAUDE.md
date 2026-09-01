# CLAUDE.md — schemabotview.github.io (the GraphL catalog index)

This repo is the **catalog** for GraphL, served at the apex custom domain **https://graphl.in**. It
lists every concept and its courses and links into the concept apps. It is a **pure static site** —
no framework, no build.

> Parent context: `../CLAUDE.md` (workspace + domain model + the index/engine/concept-app layering).

## What it does

`app.js` (vanilla ES module) on load fetches `concepts.json` — the concepts to show
(`[{ slug, name }]`) — and renders a gallery of links, one card per concept, pointing at that
concept's own site (`/<slug>/`). The index does **not** fetch or list courses/sections: each concept
site owns its own course navigation. Everything is **same-origin under `graphl.in`** (the index and
every concept site share the apex domain).

## Files (all served as-is)

```
CNAME         graphl.in   ← the custom domain. DO NOT DELETE (removing it breaks the domain).
.nojekyll     disable Jekyll (serve files verbatim)
index.html    hero + <main id="catalog">
styles.css    dark theme, matches the concept apps
app.js        fetch concepts.json → render one link card per concept (→ /<slug>/)
concepts.json the concept list
```

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

## Add a concept to the catalog

1. The concept app must be **deployed** (serving `graphl.in/<slug>/`). Vite/TS concept apps deploy
   via a GitHub Actions Pages workflow in their own repo (build → deploy `dist/`); see
   `aws-content`'s `.github/workflows/deploy.yml` for the reference. The apex custom domain is
   inherited from this repo's `CNAME`, so a project repo published under the org serves at
   `graphl.in/<repo>/` — the repo name is the slug.
2. Add `{ "slug": "<slug>", "name": "<Name>" }` to `concepts.json`; push. Its card appears in the
   gallery, linking to `graphl.in/<slug>/`.

## Notes

- **Currently listed:** `aws`, `apache-spark`, `python`, `databricks-data-engineer`, `sql` — the
  deployed apps. `linux` is still intentionally **omitted**: it is a docs-only stub in the workspace,
  and listing an undeployed slug would link the card to a `graphl.in/<slug>/` 404.
- This repo previously held a **built SPA** (an older GraphL catalog); it was replaced by this static
  site on request. The old build is recoverable from git history if ever needed.
- Working agreement (inherited): one reviewed slice at a time; explain before writing.
