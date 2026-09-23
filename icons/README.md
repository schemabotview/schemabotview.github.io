# icons/

Marks for the catalog cards. One SVG per app, named for its slug (`python.svg`), pointed at by that
app's `icon` or `glyph` field in `catalog.json`. An app with neither gets a monogram — its initials
on the same tinted ground — so a concept still waiting for a mark reads as a different tile, not a
broken one.

There are **two kinds of file here, and they render differently on purpose.**

## `icon` — a vendor's own logo

Published art, used **as published**: `app.js` puts it in an `<img>` and nothing recolours it. The
tile ground behind it already carries the brand tint, so recolouring the mark would fight it.

Vendor marks are subject to their owners' trademark guidelines. Add them deliberately, from the
vendor's own brand page where there is one, and record where each came from:

| file | source | fetched | notes |
|---|---|---|---|
| `python.svg` | Wikimedia Commons, `Python-logo-notext.svg` (PSF mark) | 2026-09-22 | square already, used unmodified |
| `snowflake.svg` | Wikimedia Commons, `Snowflake_Logo.svg` | 2026-09-22 | cropped to the mark: the 9 wordmark paths dropped, viewBox tightened to `0 0.53 43.4 43.5` |
| `apache-spark.svg` | Wikimedia Commons, `Apache_Spark_logo.svg` (ASF mark) | 2026-09-22 | cropped to the flame: the 12 `#3c3a3e` wordmark paths dropped, leaving the one `#e25a1c` path |
| `databricks-data-engineer.svg` | databricks.com, `db-nav-logo.svg` | 2026-09-22 | cropped to the mark: the `white` wordmark path dropped, leaving the one `#FF3621` path |
| `dbt.svg` | getdbt.com, `img/logos/dbt-labs-logo.svg` | 2026-09-23 | cropped to the mark: the 9 `black` wordmark paths and the clip group dropped, leaving the one `#FE6703` path; viewBox tightened to `0.46 0.63 88.72 88.74` (the path's measured bbox) |

**Cropping is the usual work**, because a vendor almost always publishes a horizontal lockup and
the tile is a 32px square — a wordmark rendered into it shrinks to an illegible sliver. Crop by
tightening the `viewBox` to the mark's own bounding box and deleting the wordmark paths; do not
scale or redraw the mark itself.

If you crop by rewriting the `<svg>` tag, **carry the namespace declarations over**. Dropping
`xmlns:inkscape`/`xmlns:sodipodi` while an editor's `<sodipodi:namedview>` element stays behind
leaves an unbound prefix, and the whole file fails to parse — the card silently falls back to its
monogram, which looks exactly like "no icon yet". Every file here must parse as XML.

## `glyph` — one of ours

For a concept with no vendor at all (SQL, Data Warehousing, 1:1 Coaching), and for AWS, whose mark
Amazon does not license for use as third-party course branding.

**A glyph file carries geometry only — no colour.** It is painted through CSS `mask`, which hands
it the same `--tint-ink` the monogram uses, so it inherits the light theme's darkening without
which the pale brands (SQL's cyan, Linux's yellow) wash out on a white ground. An `<img>` cannot
read a custom property, and a colour baked into the file would fail one theme or the other.

House glyphs are one family: a 32×32 grid, outlines at stroke-width 2.2 with round caps and joins,
which sits deliberately lighter than the solid vendor marks beside them. `linux.svg` is a terminal
rather than Tux — at 32px Tux's 47 shapes and gradients turn to mud, and its black body disappears
into a dark card.

## Both

`npm run check` fails if `icon` or `glyph` names a file that is not here. For an `icon` that is
belt-and-braces — a missing `<img>` falls back to the monogram at runtime too — but **for a `glyph`
it is the only guard**: a mask with nothing to mask paints an empty square. An app may set one or
the other, never both.
