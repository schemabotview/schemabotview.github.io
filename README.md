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

The active section lives in the hash (`#courses` / `#labs`), so a tab is linkable and survives a
reload. An unknown hash falls back to Courses. A broken data file shows "Catalog unavailable." on
that tab only, and is retried the next time the tab is opened.

## Files

```
CNAME            graphl.in   (the custom domain — do not delete)
.nojekyll        serve files as-is (no Jekyll)
index.html       hero + Courses/Labs tablist + catalog mount
styles.css       dark theme (matches the concept apps)
app.js           fetch the active section's file → render one card per entry
concepts.json    Courses: [ { "slug": "apache-spark", "name": "Apache Spark" }, … ]
labs.json        Labs:    [ { "slug": "python-lab", "name": "Python Lab" }, … ]
```

## Add an entry to the catalog

1. Deploy the app so it serves at `graphl.in/<slug>/` (Vite/TS apps deploy via a GitHub Actions
   Pages workflow in their own repo — see `aws-content`).
2. Add `{ "slug": "<slug>", "name": "<Name>" }` to `concepts.json` (a course) or `labs.json` (a
   lab), and push.

Its card appears in that tab, linking to `graphl.in/<slug>/`.

## Deploy

Static → **deploys from the `main` branch** (GitHub Pages, legacy build). Just push. Keep `CNAME`
and `.nojekyll`. See `CLAUDE.md` and the parent `../CLAUDE.md` for the wider architecture.
