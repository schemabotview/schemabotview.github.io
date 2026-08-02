# schemabotview.github.io → graphl.in

The public **catalog** for [GraphL](https://graphl.in): a static index that lists every concept and
its courses, linking to each course in its concept app.

Live at **https://graphl.in**.

## How it works

A pure static site (no build). On load, `app.js`:

1. fetches `concepts.json` — the list of published concepts,
2. fetches each concept's `courses.json` (served by that concept app at `graphl.in/<slug>/courses.json`),
3. renders a gallery, linking each course to `graphl.in/<slug>/#/<courseId>`.

All same-origin under `graphl.in`, so no CORS.

## Files

```
CNAME            graphl.in   (the custom domain — do not delete)
.nojekyll        serve files as-is (no Jekyll)
index.html       hero + catalog mount
styles.css       dark theme (matches the concept apps)
app.js           fetch concepts.json + courses.json → render
concepts.json    [ { "slug": "apache-spark", "name": "Apache Spark" }, … ]
```

## Add a concept to the catalog

1. Deploy the concept app (it publishes `courses.json` at `graphl.in/<slug>/`).
2. Add `{ "slug": "<slug>", "name": "<Name>" }` to `concepts.json` and push.

Its courses appear automatically (fetched at load).

## Deploy

Static → **deploys from the `main` branch** (GitHub Pages, legacy build). Just push. Keep `CNAME`
and `.nojekyll`. See `CLAUDE.md` and the parent `../CLAUDE.md` for the wider architecture.
