# schemabotview.github.io → graphl.in

The public **catalog** for [GraphL](https://graphl.in): a static index that lists every concept and
links to its site.

Live at **https://graphl.in**.

## How it works

A pure static site (no build). On load, `app.js` fetches `concepts.json` — the list of published
concepts — and renders a gallery of links, one card per concept, pointing at that concept's own site
(`graphl.in/<slug>/`). The index doesn't fetch or list courses; each concept site owns its own
course navigation. All same-origin under `graphl.in`.

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

1. Deploy the concept app so it serves at `graphl.in/<slug>/` (Vite/TS apps deploy via a GitHub
   Actions Pages workflow in their own repo — see `aws-content`).
2. Add `{ "slug": "<slug>", "name": "<Name>" }` to `concepts.json` and push.

Its card appears in the gallery, linking to `graphl.in/<slug>/`.

## Deploy

Static → **deploys from the `main` branch** (GitHub Pages, legacy build). Just push. Keep `CNAME`
and `.nojekyll`. See `CLAUDE.md` and the parent `../CLAUDE.md` for the wider architecture.
