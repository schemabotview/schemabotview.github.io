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

// A course row in the concept's ordered list: a number badge, the title + one-line blurb, and
// the section count. Courses within a concept are a *sequence* (take them in order), so they
// render as a numbered list — identical to each concept app's own landing page. Title/blurb/
// count all come from the concept's courses.json (blurb emitted by its gen-courses build).
function courseRow(slug, course, n) {
  const li = el('li', 'course-item')
  const a = el('a', 'course')
  a.href = `${slug}/#/${course.id}`
  a.appendChild(el('span', 'course__num', String(n)))
  const text = el('span', 'course__text')
  text.appendChild(el('span', 'course__title', course.title))
  if (course.blurb) text.appendChild(el('span', 'course__blurb', course.blurb))
  a.appendChild(text)
  if (typeof course.sections === 'number') {
    a.appendChild(el('span', 'course__meta', `${course.sections} sections`))
  }
  li.appendChild(a)
  return li
}

function conceptBlock(name, slug, courses) {
  const section = el('section', 'concept')
  const heading = el('h2', 'concept__name')
  const link = el('a', 'concept__link', name)
  link.href = `${slug}/` // the concept's own index (graphl.in/<slug>/)
  heading.appendChild(link)
  section.appendChild(heading)
  const list = el('ol', 'concept__list')
  if (courses && courses.length) {
    courses.forEach((c, i) => list.appendChild(courseRow(slug, c, i + 1)))
  } else {
    list.appendChild(el('li', 'concept__empty', 'No courses published yet.'))
  }
  section.appendChild(list)
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
