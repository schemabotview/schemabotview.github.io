# schemabotview.github.io → graphl.in

The public **catalog** for [GraphL](https://graphl.in): a static index that lists everything
published and links to its site, in two sections — **Courses** and **Labs**.

Live at **https://graphl.in**.

## How it works

A pure static site (no build). Everything the page shows comes from **one file, `catalog.json`** —
both the sections in the header nav and the cards under them:

```jsonc
{
  "kinds": [ { "id": "courses", "label": "Courses" }, { "id": "labs", "label": "Labs" }, … ],
  "apps":  [ { "slug": "python", "kind": "courses", "name": "Python" }, … ]
}
```

Listing a new site is **adding one object to `apps`**; a whole new *kind* of site adds one to
`kinds`. Nothing else changes. Optional per app: `subject` (groups `python` with `python-lab`),
`status` (`soon` shows a non-clickable card, `hidden` omits it), `access` (`premium` shows a pill).
Missing or unknown values degrade rather than breaking the page — `npm run check` is the strict
counterpart.

Every card links into that site's own app at `graphl.in/<slug>/`, where the slug is the repo name.
The index never fetches or lists courses/sections — each site owns its own navigation. All
same-origin under `graphl.in`, which is what will let a login session and a theme choice be shared
across every app.

The page is ordinary site chrome — a header with the logo and wordmark on the left, the section
nav on the right — and the nav items are plain `#courses` / `#labs` anchors. The card list starts
straight after: no visible heading, description or count, since the highlighted nav item and the
numbered cards already say all three. The `<h1>` is visually hidden, kept for structure.

The active section lives in the hash, so it is linkable and survives a reload. An unknown hash
falls back to Courses. A broken data file shows "Catalog unavailable." on that section only, and is
retried the next time it is opened.

## Files

```
CNAME            graphl.in   (the custom domain — do not delete)
.nojekyll        serve files as-is (no Jekyll)
index.html       site header (brand + nav + theme button) + catalog mount
styles.css       light + dark theme tokens (matches the concept apps)
theme.js         three-state theme control (system / light / dark)
app.js           fetch the active section's file → render one card per entry
catalog.json     kinds (the nav) + apps (the cards)

package.json      no dependencies; scripts: `dev`, `check`
scripts/serve.mjs zero-dep local server that mimics GitHub Pages
scripts/check-catalog.mjs   validates catalog.json (`--links` checks graphl.in)
```

## Theme

Light, dark, or follow the OS — the button in the header cycles system → light → dark. The choice
is kept in `localStorage['graphl:theme']` and applied before first paint, so there is no flash of
the wrong background on load. Because every GraphL app is same-origin under `graphl.in`, that one
key is enough for a concept app to inherit the same choice.

## Run locally

```sh
npm run dev            # http://localhost:8000
PORT=3000 npm run dev  # another port
```

Still no build step — the server just serves this folder the way Pages does (directory
`index.html`, `/dir` → `/dir/` redirect, `404.html`, correct MIME types, and case-sensitive paths,
so a `Icon.svg`/`icon.svg` slip fails locally instead of only in production).

It also serves the **sister apps**, so the catalog's cards work locally exactly as on graphl.in:

```
/        → this folder            (on GitHub: the index repo, deployed from main)
/aws/    → ../aws/dist/           (on GitHub: the aws repo's CI-built dist)
```

Build the app first (`cd ../aws && npm run build`) — an unbuilt sibling tells you the command
rather than 404ing. Any `../<slug>/dist` is picked up automatically; `SISTERS=/path` changes where
to look.

## Add an entry to the catalog

1. Deploy the app so it serves at `graphl.in/<slug>/` (Vite/TS apps deploy via a GitHub Actions
   Pages workflow in their own repo — see `aws-content`). To list it before then, add it with
   `"status": "soon"`.
2. Add one object to `apps` in `catalog.json`.
3. `npm run check` (add `-- --links` to verify it really serves on graphl.in), then push.

Its card appears in that tab, linking to `graphl.in/<slug>/`.

## Deploy

Static → **deploys from the `main` branch** (GitHub Pages, legacy build). Just push. Keep `CNAME`
and `.nojekyll`. See `CLAUDE.md` and the parent `../CLAUDE.md` for the wider architecture.
