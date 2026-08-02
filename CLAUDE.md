# CLAUDE.md — schemabotview.github.io (the GraphL catalog index)

This repo is the **catalog** for GraphL, served at the apex custom domain **https://graphl.in**. It
lists every concept and its courses and links into the concept apps. It is a **pure static site** —
no framework, no build.

> Parent context: `../CLAUDE.md` (workspace + domain model + the index/engine/concept-app layering).

## What it does

`app.js` (vanilla ES module) on load:
1. fetches `concepts.json` — the concepts to show (`[{ slug, name }]`),
2. fetches each concept's **`courses.json`** at `/<slug>/courses.json` (published by that concept
   app's build), shape `{ concept, courses: [{ id, title, sections }] }`,
3. renders a gallery; each course links to `/<slug>/#/<courseId>`.

Everything is **same-origin under `graphl.in`** (the index and every concept app share the apex
domain), so the `courses.json` fetches need no CORS.

## Files (all served as-is)

```
CNAME         graphl.in   ← the custom domain. DO NOT DELETE (removing it breaks the domain).
.nojekyll     disable Jekyll (serve files verbatim)
index.html    hero + <main id="catalog">
styles.css    dark theme, matches the concept apps
app.js        fetch concepts.json + courses.json → render cards
concepts.json the concept list
```

## Deploy

- **Deploy-from-branch** (GitHub Pages, legacy build source = `main`). Push to `main` → it publishes.
  No Actions, no build step — it's static (contrast the concept apps, which are Vite/TS and build via
  Actions).
- Preserve `CNAME` and `.nojekyll` on every change.

## Add a concept to the catalog

1. The concept app must be **deployed** (serving `graphl.in/<slug>/`) and publishing `courses.json`.
2. Add `{ "slug": "<slug>", "name": "<Name>" }` to `concepts.json`; push. Its courses appear
   automatically — the index does not hard-code course lists (only the concept slugs).

## Notes

- This repo previously held a **built SPA** (an older GraphL catalog); it was replaced by this static
  site on request. The old build is recoverable from git history if ever needed.
- Working agreement (inherited): one reviewed slice at a time; explain before writing.
