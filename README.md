# schemabotview.github.io → graphl.in

The public **catalog** for [GraphL](https://graphl.in): a static index that lists everything
published and links to its site, in two sections — **Courses** and **Labs**.

Live at **https://graphl.in**.

## How it works

A pure static site (no build). Everything the page shows comes from **one file, `catalog.json`** —
both the sections in the header nav and the cards under them:

```jsonc
{
  "kinds":  [ { "id": "courses", "label": "Courses" }, { "id": "labs", "label": "Labs" }, … ],
  "groups": [ { "id": "languages", "label": "Languages" }, { "id": "data", "label": "Data" }, … ],
  "apps":   [ { "slug": "python", "kind": "courses", "group": "languages", "name": "Python",
               "tint": "#4b8bbe", "blurb": "Syntax, objects, the standard library …" }, … ]
}
```

Listing a new site is **adding one object to `apps`**; a whole new *kind* of site adds one to
`kinds`. Nothing else changes. Optional per app: `group` (which heading it sits under), `blurb`
(the sentence under the title), `tint`
(the card's brand colour, copied from that repo's own `--brand`), `icon` (a mark in `icons/`),
`subject` (groups `python` with `python-lab`, and supplies the monogram when there is no icon),
`status` (`soon` shows a non-clickable card, `hidden` omits it), `access` (`premium` shows a pill).
Missing or unknown values degrade rather than breaking the page — no blurb is a bare title row, no
tint is the platform accent, no icon is a monogram tile. `npm run check` is the strict counterpart.

Every card links into that site's own app at `graphl.in/<slug>/`, where the slug is the repo name.
The index never fetches or lists courses/sections — each site owns its own navigation. All
same-origin under `graphl.in`, which is what will let a login session and a theme choice be shared
across every app.

The page is ordinary site chrome — a header with the logo and wordmark on the left, the section
nav on the right — and the nav items are plain `#courses` / `#labs` anchors. The card list starts
straight after: no visible heading, description or count, since the highlighted nav item and the
cards themselves already say all three. The `<h1>` is visually hidden, kept for structure.

Cards are grouped by subject — **Data**, **Languages**, **People**, **Systems** — as headings
inside the active tab. That is a second axis from the nav: the nav is *delivery format* (courses,
labs, coaching), the headings are *subject domain*. A tab whose apps declare no group renders one
flat grid instead, which is what Labs and Coach do with a single card each.

A card is **logo tile · title + pills · one sentence · arrow**, one column on phones and two from
720px up. The tile carries that app's own brand colour, and so do the pills, the hover border and
the arrow — the card background stays neutral, because seven saturated grounds in a grid read as
noise. An app with no mark in `icons/` gets its initials on the same tinted ground, which is what
lets logos land one concept at a time.

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
auth.js          Google sign-in + account menu + subscription state
firebase-config.js  public Firebase web config (shared project) and pinned SDK URL
app.js           fetch the active section's file → render one card per entry
catalog.json     kinds (the nav) + apps (the cards)
icons/           brand marks, one SVG per slug (see icons/README.md)

package.json      no dependencies; scripts: `dev`, `check`
scripts/serve.mjs zero-dep local server that mimics GitHub Pages
scripts/check-catalog.mjs   validates catalog.json (`--links` checks graphl.in)
```

## Sign in

Google sign-in via Firebase, on the owner's existing `schemabot-ae922` project — the same account
and the same subscription as the other products, so one membership covers everything. Billing is
the `firestore-stripe-payments` extension: the client asks for a Checkout session and reads back
what Stripe wrote, and can never grant itself a subscription.

All of it is additive — the catalog is public and renders completely signed out, offline, or with
the Firebase CDN blocked.

## Mobile

Below 560px the header splits into two rows — brand and buttons on top, the section nav on its own
full-width row that scrolls sideways rather than collapsing into a menu. Verified down to 320px.

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
