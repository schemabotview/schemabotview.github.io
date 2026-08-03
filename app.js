// The GraphL catalog index. Reads concepts.json (the list of deployed concept apps), then
// fetches each concept's courses.json — published by the concept app at /<slug>/courses.json
// — and renders a gallery. Same-origin at graphl.in, so no CORS. Adding a concept = adding a
// slug to concepts.json; its courses appear automatically.

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

function courseCard(slug, course) {
  const a = el('a', 'course')
  a.href = `${slug}/#/${course.id}`
  a.appendChild(el('span', 'course__title', course.title))
  // Meta line intentionally omitted for now — reserved for a future "time to read" length cue.
  return a
}

function conceptBlock(name, slug, courses) {
  const section = el('section', 'concept')
  const heading = el('h2', 'concept__name')
  const link = el('a', 'concept__link', name)
  link.href = `${slug}/` // the concept's own index (graphl.in/<slug>/)
  heading.appendChild(link)
  section.appendChild(heading)
  const grid = el('div', 'concept__grid')
  if (courses && courses.length) {
    for (const c of courses) grid.appendChild(courseCard(slug, c))
  } else {
    grid.appendChild(el('p', 'concept__empty', 'No courses published yet.'))
  }
  section.appendChild(grid)
  return section
}

async function main() {
  let concepts
  try {
    concepts = await getJSON('concepts.json')
  } catch {
    CATALOG.replaceChildren(el('p', 'loading', 'Catalog unavailable.'))
    return
  }

  const blocks = await Promise.all(
    concepts.map(async (c) => {
      let data = null
      try {
        data = await getJSON(`${c.slug}/courses.json`)
      } catch {
        /* concept not published yet — render an empty block */
      }
      return conceptBlock(data?.concept ?? c.name ?? c.slug, c.slug, data?.courses)
    }),
  )
  CATALOG.replaceChildren(...blocks)
}

main()
