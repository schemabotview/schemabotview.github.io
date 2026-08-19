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

// A concept row: a card linking into the concept's own site (graphl.in/<slug>/). Reuses the shared
// card visual vocabulary (.course*) so the index stays consistent with each concept app's landing.
function conceptCard(concept) {
  const li = el('li')
  const a = el('a', 'course')
  a.href = `${concept.slug}/`
  const text = el('span', 'course__text')
  text.appendChild(el('span', 'course__title', concept.name ?? concept.slug))
  a.appendChild(text)
  a.appendChild(el('span', 'course__meta', '→'))
  li.appendChild(a)
  return li
}

async function main() {
  let concepts
  try {
    concepts = await getJSON('concepts.json')
  } catch {
    CATALOG.replaceChildren(el('p', 'loading', 'Catalog unavailable.'))
    return
  }
  const list = el('ul', 'concept__list')
  concepts.forEach((c) => list.appendChild(conceptCard(c)))
  CATALOG.replaceChildren(list)
}

main()
