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
  "kinds":  [ { "id": "courses", "label": "Courses" }, … ],   // the header nav
  "groups": [ { "id": "languages", "label": "Languages" }, … ], // headings inside a panel
  "apps":   [ { "slug": "python", "kind": "courses", "group": "languages", … }, … ]
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
| `group` | none | which heading inside that tab. Undeclared ⇒ a heading is appended; omitted in an otherwise grouped kind ⇒ a trailing "More". |
| `name` | the slug | card title |
| `subject` | the name | groups an app with its siblings (`python` + `python-lab` → Python), **and** is what the monogram is derived from — the short form, so "Databricks Data Engineer" subjects as "Databricks" and tiles as "Da" |
| `blurb` | none | the card's hover tooltip (the link's `title`). Not drawn on the card since 2026-09-23; `check` still errors past 90 chars |
| `tint` | `--accent` | the card's brand colour, copied from that repo's own `--brand` |
| `icon` | monogram | a vendor's own logo: a filename in `icons/`, rendered in an `<img>` as published |
| `glyph` | monogram | one of our house marks: a filename in `icons/`, painted through a CSS `mask` so it takes the card's `--tint-ink`. Mutually exclusive with `icon`; absent ⇒ the subject's initials on the same tinted ground |
| `status` | `live` | `soon` renders a non-clickable card; `hidden` omits it entirely |
| `access` | `free` | `premium` renders a pill. **UI only** — a Pages file is world-readable. |
| `href` | `/<slug>/` | escape hatch for an app off Pages. Should stay unused (see below). |

**Unknown or missing values degrade, they never break the page.** The catalog is hand-edited, so
the failure mode for a typo has to be "slightly wrong", never "blank page". `npm run check` is the
strict counterpart — see *Add an entry*.

Each card links at that site's own app (`/<slug>/`). The index does **not** fetch or list
courses/sections: each site owns its own navigation.

### Two axes: kinds and groups

**`kinds` is delivery format** — Courses / Labs / Coach — and it is the **header nav**. **`groups`
is subject domain** — Data / Languages / People / Systems — and it is a **heading inside one
kind's panel**.

They cannot swap places. Kind ids *are* the URL hash and `#courses` / `#labs` are published links,
so the nav is not free to change; and a topic sitting in that row next to "Labs" would ask the
reader to hold two questions at once ("is Python Lab a lab or a language?"). One axis navigates,
the other organises what the navigation landed on.

`groups` is **optional in full**. No `groups` array — or a kind whose apps declare none — renders
the flat grid the page had before topics existed, which is what Labs and Coach do with one card
each. Grouping is decided per kind, by the apps themselves.

Current split. The groups array is ordered alphabetically, which is also the render order of the
headings:

| | |
|---|---|
| **AI/ML** | Supervised Learning |
| **Data** | Apache Spark · Databricks Data Engineer · Data Warehousing · dbt · Snowflake |
| **Languages** | Python · SQL |
| **People** | Soft Skills |
| **Systems** | AWS · Azure · Linux |

Two placements are worth recording. **SQL is under Languages** because that is what it is, even
though it pulls a card away from Data. And **People** was added for `soft-skills`, which fits none
of the other three: the axis is subject domain, and its subject is the person rather than a
technology. It holds one card today; `docker` and `kubernetes` land in Systems and `java` in
Languages when they are authored, so the heading that stays thin is this one — which is fine, since
a heading with one card still tells the reader the catalog is not only about tools.

**AI/ML was declared on 2026-09-23**, the day `supervised-learning` was listed — the rule the old
note set ("declare it on the day the first course ships") being met, not waived. It held no group
before that, deliberately: an empty heading advertises a gap. `npm run check` still warns about a
declared group nobody is in, so the next aspirational heading cannot be left behind by accident.

**It is ordered first, ahead of Data.** The groups array is alphabetical and `ai-ml` sorts there
anyway, so nothing special is being done — but the render order *is* the array order, and this is
the group the catalog is growing into (`deep-learning` and `unsupervised-learning` are the two
repos beside `supervised-learning`), so first is also where it should read.

Order within a group is **file order**, so `apps` is kept sorted by group to match what renders.

### The card

`logo tile · title + pills`. That is the whole card. It has been through three shapes: an 01/02
number box then the title; then the tile plus a blurb and an arrow when the cards became
descriptive; and since **2026-09-23** the compact form, when the catalog outgrew one screen.

**Why the blurb came out.** Twelve concepts across five headings ran to about 1,700px — the reader
had to scroll and then remember, and "what is published here?" is the question this page exists to
answer. A blurb is the right thing on a page someone reads; this is a page someone *scans*, and the
mark plus the name identifies a concept to anyone who would recognise the blurb anyway. The
sentence is still authored, still length-checked, and still shipped — as the link's `title`, so a
hovering mouse can have it. That is deliberately a mouse-only affordance.

**Everything fits the fold**: measured 900px at 1440 wide, 768px at 1366 and at 1024. Phones still
scroll (one column, ~1,280px) — twelve cards cannot do otherwise — but that is half of what it was.

The arrow went with the blurb: a 64px card is plainly one tap target, and the arrow was a hover
affordance for the wide banner shape. `min-height: 100vh` came off `.idx` at the same time — under
a 61px header it made the document 100vh + 61px, so the page scrolled by exactly the height of its
own header even when the content fitted. Invisible while the catalog was long; the whole ballgame
once it is not.

**The tile has three tiers**, all on the same tinted ground: a vendor's logo (`icon`), else one of
our house glyphs (`glyph`), else the subject's monogram. The split between the first two is not
cosmetic. A vendor logo is published art and is rendered **as published**, in an `<img>`; a house
glyph is ours and carries **no colour at all**, painted through a CSS `mask` so it inherits the
card's `--tint-ink` — including the light theme's darkening, without which SQL's cyan and Linux's
ochre wash out on white. An `<img>` cannot read a custom property, which is the whole reason for
two mechanisms rather than one.

Four cards are house glyphs: SQL, Data Warehousing and 1:1 Coaching have no vendor to borrow from,
and **AWS is deliberate** — Amazon does not license the AWS mark for third-party course branding,
so that card gets a cloud of our own. Linux is a glyph too, for a rendering reason rather than a
legal one: Tux is 47 shapes and gradients that turn to mud at 32px, with a black body that
disappears into a dark card.

**As many columns as fit** — `repeat(auto-fill, minmax(240px, 1fr))`, which is 3 at the 940px
container, 2 on a tablet and 1 on a phone. The 240px floor is set by the longest name on the page
("Databricks Data Engineer") staying on one line at the column width that results; a name that does
wrap simply makes its row taller, since the grid stretches every card in a row to match.

**Brand colour is restrained on purpose.** Each card sets `--tint` inline from its `tint`, and
everything downstream reads that property: the tile ground, the monogram, the pills, the hover
border and wash, the focus ring. Not the card background — seven saturated grounds side by side in
a grid read as noise rather than as a system.

Two derived tokens do the contrast work, because a published brand colour is not a readable one.
`--tint-ink` (the 20px monogram, where 3:1 is the bar) darkens every tint toward the page ink on
light and uses the brand as published on dark; `--tint-strong` (the 11px pill, where the bar is
4.5:1) pushes a further step. Both are uniform rather than special-casing the pale brands, so a new
`tint` needs no thought. Measured in-browser: light 3.3–5.8:1, dark 3.7–7.2:1.

`color-mix` is the one modern feature on the page. **Every property using it is preceded by a flat
fallback**, so a browser without it gets the neutral card this page had before tints existed.

### Sign-in and the subscription

**Reused, not built.** Auth and billing already run on the owner's existing Firebase project
`schemabot-ae922` (see `schematic1/src/stores/useAuthStore.ts`, plus `schematic-reader`,
`schematic`, `NodeEditor` — all private). This repo ports only the *client*, from React + zustand +
the npm SDK to vanilla ESM off Google's CDN, so the catalog stays buildless.

```
customers/{uid}/subscriptions       written by the Stripe webhook, READ-ONLY to the client
                                    entitlement = any doc with status active | trialing
customers/{uid}/checkout_sessions   client writes { price, success_url, cancel_url };
                                    the extension answers with a `url` to redirect to
```

Backend is the **`firestore-stripe-payments` extension**. The client can never grant itself a
subscription — only ask Stripe for one and read back what Stripe decided. **Do not cache
entitlement anywhere the client can write.**

- **One price, all products** (decided 2026-09-13). The check is deliberately *not* product-scoped:
  a subscriber to any of the owner's products is premium here too.
- **The subscription read fails closed.** Denied or offline ⇒ "Free". A false Premium badge is a
  lie; a spurious upgrade button is merely annoying.
- **All of it is additive.** The catalog is a public directory and renders completely for a
  signed-out reader, an offline reader, or one whose network blocks `gstatic.com` — verified.

Two things live outside this repo and cannot be fixed from inside it:

1. **`graphl.in` must be listed in Firebase → Authentication → Authorized domains**, or sign-in
   fails. `localhost` is authorised by default, so local and production can differ here.
2. **Never add `firestore.rules` to this repo.** Rules are per-project and deploying them replaces
   the *entire* ruleset — a GraphL-only file would delete the customers/products rules the owner's
   other apps depend on.

`signInWithPopup`, not `signInWithRedirect`: redirect breaks under third-party-cookie blocking when
`authDomain` is not the site's own domain.

### Mobile

The header is **two rows below 560px**: brand and the icon buttons stay together on top, the
section nav drops to its own full-width row beneath. One row cannot hold all three — with the
theme button it needs 370px, which is wider than a 360px phone.

That nav row **scrolls horizontally; it is not a hamburger.** The sections are the primary
navigation and the point of the current one is being visible — a menu hides "you are here" behind
a tap. A row that runs off the edge keeps every section one gesture away and keeps the active one
on screen. It bleeds to the screen edges (negative margin + matching padding) so the last item can
scroll fully into view.

Touch targets are ≥ 40px on phones (the icon button grows from 36, nav links get `min-height`).
Verified headless at 560 / 430 / 390 / 360 / 320: no horizontal overflow at any width, and with
eight kinds injected the *nav* scrolls while the page still does not.

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
each card now names and describes itself, so anything in that slot restates what is already on
screen; the `<h1>` is
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
index.html    site header (brand + empty nav + theme button) + <div id="catalog"> panel
              …plus the blocking inline theme boot in <head>
styles.css    light + dark tokens, matches the concept apps (.site* header, .idx* page + cards)
theme.js      the three-state theme control (system / light / dark)
auth.js       Google sign-in, the account menu, and the shared subscription
firebase-config.js  the EXISTING project's public web config + the pinned SDK URL
app.js        fetch the active section's file → render one link card per entry (→ /<slug>/)
catalog.json  kinds (the nav) + apps (the cards) — the whole catalog, one file
icons/        marks, one SVG per slug — vendor logos (`icon`) and house glyphs (`glyph`).
              See icons/README.md before adding one: a vendor lockup must be cropped to its
              mark, and a house glyph carries no colour of its own.
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
2. Add one object to `apps` in `catalog.json`, with a `group`. A new **kind** of app also gets an
   entry in `kinds`, and a genuinely new subject domain one in `groups` — those are the only
   reasons to touch anything else. Keep `apps` sorted by group: file order is render order.
3. Give it a `blurb` and a `tint` (copy the repo's own `--brand`). Both are optional and both
   degrade — no blurb is a card with no tooltip, no tint is the platform accent. The blurb is not
   drawn on the card any more, but write one anyway: it is the hover text, and `check` warns
   without it. Mark: a vendor logo or a house glyph in `icons/`, else the subject's monogram —
   on a card that is now mark + name, the mark is half of what the reader sees.
4. `npm run check` before pushing. `npm run check -- --links` additionally HEADs every live entry
   against graphl.in, which is what turns step 1 from a rule someone remembers into one the repo
   enforces — a live entry that does not answer 200 fails the check.

## Notes

- **Currently listed:** `aws`, `azure`, `apache-spark`, `python`, `databricks-data-engineer`, `sql`,
  `linux`, `data-warehousing`, `snowflake`, `dbt`, `supervised-learning`, `python-lab` — every
  deployed app — plus `coach` as `status: "soon"`. `dbt` joined on 2026-09-23, the day its nine
  courses finished recording; it wore the monogram for a few hours, until `icons/dbt.svg` landed
  the same day.
  `linux` joined on 2026-09-01: the `schemabotview/linux` repo's old graphl-studio app was replaced
  by the workspace concept app (8 courses, 80 sections), Pages was switched to the workflow build
  source, and `graphl.in/linux/` went live before the card was added.
- **`supervised-learning` and `azure` joined on 2026-09-23**, on the owner's instruction, and both
  are listed **earlier in their authoring than any card before them** — supervised-learning has 2
  of 7 courses written (its own CLAUDE.md had recorded "no catalog entry yet. Deliberate."), azure
  1 of 11. Both serve 200 at `graphl.in/<slug>/`, so the deploy-first rule holds; what is new is
  that a card can now point at an arc that is mostly declared rather than mostly written. Neither
  has narration audio yet.
- **`python-lab` is a lab, not a concept app** (added 2026-09-09). Labs are the hands-on
  counterpart to a concept app of the same name — the family `aws-lab` started: `<concept>-lab`.
  A lab has no scenes, narration or course/section content, so it does not follow the per-repo
  anatomy in `../CLAUDE.md`. Repo: `schemabotview/python-lab`; it runs CPython in the browser via
  Pyodide and routes on `#/` like the concept apps do.
- **`aws-lab` is not listed yet** — it exists as a repo but has no Pages deployment, and the rule
  above (deploy first) applies to labs too. It joins `catalog.json` once `graphl.in/aws-lab/` serves.
- This repo previously held a **built SPA** (an older GraphL catalog); it was replaced by this static
  site on request. The old build is recoverable from git history if ever needed.
- **Every card has a mark** as of 2026-09-22 — the `icons/` folder was empty until then and every
  card was a monogram. Six vendor logos over seven cards (`python.svg` serves Python and Python Lab
  both · Snowflake · Apache Spark · Databricks · dbt · Azure) and six house glyphs (AWS · SQL ·
  Data Warehousing · Linux · Coach · Supervised Learning). The monogram path is still live and
  still the fallback for the next concept to land.
- **Azure wears the vendor mark, AWS does not** — the asymmetry is deliberate and is about the
  licences, not about consistency. Microsoft publishes the Azure "A" as a standalone mark and it
  renders cleanly at 32px; Amazon does not license the AWS mark for third-party course branding,
  which is why that card carries a cloud of our own. If Microsoft's guidelines are ever read the
  same way, swapping `"icon": "azure.svg"` for a glyph is a one-field change.
- Working agreement (inherited): one reviewed slice at a time; explain before writing.
