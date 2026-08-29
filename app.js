// The GraphL catalog index. Reads concepts.json — the list of published concept sites — and renders
// a gallery of links, one per concept, into its own site at graphl.in/<slug>/. Each concept site is
// a standalone static app that owns its own course/section navigation; the index only points at
// them (it does not fetch or list courses). Adding a concept = adding a { slug, name } to
// concepts.json.

const CATALOG = document.getElementById('catalog')

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

// A concept row: a numbered card linking into the concept's own site (graphl.in/<slug>/). Reuses the
// concept apps' landing vocabulary (.idx-card*) — number box · title · arrow — so the root catalog
// and each concept index read as one system. `i` is the zero-based position → the 01, 02… label.
function conceptCard(concept, i) {
  const li = el('li', 'idx-card')
  const a = el('a', 'idx-card__link')
  a.href = `${concept.slug}/`
  a.appendChild(el('span', 'idx-card__num', String(i + 1).padStart(2, '0')))
  a.appendChild(el('span', 'idx-card__title', concept.name ?? concept.slug))
  const arrow = el('span', 'idx-card__arrow', '→')
  arrow.setAttribute('aria-hidden', 'true')
  a.appendChild(arrow)
  li.appendChild(a)
  return li
}

async function main() {
  let concepts
  try {
    concepts = await getJSON('concepts.json')
  } catch {
    CATALOG.replaceChildren(el('li', 'idx__empty', 'Catalog unavailable.'))
    return
  }
  CATALOG.replaceChildren(...concepts.map((c, i) => conceptCard(c, i)))
}

main()
