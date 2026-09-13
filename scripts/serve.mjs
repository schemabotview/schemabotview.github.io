// Local dev server for the GraphL catalog index — and, alongside it, the sister apps.
//
// This repo is a pure static site with no build, so there is nothing to compile — the point of
// this script is only to serve the folder the way GitHub Pages serves it, so that "works locally"
// means "works on graphl.in". Zero dependencies: `npm install` is a no-op and stays that way.
//
//   npm run dev            → http://localhost:8000
//   PORT=3000 npm run dev  → pick another port
//
// Pages behaviours reproduced here:
//   /            → index.html
//   /dir         → 301 redirect to /dir/            (Pages adds the trailing slash)
//   /dir/        → dir/index.html
//   /about       → about.html                       (extension-less fallback)
//   missing      → 404.html if the repo has one, else a plain 404
//   directories  → never listed
//   paths        → CASE-SENSITIVE, because Pages runs on Linux and macOS does not
//
// SISTER APPS. On graphl.in a catalog card points at /<slug>/, which is a different repo published
// under the same apex domain. Locally the same URL is answered from the sibling checkout's build:
// /aws/ → ../aws/dist/. That is the faithful choice rather than a proxy to `vite dev`, because the
// concept apps set `base` to /<slug>/ for the BUILD only — dist/index.html already asks for
// /aws/assets/…, exactly the bytes Pages serves — while their dev server stays on base / at port
// 5173 so the record scripts keep working. Proxying 5173 would mean rewriting every asset URL, and
// they all share that one port anyway.
//
// Sisters are discovered, never listed: any ../<slug>/dist that exists is mounted, so a new
// concept app needs no change here. Build it (`cd ../aws && npm run build`) and reload; an unbuilt
// sibling says so instead of 404ing blankly. SISTERS=/path overrides the search directory.
//
// Not reproduced (and not worth it): Jekyll (.nojekyll disables it anyway) and the CDN's caching
// and compression.

import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat, realpath, readdir } from 'node:fs/promises'
import { join, resolve, relative, sep, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const SISTERS = resolve(ROOT, process.env.SISTERS || '..')
const PORT = Number(process.env.PORT) || 8000
const HOST = process.env.HOST || 'localhost'

// A catalog slug, and the only shape a path's first segment may have to be treated as a sister.
// Excludes anything with a dot, which is also what keeps this repo's own folder out of discovery.
const SLUG = /^[a-z0-9][a-z0-9-]*$/

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
}

async function kind(path) {
  try {
    const s = await stat(path)
    return s.isDirectory() ? 'dir' : s.isFile() ? 'file' : null
  } catch {
    return null
  }
}

// macOS filesystems are case-insensitive, so `href="Icon.svg"` loads locally and 404s on Pages.
// realpath.native reports the true on-disk spelling; if it differs, treat the file as missing —
// the same answer production would give — and say why.
async function casingMismatch(root, path) {
  try {
    const real = await (realpath.native ?? realpath)(path)
    return real === path ? null : relative(root, real)
  } catch {
    return null
  }
}

// Which folder answers this URL: the catalog itself, or a sister app's build.
// Returns null for the catalog, else { slug, dir } with dir null when the sibling is not built.
async function mountFor(pathname) {
  const seg = decodeURIComponent(pathname).replace(/^\/+/, '').split('/')[0]
  if (!SLUG.test(seg)) return null

  // A real file or folder in this repo always wins — the catalog is never shadowed.
  if (await kind(join(ROOT, seg))) return null

  const sibling = resolve(SISTERS, seg)
  if (!sibling.startsWith(SISTERS + sep)) return null
  if ((await kind(sibling)) !== 'dir') return null

  const dist = join(sibling, 'dist')
  return { slug: seg, dir: (await kind(dist)) === 'dir' ? dist : null }
}

// Map a URL path (already stripped of any mount prefix) to a file under `root`, following the
// Pages resolution order. Returns { file } | { redirectToSlash } | { missing }.
async function resolveIn(root, subPath) {
  if (subPath === '') return { redirectToSlash: true }

  const rel = decodeURIComponent(subPath).replace(/^\/+/, '')
  const target = resolve(root, rel)

  // Never serve outside the mounted folder, whatever ../ games the URL plays.
  if (target !== root && !target.startsWith(root + sep)) return { missing: true }

  if (subPath.endsWith('/')) {
    const index = join(target, 'index.html')
    return (await kind(index)) === 'file' ? { file: index } : { missing: true }
  }

  const direct = await kind(target)
  if (direct === 'file') return { file: target }
  if (direct === 'dir') return { redirectToSlash: true }

  const html = target + '.html'
  if ((await kind(html)) === 'file') return { file: html }

  return { missing: true }
}

function send(res, status, headers, body) {
  res.writeHead(status, headers)
  res.end(body)
}

async function sendFile(req, res, file, status = 200) {
  const s = await stat(file)
  const headers = {
    'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': s.size,
    // The catalog's JSON is fetched with cache: 'no-cache'; keep the whole dev site honest so an
    // edit — or a rebuilt sister app — is always the thing you reload.
    'Cache-Control': 'no-cache',
  }
  if (req.method === 'HEAD') return send(res, status, headers, null)
  res.writeHead(status, headers)
  createReadStream(file).pipe(res)
}

async function notFound(req, res) {
  const page = join(ROOT, '404.html')
  if ((await kind(page)) === 'file') return sendFile(req, res, page, 404)
  send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found\n')
}

const server = createServer(async (req, res) => {
  const started = Date.now()
  let status = 200
  let via = ''

  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      status = 405
      send(res, 405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' }, 'Method Not Allowed\n')
    } else {
      const { pathname } = new URL(req.url, `http://${req.headers.host}`)
      const mount = await mountFor(pathname)

      let root = ROOT
      let subPath = pathname

      if (mount) {
        via = ` [${mount.slug}]`
        root = mount.dir
        subPath = pathname.slice(mount.slug.length + 1)
      }

      if (mount && !mount.dir) {
        // The sibling checkout is there but has no dist — say the one thing that fixes it.
        status = 404
        const hint =
          `${mount.slug} is not built.\n\n` +
          `  cd ${relative(ROOT, resolve(SISTERS, mount.slug))} && npm run build\n\n` +
          `then reload. (On graphl.in this path is served by the ${mount.slug} repo's own Pages deploy.)\n`
        send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, hint)
      } else {
        const found = await resolveIn(root, subPath)

        if (found.redirectToSlash) {
          status = 301
          send(res, 301, { Location: pathname + '/' }, null)
        } else if (found.file) {
          const wrongCase = await casingMismatch(root, found.file)
          if (wrongCase) {
            status = 404
            console.warn(`  ! case mismatch: requested ${pathname} but disk has ${wrongCase}`)
            console.warn(`    (served here by macOS, 404 on GitHub Pages — fix the reference)`)
            await notFound(req, res)
          } else {
            await sendFile(req, res, found.file)
          }
        } else {
          status = 404
          await notFound(req, res)
        }
      }
    }
  } catch (err) {
    status = 500
    console.error(err)
    if (!res.headersSent) send(res, 500, { 'Content-Type': 'text/plain' }, 'Internal Server Error\n')
  }

  console.log(`${String(status).padEnd(3)} ${req.method} ${req.url}${via}  ${Date.now() - started}ms`)
})

// Every sibling that is currently built. Reported once at startup so it is obvious what the
// catalog's cards will and will not reach; the check itself is per-request, so building an app
// while the server runs just works.
async function discover() {
  const built = []
  const unbuilt = []
  try {
    for (const name of (await readdir(SISTERS)).sort()) {
      if (!SLUG.test(name)) continue
      if (await kind(join(ROOT, name))) continue
      if ((await kind(join(SISTERS, name))) !== 'dir') continue
      if ((await kind(join(SISTERS, name, 'dist'))) === 'dir') built.push(name)
      else unbuilt.push(name)
    }
  } catch {
    /* no sibling directory — the catalog still serves on its own */
  }
  return { built, unbuilt }
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Try: PORT=${PORT + 1} npm run dev`)
    process.exit(1)
  }
  throw err
})

server.listen(PORT, HOST, async () => {
  const { built, unbuilt } = await discover()
  console.log(`GraphL catalog — serving ${ROOT}`)
  console.log(`  http://${HOST}:${PORT}/  (Ctrl-C to stop)`)
  if (built.length) console.log(`  sister apps: ${built.join(', ')}`)
  if (unbuilt.length) console.log(`  not built:   ${unbuilt.join(', ')}  (npm run build in each)`)
})
