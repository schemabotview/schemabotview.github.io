# schemabotview.github.io → graphl.in

The public **catalog** for [GraphL](https://graphl.in): a static index that lists everything
published and links to its site, in two sections — **Courses** and **Labs**.

Live at **https://graphl.in**.

## How it works

A pure static site (no build). `app.js` renders one of two lists into the same panel:

- **Courses** — `concepts.json`, the narrated diagram courses (the concept apps).
- **Labs** — `labs.json`, their hands-on counterparts (`python-lab` pairs with `python`).

Both are flat `[{ slug, name }]` files, and every card links into that site's own app at
`graphl.in/<slug>/`. The index never fetches or lists courses/sections — each site owns its own
navigation. All same-origin under `graphl.in`.

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
index.html       site header (logo + wordmark + Courses/Labs nav) + catalog mount
styles.css       dark theme (matches the concept apps)
app.js           fetch the active section's file → render one card per entry
concepts.json    Courses: [ { "slug": "apache-spark", "name": "Apache Spark" }, … ]
labs.json        Labs:    [ { "slug": "python-lab", "name": "Python Lab" }, … ]

package.json      no dependencies; one script (`dev`)
scripts/serve.mjs zero-dep local server that mimics GitHub Pages
```

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
   Pages workflow in their own repo — see `aws-content`).
2. Add `{ "slug": "<slug>", "name": "<Name>" }` to `concepts.json` (a course) or `labs.json` (a
   lab), and push.

Its card appears in that tab, linking to `graphl.in/<slug>/`.

## Deploy

Static → **deploys from the `main` branch** (GitHub Pages, legacy build). Just push. Keep `CNAME`
and `.nojekyll`. See `CLAUDE.md` and the parent `../CLAUDE.md` for the wider architecture.
