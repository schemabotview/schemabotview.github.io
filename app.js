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

// A stable DOM id per concept, so the jump-nav links (#c-<slug>) can scroll to each block.
function conceptId(slug) {
  return `c-${slug}`
}

// Sticky jump-nav: a horizontal strip of concept chips that scroll to each section. Only worth
// showing once there's more than one concept (with a single concept there's nothing to jump
// between). Built from the concept list itself, so a new slug in concepts.json appears here too.
function conceptNav(concepts) {
  if (concepts.length < 2) return null
  const nav = el('nav', 'concept-nav')
  nav.setAttribute('aria-label', 'Concepts')
  const inner = el('div', 'concept-nav__inner')
  concepts.forEach((c) => {
    const a = el('a', 'concept-nav__link', c.name ?? c.slug)
    a.href = `#${conceptId(c.slug)}`
    a.dataset.target = conceptId(c.slug)
    inner.appendChild(a)
  })
  nav.appendChild(inner)
  return nav
}

// Scroll-spy: light the nav chip for whichever concept is currently near the top of the viewport.
// A section counts as "in view" while it sits inside a thin band under the sticky nav; the active
// chip is the topmost such section in document order.
function setupScrollSpy(concepts) {
  const links = new Map()
  const sections = []
  concepts.forEach((c) => {
    const id = conceptId(c.slug)
    const link = document.querySelector(`.concept-nav__link[data-target="${id}"]`)
    const section = document.getElementById(id)
    if (link && section) {
      links.set(id, link)
      sections.push(section)
    }
  })
  if (!sections.length) return
  const order = concepts.map((c) => conceptId(c.slug))
  const visible = new Set()
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target.id)
        else visible.delete(e.target.id)
      }
      const activeId = order.find((id) => visible.has(id))
      links.forEach((link, id) => link.classList.toggle('is-active', id === activeId))
    },
    { rootMargin: '-12% 0px -78% 0px' },
  )
  sections.forEach((s) => io.observe(s))
}

function conceptBlock(name, slug, courses) {
  const section = el('section', 'concept')
  section.id = conceptId(slug)
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

  const nav = conceptNav(concepts)
  if (nav) {
    document.body.insertBefore(nav, CATALOG)
    setupScrollSpy(concepts)
  }
}

main()
