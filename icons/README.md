# icons/

Brand marks for the catalog cards. One SVG per app, named for its slug (`python.svg`), pointed at
by that app's `icon` field in `catalog.json`.

An app with no `icon` gets a monogram tile instead — its initials on the same tinted ground — so
logos land one concept at a time rather than all at once, and a concept still waiting for its mark
reads as a different tile, not a broken one. `npm run check` fails if an `icon` names a file that
is not here; if one goes missing after a deploy, the card falls back to the monogram at runtime.

Vendor marks are subject to their owners' trademark guidelines. Add them deliberately, from the
vendor's own brand page, and keep the file as published rather than recolouring it — the tile
ground behind it already carries the brand tint.

The folder is empty of marks today: every card is a monogram.
