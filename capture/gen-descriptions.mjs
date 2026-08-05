// gen-descriptions.mjs — write a YouTube description .txt per concept-course.
//
//   node capture/gen-descriptions.mjs <concept> [course]
//   node capture/gen-descriptions.mjs apache-spark                 # all courses
//   node capture/gen-descriptions.mjs apache-spark spark-streaming # just one
//
// Each description carries: a title + intro, CHAPTER timestamps (one per section, so YouTube
// auto-chapters the video), the full course series with deep links, and hashtags. Output lands at
// out/<concept>/<course>.txt, next to the course's .mp4 / .png.
//
// Chapter names are the real slide titles (read from the app's DOM, driven in ?capture=1 like
// record-course.mjs / thumb.mjs). Chapter times are ffprobe'd off each beat's wav and summed with
// the recorder's own per-segment timing (STING lead on beat 0 + clip + TAIL), so they line up with
// the concatenated MP4. Display titles come from titles.json (fallback: courses.json).
//
// Prerequisites: ffprobe on PATH; the concept app's audio present under public/audio/<course>/.

import { execFile, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null } }

// Match record-course.mjs's timing so chapter marks align with the concatenated video.
const STING_MS = process.env.NO_STING ? 0 : process.env.STING_MS ? +process.env.STING_MS : 2800
const TAIL_MS = process.env.TAIL_MS ? +process.env.TAIL_MS : 400
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
// Hashtags are per-concept (a Spark video shouldn't carry SQL tags, and vice-versa). Add an entry
// when a new concept ships; DEFAULT covers anything unlisted.
const HASHTAGS_BY_CONCEPT = {
  'apache-spark': '#ApacheSpark #Spark #BigData #DataEngineering #PySpark #Databricks #DataPipeline',
  sql: '#SQL #Database #RelationalDatabase #DataEngineering #PostgreSQL #DataAnalysis #Backend',
}
const DEFAULT_HASHTAGS = '#GraphL #Programming #ComputerScience #SoftwareEngineering'
const SITE = 'https://graphl.in'

const titleCase = (slug) => slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
// m:ss (or h:mm:ss past an hour) — YouTube chapter format; first chapter must be 0:00.
function stamp(sec) {
  const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const p2 = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p2(m)}:${p2(ss)}` : `${m}:${p2(ss)}`
}

async function ffprobeDuration(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
  return parseFloat(stdout.trim())
}

async function startDevServer(conceptDir) {
  console.log(`Starting dev server: ${conceptDir} …`)
  const child = spawn('npm', ['run', 'dev'], { cwd: conceptDir, env: process.env })
  const url = await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('dev server did not print a URL within 60s')), 60000)
    const onData = (buf) => {
      const m = String(buf).match(/https?:\/\/localhost:\d+\/?/)
      if (m) { clearTimeout(to); child.stdout.off('data', onData); res(m[0].replace(/\/?$/, '/')) }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (b) => process.env.DEBUG && process.stderr.write(b))
    child.on('exit', (code) => rej(new Error(`dev server exited early (code ${code})`)))
  })
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(url)).ok) break } catch { /* not up yet */ }
    await sleep(250)
  }
  console.log(`  dev server at ${url}`)
  return { child, url }
}

// Build the description text for one course. Blocks are separated by a VISIBLE rule (not blank
// lines) so grouping survives even if YouTube trims empty lines on paste; chapters stay one-per-line
// (required for auto-chapters) and each series entry is a single line ending in its URL (clickable).
const RULE = '━━━━━━━━━━━━━━━━'
function compose({ concept, conceptName, course, displayOf, blurbOf, chapters, series, hashtags }) {
  const L = []
  L.push(`${displayOf(course)} · ${conceptName}`)
  L.push(RULE)
  const blurb = blurbOf(course)
  L.push(`${blurb ? blurb + '. ' : ''}Part of GraphL's ${conceptName} series — the left-pane diagram assembles beat-by-beat, in sync with the narration.`)
  L.push(RULE)
  L.push('⏱ CHAPTERS')
  for (const c of chapters) L.push(`${stamp(c.start)} ${c.title}`)
  L.push(RULE)
  L.push(`▶ ${conceptName.toUpperCase()} — THE SERIES`)
  series.forEach((s, i) => {
    const label = s.id === course ? `${displayOf(s.id)}  ◀ this video` : displayOf(s.id)
    L.push(`${CIRCLED[i] ?? '•'} ${label} → ${SITE}/${concept}/#/${s.id}`)
  })
  L.push(RULE)
  L.push(`🔗 Watch interactively on GraphL → ${SITE}/${concept}/#/${course}`)
  L.push(`🌐 More concepts → ${SITE}`)
  L.push(RULE)
  L.push(hashtags)
  return L.join('\n') + '\n'
}

async function main() {
  const [concept, oneCourse] = process.argv.slice(2)
  if (!concept) { console.error('usage: node gen-descriptions.mjs <concept> [course]'); process.exit(2) }

  const conceptDir = resolve(here, '..', '..', concept)
  if (!existsSync(conceptDir)) throw new Error(`concept app not found: ${conceptDir}`)

  const cj = readJson(join(conceptDir, 'public', 'courses.json'))
  if (!cj?.courses?.length) throw new Error('public/courses.json missing or empty (run the app build once)')
  const conceptName = cj.concept ?? titleCase(concept)
  const series = cj.courses // catalog order
  const titles = readJson(join(here, 'titles.json'))?.[concept] ?? {}
  const displayOf = (id) => titles[id] ?? series.find((c) => c.id === id)?.title ?? titleCase(id)
  const blurbOf = (id) => series.find((c) => c.id === id)?.blurb ?? ''

  const targets = oneCourse ? [oneCourse] : series.map((c) => c.id)
  const outDir = join(here, 'out', concept)
  mkdirSync(outDir, { recursive: true })

  let server = null
  const base = process.env.APP_URL ? process.env.APP_URL.replace(/\/?$/, '/') : null
  const appBase = base ?? (server = await startDevServer(conceptDir), server.url)

  const puppeteer = (await import('puppeteer')).default
  let browser
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
    const page = await browser.newPage()

    for (const course of targets) {
      await page.goto(`${appBase}?capture=1#/${course}`, { waitUntil: 'networkidle2' })
      await page.waitForFunction(() => !!window.__capture, { timeout: 20000 })
      const plan = await page.evaluate(() => window.__capture.plan())
      if (!plan?.length) { console.warn(`  ✗ ${course}: no sections (bad id?) — skipped`); continue }

      const audioDir = join(conceptDir, 'public', 'audio', course)
      const chapters = []
      let t = 0
      for (const sec of plan) {
        // Chapter starts at this section's beat-0 (the bell lead) — read its slide title from the DOM.
        await page.evaluate((s) => { window.__captureReady = false; window.__capture.seek(s, 0) }, sec.section)
        await page.waitForFunction(() => window.__captureReady === true, { timeout: 20000 }).catch(() => {})
        await sleep(120)
        const title = await page.$eval('.slide__title', (el) => el.textContent.trim()).catch(() => titleCase(sec.id))
        chapters.push({ start: t, title })
        for (let b = 0; b < sec.beats; b++) {
          const wav = join(audioDir, `${sec.id}-${b}.wav`)
          const dur = existsSync(wav) ? await ffprobeDuration(wav) : 3
          t += (b === 0 ? STING_MS / 1000 : 0) + dur + TAIL_MS / 1000
        }
      }

      const hashtags = HASHTAGS_BY_CONCEPT[concept] ?? DEFAULT_HASHTAGS
      const text = compose({ concept, conceptName, course, displayOf, blurbOf, chapters, series, hashtags })
      const out = join(outDir, `${course}.txt`)
      writeFileSync(out, text)
      console.log(`✅ ${out}   (${chapters.length} chapters, ${stamp(t)} total)`)
    }
  } finally {
    if (browser) await browser.close()
    if (server) server.child.kill('SIGTERM')
  }
}

main().catch((e) => { console.error('\n✗', e.message); process.exit(1) })
